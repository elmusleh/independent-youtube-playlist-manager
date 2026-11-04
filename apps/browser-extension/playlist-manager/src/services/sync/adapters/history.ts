/**
 * Watch-history collection adapter for the sync engine.
 *
 * Each video's history entry is its own record; merge is per-video LWW.
 */

import { mergeHistory } from "../merge/history";
import { getShadow, setShadow, isDirty } from "../shadow-store";
import type { RelayRecord } from "../relay-transport";
import { computeRecordId } from "../keys";
import { deriveKeys } from "../keys";
import { encryptRecord, decryptRecord, RECORD_VERSION } from "../record-codec";
import { getHlc } from "../hlc";
import type { RecordEnvelope, EncryptedRecord } from "../record-codec";

export type AdapterContext = {
  syncKey: string;
  localDeviceId: string;
  librarySnapshot: () => Promise<{ history: Record<string, unknown> }>;
  // injected: persist merged history back to storage
  saveHistory: (entries: unknown[]) => Promise<void>;
  // shared HLC state for monotonicity across adapters
  hlcState?: { lastHlc: any };
};

export async function collectDirtyHistory(ctx: AdapterContext): Promise<RelayRecord[]> {
  const { history } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const dirty: RelayRecord[] = [];
  let lastHlc: any = ctx.hlcState?.lastHlc;
  for (const [videoId, entry] of Object.entries(history)) {
    if (await isDirty("history", videoId, entry)) {
      const rid = await computeRecordId(ctx.syncKey, "history", videoId);
      const hlc = await getHlc(ctx.syncKey, lastHlc);
      lastHlc = hlc;
      const version = hlc.value;
      const envelope: RecordEnvelope = {
        v: RECORD_VERSION,
        collection: "history",
        id: rid,
        hlc: version,
        deleted: false,
        data: entry,
      };
      const encrypted = await encryptRecord(envelope, keys);
      dirty.push({
        collection: "history",
        rid,
        version,
        payload: JSON.stringify(encrypted),
        deleted: false,
      });
      await setShadow("history", videoId, entry, version, ctx.localDeviceId);
    }
  }
  // Deletion tombstones: detect locally deleted history entries
  const localIds = new Set(Object.keys(history));
  const shadows = await getShadowsByCollection("history");
  for (const shadow of shadows) {
    if (localIds.has(shadow.recordId)) continue;
    const baseCopy = shadow.baseCopy;
    if (!baseCopy) continue;
    const rid = await computeRecordId(ctx.syncKey, "history", shadow.recordId);
    const hlc = await getHlc(ctx.syncKey, lastHlc);
    lastHlc = hlc;
    const version = hlc.value;
    const envelope: RecordEnvelope = {
      v: RECORD_VERSION,
      collection: "history",
      id: rid,
      hlc: version,
      deleted: true,
      data: baseCopy,
    };
    const encrypted = await encryptRecord(envelope, keys);
    dirty.push({
      collection: "history",
      rid,
      version,
      payload: JSON.stringify(encrypted),
      deleted: true,
    });
    await setShadow("history", shadow.recordId, baseCopy, version, ctx.localDeviceId);
  }

  if (ctx.hlcState) ctx.hlcState.lastHlc = lastHlc;
  return dirty;
}

export async function applyRemoteHistory(
  ctx: AdapterContext,
  remote: Array<{ rid: string; payload: string; deleted: boolean; version: number }>
): Promise<{ applied: number; failed: string[] }> {
  // Nothing to apply from an empty remote; preserve local history untouched.
  if (!remote || remote.length === 0) return { applied: 0, failed: [] };
  const { history: localObj } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const local = Object.values(localObj) as any[];
  const baseCopies: any[] = [];
  for (const v of local) {
    const base = await getShadow("history", v.videoId);
    if (base?.baseCopy) baseCopies.push(base.baseCopy);
  }

  const remoteEntries: any[] = [];
  for (const r of remote) {
    if (r.deleted) {
      try {
        const encrypted = JSON.parse(r.payload) as EncryptedRecord;
        const envelope = await decryptRecord(encrypted, keys);
        if (envelope?.data) {
          const videoId = (envelope.data as any).videoId ?? (envelope.data as any).id;
          if (videoId) {
            const b = (globalThis as any).browser || (globalThis as any).chrome;
            if (b?.storage?.local) {
              const stored = await b.storage.local.get("local_yt_history");
              const obj = stored?.local_yt_history ?? {};
              delete obj[videoId];
              await b.storage.local.set({ local_yt_history: obj });
            }
            await deleteShadow("history", videoId);
          }
        }
      } catch {
        // Skip undecryptable records
      }
      continue;
    }
    try {
      const encrypted = JSON.parse(r.payload) as EncryptedRecord;
      const envelope = await decryptRecord(encrypted, keys);
      if (envelope?.data) remoteEntries.push(envelope.data);
    } catch {
      // Skip undecryptable records
    }
  }

  const { merged } = mergeHistory(local, remoteEntries, baseCopies);

  const failed: string[] = [];
  try {
    await ctx.saveHistory(merged);
  } catch (e) {
    failed.push(`history: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Only advance shadow when the write succeeded.
  if (failed.length === 0) {
    for (const e of merged) {
      await setShadow("history", e.videoId, e, e.lastWatchedAt, ctx.localDeviceId);
    }
  }

  return { applied: merged.length, failed };
}
