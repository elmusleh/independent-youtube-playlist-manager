/**
 * Storage read/write helpers for `sync-engine-adapters.ts`.
 *
 * Works identically in both the background service worker (where `window.getSettings`
 * and `window.storeObject` are absent) and the editor page / test environments.
 */

import { librarySnapshot as readLibrarySnapshot } from "../../../../shared/storage-client.js";
import { isSyncableSetting } from "./merge/settings";

export async function readSyncableSettingsFromStorage(): Promise<Record<string, unknown>> {
  const b = (globalThis as any).browser || (globalThis as any).chrome;
  const w = (globalThis as any).window;
  if (b?.storage?.local?.get || b?.storage?.sync?.get) {
    const [localItems, syncItems] = await Promise.all([
      b?.storage?.local?.get ? b.storage.local.get(undefined).catch(() => ({})) : {},
      b?.storage?.sync?.get ? b.storage.sync.get(undefined).catch(() => ({})) : {},
    ]);
    const combined = { ...(localItems ?? {}), ...(syncItems ?? {}) };
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(combined)) {
      if (isSyncableSetting(k) && v !== undefined) filtered[k] = v;
    }
    return filtered;
  }
  if (typeof w?.getSettings === "function") {
    const raw = await w.getSettings();
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      if (isSyncableSetting(k) && v !== undefined) filtered[k] = v;
    }
    return filtered;
  }
  return {};
}

export function createSyncStorageBridge() {
  const librarySnapshot = async () => {
    const snapshot = await readLibrarySnapshot();
    const settings = await readSyncableSettingsFromStorage();
    const historyObj = await (async () => {
      const b = (globalThis as any).browser || (globalThis as any).chrome;
      if (!b?.storage?.local) return {};
      const stored = await b.storage.local.get("local_yt_history");
      const rawHistory = stored?.local_yt_history ?? {};
      const normalized: Record<string, unknown> = {};
      for (const [videoId, entry] of Object.entries(rawHistory)) {
        if (entry && typeof entry === "object") {
          normalized[videoId] = { ...(entry as Record<string, unknown>), videoId };
        }
      }
      return normalized;
    })();
    return {
      playlists: snapshot.playlists,
      settings,
      history: historyObj,
      revision: snapshot.revision,
    };
  };

  const mutateLibrary = async (op: any) => {
    const w = (globalThis as any).window;
    if (w?.mutateLibrary) return w.mutateLibrary(op);
    const plain = JSON.parse(JSON.stringify(op));
    const local = (globalThis as any).yphMutateLibrary;
    if (typeof local === "function") return local(plain);
    const b = (globalThis as any).browser || (globalThis as any).chrome;
    const res = await b?.runtime?.sendMessage({ cmd: "mutate-library", operation: plain });
    if (res && typeof res === "object" && "ok" in res) {
      if (!res.ok) {
        throw new Error(
          res.error || "Playlist storage is unavailable. Retry without closing this page."
        );
      }
      return res.result;
    }
    return res;
  };

  const saveSettings = async (s: Record<string, unknown>, deletedKeys: string[] = []) => {
    const w = (globalThis as any).window;
    const b = (globalThis as any).browser || (globalThis as any).chrome;
    if (Object.keys(s).length > 0) {
      if (typeof w?.storeObject === "function") {
        for (const [k, v] of Object.entries(s)) await w.storeObject(k, v);
      } else {
        if (b?.storage?.sync?.set) {
          try {
            await b.storage.sync.set(s);
          } catch {
            // Fall through to local persistence below.
          }
        }
        await b?.storage?.local?.set?.(s);
      }
    }
    for (const key of deletedKeys) {
      if (typeof w?.removeObject === "function") {
        await w.removeObject(key);
        continue;
      }
      try {
        await b?.storage?.sync?.remove?.(key);
      } catch {
        // Local removal is still required when sync storage is unavailable.
      }
      await b?.storage?.local?.remove?.(key);
    }
  };

  const saveHistory = async (entries: unknown[]) => {
    const b = (globalThis as any).browser || (globalThis as any).chrome;
    if (b?.storage?.local) {
      const obj: Record<string, unknown> = {};
      for (const e of entries) {
        const item = e as Record<string, unknown>;
        if (typeof item?.videoId === "string" && item.videoId) {
          obj[item.videoId] = item;
        }
      }
      await b.storage.local.set({ local_yt_history: obj });
    }
  };

  return { librarySnapshot, mutateLibrary, saveSettings, saveHistory };
}
