/**
 * Watch-history collection adapter for the sync engine.
 *
 * Each video's history entry is its own record; merge is per-video LWW.
 */

import { mergeHistory } from "../merge/history";
import { getShadow, setShadow, isDirty } from "../shadow-store";
import type { RelayRecord } from "../relay-transport";
import { computeRecordId } from "../keys";

export type AdapterContext = {
  syncKey: string;
  localDeviceId: string;
  librarySnapshot: () => Promise<{ history: Record<string, unknown> }>;
  // injected: persist merged history back to storage
  saveHistory: (entries: unknown[]) => Promise<void>;
};

export async function collectDirtyHistory(ctx: AdapterContext): Promise<RelayRecord[]> {
  const { history } = await ctx.librarySnapshot();
  const dirty: RelayRecord[] = [];
  for (const [videoId, entry] of Object.entries(history)) {
    if (await isDirty("history", videoId, entry)) {
      const rid = await computeRecordId(ctx.syncKey, "history", videoId);
      dirty.push({
        collection: "history",
        rid,
        version: (entry as any)?.lastWatchedAt ?? Date.now(),
        payload: JSON.stringify(entry),
        deleted: false,
      });
    }
  }
  return dirty;
}

export async function applyRemoteHistory(
  ctx: AdapterContext,
  remote: Array<{ rid: string; payload: string; deleted: boolean; version: number }>
): Promise<{ applied: number; failed: string[] }> {
  const { history: localObj } = await ctx.librarySnapshot();
  const local = Object.values(localObj) as any[];
  const baseCopies: any[] = [];
  for (const v of local) {
    const base = await getShadow("history", v.videoId);
    if (base?.baseCopy) baseCopies.push(base.baseCopy);
  }

  const remoteEntries = remote
    .filter((r) => !r.deleted)
    .map((r) => {
      try {
        return JSON.parse(r.payload);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const { merged } = mergeHistory(local, remoteEntries, baseCopies);

  const failed: string[] = [];
  try {
    await ctx.saveHistory(merged);
  } catch (e) {
    failed.push(`history: ${e instanceof Error ? e.message : String(e)}`);
  }

  for (const e of merged) {
    await setShadow("history", e.videoId, e, e.lastWatchedAt, ctx.localDeviceId);
  }

  return { applied: merged.length, failed };
}
