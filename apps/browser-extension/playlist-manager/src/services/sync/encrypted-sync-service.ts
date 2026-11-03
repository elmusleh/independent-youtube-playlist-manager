/**
 * Encrypted (zero-knowledge) sync over Supabase.
 *
 * A device writes a single encrypted snapshot under a storage address derived from the
 * user's sync key. The address is public (it is only a hash of the key), the payload is
 * AES-256-GCM ciphertext, so the backend learns nothing about the data and cannot
 * tamper with it without breaking authentication.
 *
 * Conflict resolution is revision-based (strictly newer wins; ties keep local), exactly
 * like the snapshot codec. The storage backend is intentionally dumb: it stores one blob
 * per address and reports its revision.
 */

import { createAnonClient } from "../supabase-client";
import { RELAY_SUPABASE_URL, RELAY_SUPABASE_ANON_KEY } from "./sync-config";
import type { DownloadResult } from "./sync-config";
import { deriveEncryptionKey, deriveStorageAddress } from "./key-derivation";
import { encryptSnapshot, decryptSnapshot } from "./encryption-service";
import { createSnapshot, encodeSnapshot, decodeSnapshot, isNewerRevision } from "./snapshot-codec";
import {
  selectSyncContent,
  type SyncSelection,
  type SyncSource,
  type SyncPayload,
} from "./content-selector";
import type { SyncSnapshot } from "./snapshot-codec";

const TABLE = "sync_snapshots";

/** Base64 helpers that work on Uint8Array in the extension (no Node Buffer). */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export type EncryptedSyncResult = {
  success: boolean;
  pushed: boolean;
  pulled: boolean;
  remoteRevision: number | null;
  snapshot: SyncSnapshot | null;
  error?: string;
};

export class EncryptedSyncService {
  private deviceId: string;
  private url: string;
  private key: string;
  private client: ReturnType<typeof createAnonClient> | null = null;
  private clientKey = "";

  constructor(deviceId?: string, options?: { url?: string; key?: string }) {
    this.deviceId =
      deviceId ??
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}`);
    this.url = options?.url ?? RELAY_SUPABASE_URL;
    this.key = options?.key ?? RELAY_SUPABASE_ANON_KEY;
  }

  /** Lazily build (and cache) the anon client for the configured endpoint. */
  private getClient(): ReturnType<typeof createAnonClient> {
    const ck = `${this.url}|${this.key}`;
    if (!this.client || this.clientKey !== ck) {
      this.client = createAnonClient(this.url, this.key);
      this.clientKey = ck;
    }
    return this.client;
  }

  /**
   * Encrypt the local snapshot and upload it to Supabase under the key-derived address.
   * Only overwrites when the local revision is strictly newer than the remote one.
   */
  async upload(
    syncKey: string,
    source: SyncSource,
    selection: Partial<SyncSelection> = {},
    revision: number
  ): Promise<{ pushed: boolean; error?: string }> {
    try {
      const client = this.getClient();
      const address = await deriveStorageAddress(syncKey);
      const key = await deriveEncryptionKey(syncKey);

      const payload = selectSyncContent(source, selection) as unknown as Record<string, unknown>;
      const snapshot = createSnapshot({ revision, deviceId: this.deviceId, payload });
      const plaintext = encodeSnapshot(snapshot);
      const encrypted = await encryptSnapshot(key, plaintext);
      const blob = toBase64(encrypted);
      const row = {
        address,
        blob,
        revision,
        device_id: this.deviceId,
        updated_at: new Date().toISOString(),
      };

      // Atomic LWW guard: only overwrite when the stored revision is strictly older.
      // A conditional update avoids the check-then-write race between two devices.
      const { data: updated, error: upErr } = await client
        .from(TABLE)
        .update(row)
        .eq("address", address)
        .lt("revision", revision)
        .select("address");
      if (upErr) throw upErr;
      if (updated && updated.length > 0) {
        return { pushed: true };
      }

      // No row updated — either the row doesn't exist yet, or remote is newer.
      const { data: existing } = await client
        .from(TABLE)
        .select("revision")
        .eq("address", address)
        .maybeSingle();
      if (existing && isNewerRevision(existing.revision, revision)) {
        // Remote is strictly newer — local lost the LWW race.
        return { pushed: false };
      }
      if (!existing) {
        const { error: insErr } = await client.from(TABLE).insert(row);
        if (insErr) throw insErr;
        return { pushed: true };
      }
      // Existing row with equal/newer revision — don't clobber.
      return { pushed: false };
    } catch (err: any) {
      return { pushed: false, error: err?.message || String(err) };
    }
  }

  /**
   * Fetch, decrypt and decode the remote snapshot for this sync key.
   * Returns null when no snapshot exists yet (first device / fresh key).
   */
  async download(syncKey: string): Promise<DownloadResult> {
    try {
      const client = this.getClient();
      const address = await deriveStorageAddress(syncKey);
      const key = await deriveEncryptionKey(syncKey);

      const { data, error } = await client
        .from(TABLE)
        .select("blob, revision")
        .eq("address", address)
        .maybeSingle();
      if (error) {
        // Distinguish permission/auth errors from other failures.
        const msg = error?.message || String(error);
        if (/permission|rls|not allowed|401|403/i.test(msg)) {
          return { status: "permission", message: msg };
        }
        throw error;
      }
      if (!data || !data.blob) return { status: "missing" };

      let plaintext: Uint8Array;
      try {
        const encrypted = fromBase64(data.blob);
        plaintext = await decryptSnapshot(key, encrypted);
      } catch (err: any) {
        return { status: "decrypt", message: err?.message || String(err) };
      }
      try {
        const snapshot = decodeSnapshot(plaintext);
        return { status: "ok", snapshot };
      } catch (err: any) {
        return { status: "corrupt", message: err?.message || String(err) };
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn("[ENCRYPTED-SYNC] download failed:", msg);
      if (/permission|rls|not allowed|401|403/i.test(msg)) {
        return { status: "permission", message: msg };
      }
      if (/corrupt|invalid|decode/i.test(msg)) {
        return { status: "corrupt", message: msg };
      }
      // Unknown failure — treat as corrupt rather than "missing" so we don't
      // silently report "Already up to date."
      return { status: "corrupt", message: msg };
    }
  }

  /**
   * Full round-trip: upload the local snapshot, then pull any newer remote one.
   * Returns the (possibly updated) remote snapshot so the caller can merge it locally.
   */
  async sync(
    syncKey: string,
    source: SyncSource,
    selection: Partial<SyncSelection> = {},
    localRevision: number
  ): Promise<EncryptedSyncResult> {
    const uploadResult = await this.upload(syncKey, source, selection, localRevision);
    const remoteResult = await this.download(syncKey);
    const remote = remoteResult.status === "ok" ? remoteResult.snapshot : null;

    let pulled = false;
    if (remote && isNewerRevision(remote.revision, localRevision)) {
      pulled = true;
    }

    const conflictMessage = uploadResult.pushed
      ? uploadResult.error
      : (uploadResult.error ?? "A newer or equal remote snapshot rejected this write.");

    return {
      success: uploadResult.pushed && !conflictMessage,
      pushed: uploadResult.pushed,
      pulled,
      remoteRevision: remote?.revision ?? null,
      snapshot: remote,
      error: conflictMessage,
    };
  }
}
