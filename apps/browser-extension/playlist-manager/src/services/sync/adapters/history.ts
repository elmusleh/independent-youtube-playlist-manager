/**
 * Watch-history collection adapter for the sync engine.
 *
 * Each video's history entry is its own record; merge is per-video LWW.
 */

import { mergeHistory, type HistoryEntry } from "../merge/history";
import {
  getShadow,
  setShadow,
  isDirty,
  getShadowsByCollection,
  deleteShadow,
} from "../shadow-store";
import type { DirtyCandidate } from "./types";
import { computeRecordId, deriveKeys } from "../keys";
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

function normalizeHistoryEntry(videoId: string, raw: unknown): HistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const resolvedId = typeof obj.videoId === "string" && obj.videoId ? obj.videoId : videoId;
  if (!resolvedId) return null;
  return { ...(obj as HistoryEntry), videoId: resolvedId };
}

export async function collectDirtyHistory(ctx: AdapterContext): Promise<DirtyCandidate[]> {
  const { history } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const dirty: DirtyCandidate[] = [];
  let lastHlc: any = ctx.hlcState?.lastHlc;
  for (const [videoId, rawEntry] of Object.entries(history)) {
    const entry = normalizeHistoryEntry(videoId, rawEntry);
    if (!entry) continue;
    if (await isDirty("history", videoId, entry)) {
      const rid = await computeRecordId(ctx.syncKey, "history", videoId);
      const hlc = await getHlc(ctx.syncKey, lastHlc, ctx.localDeviceId);
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
        record: {
          collection: "history",
          rid,
          version,
          payload: JSON.stringify(encrypted),
          deleted: false,
        },
        collection: "history",
        recordId: videoId,
        value: entry,
        version,
        deleted: false,
      });
    }
  }
  // Deletion tombstones: detect locally deleted history entries
  const localIds = new Set(Object.keys(history));
  const shadows = await getShadowsByCollection("history");
  for (const shadow of shadows) {
    if (localIds.has(shadow.recordId)) continue;
    // An acknowledged deletion has already been propagated; do not re-emit it.
    if (shadow.deleted) continue;
    const baseCopy = normalizeHistoryEntry(shadow.recordId, shadow.baseCopy);
    if (!baseCopy) continue;
    const rid = await computeRecordId(ctx.syncKey, "history", shadow.recordId);
    const hlc = await getHlc(ctx.syncKey, lastHlc, ctx.localDeviceId);
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
      record: {
        collection: "history",
        rid,
        version,
        payload: JSON.stringify(encrypted),
        deleted: true,
      },
      collection: "history",
      recordId: shadow.recordId,
      value: baseCopy,
      version,
      deleted: true,
    });
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
  const local = Object.entries(localObj)
    .map(([videoId, entry]) => normalizeHistoryEntry(videoId, entry))
    .filter((entry): entry is HistoryEntry => entry !== null);
  const baseCopies: HistoryEntry[] = [];
  for (const entry of local) {
    const base = await getShadow("history", entry.videoId);
    const normalizedBase = base?.baseCopy
      ? normalizeHistoryEntry(entry.videoId, base.baseCopy)
      : null;
    if (normalizedBase) baseCopies.push(normalizedBase);
  }

  const failed: string[] = [];
  const remoteEntries: HistoryEntry[] = [];
  const remoteVersions = new Map<string, number>();
  const remoteDeletes = new Map<string, number>();
  for (const r of remote) {
    try {
      const encrypted = JSON.parse(r.payload) as EncryptedRecord;
      if (
        encrypted.collection !== "history" ||
        encrypted.id !== r.rid ||
        encrypted.hlc !== r.version ||
        encrypted.deleted !== r.deleted
      ) {
        throw new Error("record metadata does not match relay envelope");
      }
      const envelope = await decryptRecord(encrypted, keys);
      if (envelope.collection !== "history" || envelope.deleted !== r.deleted) {
        throw new Error("invalid history envelope");
      }
      const data = envelope.data as HistoryEntry | null;
      const videoId = data?.videoId;
      if (typeof videoId !== "string" || !videoId) {
        throw new Error("history envelope is missing videoId");
      }
      if ((await computeRecordId(ctx.syncKey, "history", videoId)) !== r.rid) {
        throw new Error("history video id does not match relay record id");
      }
      if (r.deleted) {
        remoteDeletes.set(videoId, r.version);
      } else {
        if (!Number.isFinite(data?.lastWatchedAt)) {
          throw new Error("history envelope has an invalid lastWatchedAt");
        }
        const shadow = await getShadow("history", videoId);
        if (shadow && r.version <= shadow.remoteVersion) continue;
        remoteEntries.push(data);
        remoteVersions.set(videoId, r.version);
      }
    } catch (error) {
      failed.push(`history ${r.rid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const { merged } = mergeHistory(local, remoteEntries, baseCopies);
  const mergedById = new Map(merged.map((entry) => [entry.videoId, entry]));
  const locallyEditedDeletes = new Set<string>();
  const appliedDeletes = new Set<string>();
  const localById = new Map(local.map((entry) => [entry.videoId, entry]));

  for (const [videoId, version] of remoteDeletes) {
    const shadow = await getShadow("history", videoId);
    if (shadow && version <= shadow.remoteVersion) continue;
    const localEntry = localById.get(videoId);
    if (localEntry && (await isDirty("history", videoId, localEntry))) {
      // Preserve concurrent local work and keep it dirty against the remote tombstone.
      mergedById.set(videoId, localEntry);
      locallyEditedDeletes.add(videoId);
    } else {
      mergedById.delete(videoId);
      appliedDeletes.add(videoId);
    }
  }

  if (remoteEntries.length === 0 && appliedDeletes.size === 0 && locallyEditedDeletes.size === 0) {
    return { applied: 0, failed };
  }

  const finalHistory = [...mergedById.values()].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
  try {
    await ctx.saveHistory(finalHistory);
  } catch (e) {
    failed.push(`history: ${e instanceof Error ? e.message : String(e)}`);
    return { applied: 0, failed };
  }

  try {
    for (const entry of remoteEntries) {
      await setShadow(
        "history",
        entry.videoId,
        entry,
        remoteVersions.get(entry.videoId) ?? 0,
        ctx.localDeviceId
      );
    }
    for (const videoId of locallyEditedDeletes) {
      await setShadow(
        "history",
        videoId,
        null,
        remoteDeletes.get(videoId) ?? 0,
        ctx.localDeviceId,
        true
      );
    }
    for (const videoId of appliedDeletes) await deleteShadow("history", videoId);
  } catch (error) {
    failed.push(`history shadow update: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { applied: remoteEntries.length + appliedDeletes.size, failed };
}
