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

import { getSupabaseClient } from "../supabase-client";
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

  constructor(deviceId?: string) {
    this.deviceId =
      deviceId ??
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}`);
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
      const client = await getSupabaseClient();
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
  async download(syncKey: string): Promise<SyncSnapshot | null> {
    try {
      const client = await getSupabaseClient();
      const address = await deriveStorageAddress(syncKey);
      const key = await deriveEncryptionKey(syncKey);

      const { data, error } = await client
        .from(TABLE)
        .select("blob, revision")
        .eq("address", address)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.blob) return null;

      const encrypted = fromBase64(data.blob);
      const plaintext = await decryptSnapshot(key, encrypted);
      return decodeSnapshot(plaintext);
    } catch (err: any) {
      // A wrong key or tampered blob surfaces as a decryption error — never crash sync.
      console.warn("[ENCRYPTED-SYNC] download failed:", err?.message || err);
      return null;
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
    const remote = await this.download(syncKey);

    let pulled = false;
    if (remote && isNewerRevision(remote.revision, localRevision)) {
      pulled = true;
    }

    const hasError = !!uploadResult.error;

    return {
      success: !uploadResult.error,
      pushed: uploadResult.pushed,
      pulled,
      remoteRevision: remote?.revision ?? null,
      snapshot: remote,
      error: uploadResult.error,
    };
  }
}
