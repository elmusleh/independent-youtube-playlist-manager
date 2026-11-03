/**
 * Settings collection adapter for the sync engine.
 *
 * Each syncable setting key is its own record; merge is per-key LWW.
 */

import { mergeSettings, isSyncableSetting } from "../merge/settings";
import { getShadow, setShadow, isDirty } from "../shadow-store";
import type { RelayRecord } from "../relay-transport";
import { computeRecordId } from "../keys";

export type AdapterContext = {
  syncKey: string;
  localDeviceId: string;
  librarySnapshot: () => Promise<{ settings: Record<string, unknown> }>;
  saveSettings: (settings: Record<string, unknown>) => Promise<void>;
};

export async function collectDirtySettings(ctx: AdapterContext): Promise<RelayRecord[]> {
  const { settings } = await ctx.librarySnapshot();
  const dirty: RelayRecord[] = [];
  for (const [key, value] of Object.entries(settings)) {
    if (!isSyncableSetting(key)) continue;
    if (await isDirty("settings", key, value)) {
      const rid = await computeRecordId(ctx.syncKey, "settings", key);
      dirty.push({
        collection: "settings",
        rid,
        version: Date.now(),
        payload: JSON.stringify({ key, value }),
        deleted: false,
      });
    }
  }
  return dirty;
}

export async function applyRemoteSettings(
  ctx: AdapterContext,
  remote: Array<{ rid: string; payload: string; deleted: boolean; version: number }>
): Promise<{ applied: number; failed: string[] }> {
  const { settings: local } = await ctx.librarySnapshot();
  const baseCopies: Record<string, unknown> = {};
  for (const key of Object.keys(local)) {
    const base = await getShadow("settings", key);
    if (base?.baseCopy !== undefined) baseCopies[key] = base.baseCopy;
  }

  const remoteObj: Record<string, unknown> = {};
  for (const r of remote) {
    if (r.deleted) continue;
    try {
      const parsed = JSON.parse(r.payload);
      if (parsed && typeof parsed === "object" && "key" in parsed) {
        remoteObj[parsed.key] = parsed.value;
      }
    } catch {
      /* skip */
    }
  }

  const { merged } = mergeSettings(local, remoteObj, baseCopies);

  const failed: string[] = [];
  try {
    await ctx.saveSettings(merged);
  } catch (e) {
    failed.push(`settings: ${e instanceof Error ? e.message : String(e)}`);
  }

  for (const [key, value] of Object.entries(merged)) {
    await setShadow("settings", key, value, Date.now(), ctx.localDeviceId);
  }

  return { applied: Object.keys(merged).length, failed };
}
