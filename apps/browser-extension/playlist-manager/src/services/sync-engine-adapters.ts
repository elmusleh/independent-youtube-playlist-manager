/**
 * Adapter pass for the sync engine: pulls remote records, merges per collection,
 * and pushes dirty records. Returns the merged outcome for the engine to persist.
 */

import { collectDirtyPlaylists, applyRemotePlaylists } from "./sync/adapters/playlists";
import { collectDirtyHistory, applyRemoteHistory } from "./sync/adapters/history";
import { collectDirtySettings, applyRemoteSettings } from "./sync/adapters/settings";
import { collectDirtyDevices, applyRemoteDevices } from "./sync/adapters/devices";
import { deleteShadow, setShadow } from "./sync/shadow-store";
import { librarySnapshot as readLibrarySnapshot } from "../../../shared/storage-client.js";
import type { PushResult, RelayRecord } from "./sync/relay-transport";
import type { DirtyCandidate } from "./sync/adapters/types";

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
  dirtyCandidates: DirtyCandidate[];
  maxSeq: number;
  cursorBlocked: boolean;
};

export async function acknowledgePushedCandidates(
  candidates: DirtyCandidate[],
  results: PushResult[],
  localDeviceId: string
): Promise<string[]> {
  const expectedKeys = candidates.map(
    (candidate) => `${candidate.record.collection}|${candidate.record.rid}`
  );
  const expectedSet = new Set(expectedKeys);
  const resultCounts = new Map<string, number>();
  for (const result of results) {
    const key = `${result.collection}|${result.rid}`;
    resultCounts.set(key, (resultCounts.get(key) ?? 0) + 1);
  }

  const failed: string[] = [];

  // Reject duplicate relay results for any record.
  for (const [key, count] of resultCounts) {
    if (count > 1) {
      failed.push(`${key}: duplicate relay result (expected exactly one)`);
    }
  }
  // Reject relay results that do not correspond to a pushed candidate.
  for (const result of results) {
    const key = `${result.collection}|${result.rid}`;
    if (!expectedSet.has(key)) {
      failed.push(`${key}: unexpected relay result`);
    }
  }
  // Reject pushed candidates that have no matching relay result.
  for (const key of expectedKeys) {
    if (!resultCounts.has(key)) {
      failed.push(`${key}: missing relay result`);
    }
  }

  if (failed.length > 0) {
    return failed;
  }

  const resultByRecord = new Map(
    results.map((result) => [`${result.collection}|${result.rid}`, result])
  );

  for (const candidate of candidates) {
    const result = resultByRecord.get(`${candidate.record.collection}|${candidate.record.rid}`)!;
    if (result.status !== "ok") {
      failed.push(
        `${candidate.collection}/${candidate.recordId}: ${result.status}${result.message ? ` (${result.message})` : ""}`
      );
      continue;
    }

    try {
      if (candidate.deleted) {
        await deleteShadow(candidate.collection, candidate.recordId);
      } else {
        await setShadow(
          candidate.collection,
          candidate.recordId,
          candidate.value,
          candidate.version,
          localDeviceId
        );
      }
    } catch (error) {
      failed.push(
        `${candidate.collection}/${candidate.recordId}: shadow acknowledgement failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return failed;
}

export async function runAdapterPass(ctx: AdapterPassContext): Promise<AdapterPassResult> {
  const failed: string[] = [];
  const dirtyCandidates: DirtyCandidate[] = [];
  let appliedCount = 0;

  const librarySnapshot = async () => {
    const w = (globalThis as any).window;
    const snapshot = await readLibrarySnapshot();
    const settings = w?.getSettings ? await w.getSettings() : {};
    const historyObj = await (async () => {
      const b = (globalThis as any).browser || (globalThis as any).chrome;
      if (b?.storage?.local) {
        const stored = await b.storage.local.get("local_yt_history");
        return stored?.local_yt_history ?? {};
      }
      return {};
    })();
    return {
      playlists: snapshot.playlists,
      settings,
      history: historyObj ?? {},
      revision: snapshot.revision,
    };
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
  const saveSettings = async (s: Record<string, unknown>, deletedKeys: string[] = []) => {
    const w = (globalThis as any).window;
    if (w?.storeObject) {
      for (const [k, v] of Object.entries(s)) await w.storeObject(k, v);
    } else {
      const b = (globalThis as any).browser || (globalThis as any).chrome;
      if (b?.storage?.sync?.set) {
        try {
          await b.storage.sync.set(s);
        } catch {
          await b.storage.local?.set(s);
        }
      } else {
        await b?.storage?.local?.set(s);
      }
    }
    for (const key of deletedKeys) {
      if (w?.removeObject) {
        await w.removeObject(key);
        continue;
      }
      const b = (globalThis as any).browser || (globalThis as any).chrome;
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

  const content = ctx.cfg?.content ?? { playlists: true, settings: true, history: true };

  // Playlists
  if (content.playlists !== false) {
    const playlistCtx = {
      ...ctxBase,
      relayConfig: ctx.relayConfig,
      librarySnapshot: async () => {
        const snap = await librarySnapshot();
        return { playlists: snap.playlists, revision: snap.revision };
      },
      mutateLibrary,
    };
    const remotePlaylists = (incomingByCollection.get("playlists") ?? []).map((r: any) => ({
      rid: r.rid,
      payload: r.payload,
      deleted: r.deleted,
      version: r.version,
    }));
    const pr = await applyRemotePlaylists(playlistCtx as any, remotePlaylists);
    appliedCount += pr.applied;
    failed.push(...pr.failed);

    const dirtyPlaylists = await collectDirtyPlaylists(playlistCtx as any);
    dirtyCandidates.push(...dirtyPlaylists);
  }

  // History
  if (content.history === true) {
    const historyCtx = {
      ...ctxBase,
      librarySnapshot: async () => ({ history: (await librarySnapshot()).history }),
      saveHistory,
    };
    const remoteHistory = (incomingByCollection.get("history") ?? []).map((r: any) => ({
      rid: r.rid,
      payload: r.payload,
      deleted: r.deleted,
      version: r.version,
    }));
    const hr = await applyRemoteHistory(historyCtx as any, remoteHistory);
    appliedCount += hr.applied;
    failed.push(...hr.failed);

    const dirtyHistory = await collectDirtyHistory(historyCtx as any);
    dirtyCandidates.push(...dirtyHistory);
  }

  // Settings
  if (content.settings === true) {
    const settingsCtx = {
      ...ctxBase,
      librarySnapshot: async () => ({ settings: (await librarySnapshot()).settings }),
      saveSettings,
    };
    const remoteSettings = (incomingByCollection.get("settings") ?? []).map((r: any) => ({
      rid: r.rid,
      payload: r.payload,
      deleted: r.deleted,
      version: r.version,
    }));
    const sr = await applyRemoteSettings(settingsCtx as any, remoteSettings);
    appliedCount += sr.applied;
    failed.push(...sr.failed);

    const dirtySettings = await collectDirtySettings(settingsCtx as any);
    dirtyCandidates.push(...dirtySettings);
  }

  // Devices (always sync)
  const devicesCtx = {
    ...ctxBase,
    platform: (globalThis as any).navigator?.platform ?? "unknown",
    librarySnapshot: async () => {
      const stored = await ctx.storage.get("yph_sync_devices");
      const devices = Array.isArray(stored?.yph_sync_devices)
        ? stored.yph_sync_devices
        : Array.isArray(stored)
          ? stored
          : [];
      return { devices };
    },
    saveDevices: async (d: any) => {
      await ctx.storage.set({ yph_sync_devices: d });
    },
  };
  const remoteDevices = (incomingByCollection.get("devices") ?? []).map((r: any) => ({
    rid: r.rid,
    payload: r.payload,
    deleted: r.deleted,
    version: r.version,
  }));
  const dr = await applyRemoteDevices(devicesCtx as any, remoteDevices);
  appliedCount += dr.applied;
  failed.push(...dr.failed);

  const dirtyDevices = await collectDirtyDevices(devicesCtx as any);
  dirtyCandidates.push(...dirtyDevices);

  const maxSeq =
    ctx.incoming.length > 0 ? Math.max(...ctx.incoming.map((r: any) => r.seq)) : ctx.sinceSeq;
  const cursorBlocked = ctx.incoming.some((record: any) => {
    if (record.collection === "devices") return false;
    return (
      content[record.collection as "playlists" | "history" | "settings"] !== true &&
      !(record.collection === "playlists" && content.playlists !== false)
    );
  });

  return {
    failed,
    appliedCount,
    allDirty: dirtyCandidates.map((candidate) => candidate.record),
    dirtyCandidates,
    maxSeq,
    cursorBlocked,
  };
}
