/**
 * Adapter pass for the sync engine: pulls remote records, merges per collection,
 * and pushes dirty records. Returns the merged outcome for the engine to persist.
 */

import { collectDirtyPlaylists, applyRemotePlaylists } from "./sync/adapters/playlists";
import { collectDirtyHistory, applyRemoteHistory } from "./sync/adapters/history";
import { collectDirtySettings, applyRemoteSettings } from "./sync/adapters/settings";
import { collectDirtyDevices, applyRemoteDevices } from "./sync/adapters/devices";
import type { RelayRecord } from "./sync/relay-transport";
import { pullAll, pushAll } from "./sync/relay-transport";

export type AdapterPassContext = {
  syncKey: string;
  localDeviceId: string;
  relayConfig: { url: string; anonKey: string };
  space: string;
  authHash: string;
  incoming: any[];
  sinceSeq: number;
  storage: { get: (k: string) => Promise<any>; set: (o: any) => Promise<void> };
  cfg: any;
};

export type AdapterPassResult = {
  failed: string[];
  appliedCount: number;
  allDirty: RelayRecord[];
  maxSeq: number;
};

export async function runAdapterPass(ctx: AdapterPassContext): Promise<AdapterPassResult> {
  const failed: string[] = [];
  let appliedCount = 0;

  const librarySnapshot = async () => {
    const w = (globalThis as any).window;
    const playlists = w?.getPlaylists ? await w.getPlaylists() : [];
    const settings = w?.getSettings ? await w.getSettings() : {};
    const historyObj = await (async () => {
      const b = (globalThis as any).browser || (globalThis as any).chrome;
      if (b?.storage?.local) {
        const stored = await b.storage.local.get("local_yt_history");
        return stored?.local_yt_history ?? {};
      }
      return {};
    })();
    return { playlists, settings, history: historyObj ?? {} };
  };
  const mutateLibrary = async (op: any) => {
    const w = (globalThis as any).window;
    if (w?.mutateLibrary) return w.mutateLibrary(op);
    // In the service worker, library-mutations.js exposes the function as
    // globalThis.yphMutateLibrary (it must not message itself). Prefer that.
    const local = (globalThis as any).yphMutateLibrary;
    if (typeof local === "function") return local(op);
    const b = (globalThis as any).browser || (globalThis as any).chrome;
    return b?.runtime?.sendMessage({ cmd: "mutate-library", operation: op });
  };
  const saveSettings = async (s: Record<string, unknown>) => {
    const w = (globalThis as any).window;
    if (w?.storeObject) {
      for (const [k, v] of Object.entries(s)) await w.storeObject(k, v);
    }
  };
  const saveHistory = async (entries: unknown[]) => {
    const b = (globalThis as any).browser || (globalThis as any).chrome;
    if (b?.storage?.local) {
      const obj: Record<string, unknown> = {};
      for (const e of entries) obj[(e as any).videoId] = e;
      await b.storage.local.set({ local_yt_history: obj });
    }
  };

  const incomingByCollection = new Map<string, any[]>();
  for (const r of ctx.incoming) {
    if (!incomingByCollection.has(r.collection)) incomingByCollection.set(r.collection, []);
    incomingByCollection.get(r.collection)!.push(r);
  }

  const hlcState = { lastHlc: undefined as any };
  const ctxBase = { syncKey: ctx.syncKey, localDeviceId: ctx.localDeviceId, hlcState };

  // Playlists
  const playlistCtx = {
    ...ctxBase,
    relayConfig: ctx.relayConfig,
    librarySnapshot: async () => ({ playlists: (await librarySnapshot()).playlists }),
    mutateLibrary,
  };
  const dirtyPlaylists = await collectDirtyPlaylists(playlistCtx as any);
  const remotePlaylists = (incomingByCollection.get("playlists") ?? []).map((r: any) => ({
    rid: r.rid,
    payload: r.payload,
    deleted: r.deleted,
    version: r.version,
  }));
  const pr = await applyRemotePlaylists(playlistCtx as any, remotePlaylists);
  appliedCount += pr.applied;
  failed.push(...pr.failed);

  // History
  const historyCtx = {
    ...ctxBase,
    librarySnapshot: async () => ({ history: (await librarySnapshot()).history }),
    saveHistory,
  };
  const dirtyHistory = await collectDirtyHistory(historyCtx as any);
  const remoteHistory = (incomingByCollection.get("history") ?? []).map((r: any) => ({
    rid: r.rid,
    payload: r.payload,
    deleted: r.deleted,
    version: r.version,
  }));
  const hr = await applyRemoteHistory(historyCtx as any, remoteHistory);
  appliedCount += hr.applied;
  failed.push(...hr.failed);

  // Settings
  const settingsCtx = {
    ...ctxBase,
    librarySnapshot: async () => ({ settings: (await librarySnapshot()).settings }),
    saveSettings,
  };
  const dirtySettings = await collectDirtySettings(settingsCtx as any);
  const remoteSettings = (incomingByCollection.get("settings") ?? []).map((r: any) => ({
    rid: r.rid,
    payload: r.payload,
    deleted: r.deleted,
    version: r.version,
  }));
  const sr = await applyRemoteSettings(settingsCtx as any, remoteSettings);
  appliedCount += sr.applied;
  failed.push(...sr.failed);

  // Devices
  const devicesCtx = {
    ...ctxBase,
    librarySnapshot: async () => ({ devices: [] }),
    saveDevices: async (d: any) => {
      await ctx.storage.set({ yph_sync_devices: d });
    },
  };
  const dirtyDevices = await collectDirtyDevices(devicesCtx as any);
  const remoteDevices = (incomingByCollection.get("devices") ?? []).map((r: any) => ({
    rid: r.rid,
    payload: r.payload,
    deleted: r.deleted,
    version: r.version,
  }));
  const dr = await applyRemoteDevices(devicesCtx as any, remoteDevices);
  appliedCount += dr.applied;
  failed.push(...dr.failed);

  const allDirty: RelayRecord[] = [
    ...dirtyPlaylists,
    ...dirtyHistory,
    ...dirtySettings,
    ...dirtyDevices,
  ];

  const maxSeq =
    ctx.incoming.length > 0 ? Math.max(...ctx.incoming.map((r: any) => r.seq)) : ctx.sinceSeq;

  return { failed, appliedCount, allDirty, maxSeq };
}
