/**
 * Playlists collection adapter for the sync engine.
 *
 * Bridges the local library (via mutateLibrary / librarySnapshot) and the
 * shadow store with the relay transport. Each playlist is its own record.
 */

import { mergePlaylists } from "../merge/playlists";
import { getShadow, setShadow, computeHash, isDirty } from "../shadow-store";
import type { RelayRecord } from "../relay-transport";
import { deriveKeys, computeRecordId } from "../keys";
import { encryptRecord, decryptRecord, RECORD_VERSION } from "../record-codec";
import { getHlc } from "../hlc";
import type { RecordEnvelope, EncryptedRecord } from "../record-codec";

export type PlaylistRecordData = {
  id: string;
  title: string;
  videos: string[];
  [key: string]: unknown;
};

export type AdapterContext = {
  syncKey: string;
  space: string;
  authHash: string;
  relayConfig: { url: string; anonKey: string };
  localDeviceId: string;
  // injected by the engine
  librarySnapshot: () => Promise<{ playlists: any[]; revision: number }>;
  mutateLibrary: (op: any) => Promise<any>;
};

export async function collectDirtyPlaylists(ctx: AdapterContext): Promise<RelayRecord[]> {
  const { playlists } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const dirty: RelayRecord[] = [];
  let lastHlc: any = undefined;
  for (const p of playlists) {
    if (await isDirty("playlists", p.id, p)) {
      const rid = await computeRecordId(ctx.syncKey, "playlists", p.id);
      const hlc = await getHlc(ctx.syncKey, lastHlc);
      lastHlc = hlc;
      const version = hlc.value;
      const envelope: RecordEnvelope = {
        v: RECORD_VERSION,
        collection: "playlists",
        id: rid,
        hlc: version,
        deleted: false,
        data: p,
      };
      const encrypted = await encryptRecord(envelope, keys);
      dirty.push({
        collection: "playlists",
        rid,
        version,
        payload: JSON.stringify(encrypted),
        deleted: false,
      });
    }
  }
  return dirty;
}

export async function applyRemotePlaylists(
  ctx: AdapterContext,
  remote: Array<{ rid: string; payload: string; deleted: boolean; version: number }>
): Promise<{ applied: number; failed: string[] }> {
  // Nothing to apply from an empty remote; leave local playlists untouched.
  if (!remote || remote.length === 0) return { applied: 0, failed: [] };
  const { playlists: local } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const baseCopies = new Map<string, any>();
  for (const p of local) {
    const base = await getShadow("playlists", p.id);
    if (base?.baseCopy) baseCopies.set(p.id, base.baseCopy);
  }

  const remotePlaylists: any[] = [];
  for (const r of remote) {
    if (r.deleted) continue;
    try {
      const encrypted = JSON.parse(r.payload) as EncryptedRecord;
      const envelope = await decryptRecord(encrypted, keys);
      if (envelope?.data) remotePlaylists.push(envelope.data);
    } catch {
      // Skip undecryptable records
    }
  }

  const base = [...baseCopies.values()];
  const { merged } = mergePlaylists(local, remotePlaylists, base);

  const failed: string[] = [];
  let appliedOk = true;
  try {
    await ctx.mutateLibrary({
      type: "replace",
      playlists: merged,
      expectedRevision: (await ctx.librarySnapshot()).revision,
    });
  } catch (e) {
    appliedOk = false;
    failed.push(`playlists: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Only advance the shadow baseline for records that actually landed in the library.
  if (appliedOk) {
    for (const p of merged) {
      await setShadow(
        "playlists",
        p.id,
        p,
        (typeof p.updatedAt === "number" ? p.updatedAt : Date.parse(String(p.updatedAt))) ||
          Date.now(),
        ctx.localDeviceId
      );
    }
  }

  return { applied: merged.length, failed };
}
