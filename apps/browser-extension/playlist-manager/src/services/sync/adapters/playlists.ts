/**
 * Playlists collection adapter for the sync engine.
 *
 * Bridges the local library (via mutateLibrary / librarySnapshot) and the
 * shadow store with the relay transport. Each playlist is its own record.
 */

import { mergePlaylists } from "../merge/playlists";
import {
  getShadow,
  setShadow,
  computeHash,
  isDirty,
  getShadowsByCollection,
  deleteShadow,
} from "../shadow-store";
import type { DirtyCandidate } from "./types";
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
  // shared HLC state for monotonicity across adapters
  hlcState?: { lastHlc: any };
};

export async function collectDirtyPlaylists(ctx: AdapterContext): Promise<DirtyCandidate[]> {
  const { playlists } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const dirty: DirtyCandidate[] = [];
  let lastHlc: any = ctx.hlcState?.lastHlc;
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
        record: {
          collection: "playlists",
          rid,
          version,
          payload: JSON.stringify(encrypted),
          deleted: false,
        },
        collection: "playlists",
        recordId: p.id,
        value: p,
        version,
        deleted: false,
      });
    }
  }
  // Deletion tombstones: detect locally deleted playlists
  const localIds = new Set(playlists.map((p: any) => p.id));
  const shadows = await getShadowsByCollection("playlists");
  for (const shadow of shadows) {
    if (localIds.has(shadow.recordId)) continue; // still exists
    // An acknowledged deletion has already been propagated; do not re-emit it.
    if (shadow.deleted) continue;
    // This playlist was deleted locally — emit a tombstone
    const baseCopy = shadow.baseCopy as any;
    if (!baseCopy) continue;
    const rid = await computeRecordId(ctx.syncKey, "playlists", shadow.recordId);
    const hlc = await getHlc(ctx.syncKey, lastHlc);
    lastHlc = hlc;
    const version = hlc.value;
    const envelope: RecordEnvelope = {
      v: RECORD_VERSION,
      collection: "playlists",
      id: rid,
      hlc: version,
      deleted: true,
      data: baseCopy,
    };
    const encrypted = await encryptRecord(envelope, keys);
    dirty.push({
      record: {
        collection: "playlists",
        rid,
        version,
        payload: JSON.stringify(encrypted),
        deleted: true,
      },
      collection: "playlists",
      recordId: shadow.recordId,
      value: baseCopy,
      version,
      deleted: true,
    });
  }

  if (ctx.hlcState) ctx.hlcState.lastHlc = lastHlc;
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

  const failed: string[] = [];
  const remotePlaylists: any[] = [];
  const remoteVersions = new Map<string, number>();
  const remoteDeletes = new Map<string, number>();
  for (const r of remote) {
    try {
      const encrypted = JSON.parse(r.payload) as EncryptedRecord;
      if (
        encrypted.collection !== "playlists" ||
        encrypted.id !== r.rid ||
        encrypted.hlc !== r.version ||
        encrypted.deleted !== r.deleted
      ) {
        throw new Error("record metadata does not match relay envelope");
      }
      const envelope = await decryptRecord(encrypted, keys);
      if (envelope.collection !== "playlists" || envelope.deleted !== r.deleted) {
        throw new Error("invalid playlist envelope");
      }
      const playlist = envelope.data as PlaylistRecordData | null;
      const id = playlist?.id;
      if (typeof id !== "string" || !id) throw new Error("playlist envelope is missing id");
      if ((await computeRecordId(ctx.syncKey, "playlists", id)) !== r.rid) {
        throw new Error("playlist id does not match relay record id");
      }
      if (!baseCopies.has(id)) {
        const shadow = await getShadow("playlists", id);
        if (shadow?.baseCopy) baseCopies.set(id, shadow.baseCopy);
      }
      if (r.deleted) {
        remoteDeletes.set(id, r.version);
      } else {
        const shadow = await getShadow("playlists", id);
        if (shadow && r.version <= shadow.remoteVersion) continue;
        remotePlaylists.push(playlist);
        remoteVersions.set(id, r.version);
      }
    } catch (error) {
      failed.push(`playlists ${r.rid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const mergeTargetIds = new Set([...remoteVersions.keys(), ...remoteDeletes.keys()]);
  const targetLocal = local.filter((playlist) => mergeTargetIds.has(playlist.id));
  const targetBase = [...baseCopies.entries()]
    .filter(([id]) => mergeTargetIds.has(id))
    .map(([, playlist]) => playlist);
  const { merged } = mergePlaylists(targetLocal, remotePlaylists, targetBase);
  const mergedTargets = new Map(merged.map((playlist) => [playlist.id, playlist]));
  const mergedById = new Map(local.map((playlist) => [playlist.id, playlist]));
  for (const id of remoteVersions.keys()) {
    const playlist = mergedTargets.get(id);
    if (playlist) mergedById.set(id, playlist);
    else mergedById.delete(id);
  }
  const localById = new Map(local.map((playlist: any) => [playlist.id, playlist]));
  const locallyEditedDeletes = new Set<string>();
  const appliedDeletes = new Set<string>();
  for (const [id, version] of remoteDeletes) {
    const shadow = await getShadow("playlists", id);
    if (shadow && version <= shadow.remoteVersion) continue;
    const localPlaylist = localById.get(id);
    if (localPlaylist && (await isDirty("playlists", id, localPlaylist))) {
      // Preserve concurrent local edits and keep them dirty against the remote tombstone.
      mergedById.set(id, localPlaylist);
      locallyEditedDeletes.add(id);
    } else {
      mergedById.delete(id);
      appliedDeletes.add(id);
    }
  }
  const finalPlaylists = [...mergedById.values()];

  try {
    await ctx.mutateLibrary({
      type: "replace",
      playlists: finalPlaylists,
      expectedRevision: (await ctx.librarySnapshot()).revision,
    });
  } catch (e) {
    failed.push(`playlists: ${e instanceof Error ? e.message : String(e)}`);
    return { applied: 0, failed };
  }

  try {
    for (const playlist of remotePlaylists) {
      await setShadow(
        "playlists",
        playlist.id,
        playlist,
        remoteVersions.get(playlist.id) ?? 0,
        ctx.localDeviceId
      );
    }
    for (const id of locallyEditedDeletes) {
      await setShadow("playlists", id, null, remoteDeletes.get(id) ?? 0, ctx.localDeviceId, true);
    }
    for (const id of appliedDeletes) await deleteShadow("playlists", id);
  } catch (error) {
    failed.push(
      `playlists shadow update: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { applied: finalPlaylists.length, failed };
}
