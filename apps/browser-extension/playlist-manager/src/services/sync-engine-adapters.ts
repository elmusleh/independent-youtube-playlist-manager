/**
 * Adapter pass for the sync engine: pulls remote records, merges per collection,
 * and collects dirty records. Returns the merged outcome for the engine to persist.
 */

import { collectDirtyPlaylists, applyRemotePlaylists } from "./sync/adapters/playlists";
import { collectDirtyHistory, applyRemoteHistory } from "./sync/adapters/history";
import { collectDirtySettings, applyRemoteSettings } from "./sync/adapters/settings";
import { collectDirtyDevices, applyRemoteDevices } from "./sync/adapters/devices";
import { createSyncStorageBridge } from "./sync/adapter-storage-io";
import { RECORD_VERSION } from "./sync/record-codec";
import { deleteShadow, setShadow } from "./sync/shadow-store";
import { captureSyncSafetyBackup } from "./sync/sync-safety-backup";
import type { PushResult, RelayRecord } from "./sync/relay-transport";
import type { DirtyCandidate } from "./sync/adapters/types";

const KNOWN_COLLECTIONS = new Set(["playlists", "history", "settings", "devices"]);

function isFutureVersionPayload(payload: unknown): boolean {
  if (typeof payload !== "string" || !payload.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(payload) as { v?: unknown };
    return typeof parsed?.v === "number" && parsed.v > RECORD_VERSION;
  } catch {
    return false;
  }
}

export type CategoryProgressMap = {
  playlists: { processed: number; applied: number; total: number };
  settings: { processed: number; applied: number; total: number };
  history: { processed: number; applied: number; total: number };
  devices: { processed: number; applied: number; total: number };
};

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
  onProgress?: (progress: CategoryProgressMap) => Promise<void> | void;
};

export type AdapterPassResult = {
  failed: string[];
  conflicts: string[];
  appliedCount: number;
  allDirty: RelayRecord[];
  dirtyCandidates: DirtyCandidate[];
  maxSeq: number;
  cursorBlocked: boolean;
  categoryProgress: CategoryProgressMap;
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
  for (const [key, count] of resultCounts) {
    if (count > 1) failed.push(`${key}: duplicate relay result (expected exactly one)`);
  }
  for (const result of results) {
    const key = `${result.collection}|${result.rid}`;
    if (!expectedSet.has(key)) failed.push(`${key}: unexpected relay result`);
  }
  for (const key of expectedKeys) {
    if (!resultCounts.has(key)) failed.push(`${key}: missing relay result`);
  }
  if (failed.length > 0) return failed;

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
  const conflicts: string[] = [];
  const dirtyCandidates: DirtyCandidate[] = [];
  let appliedCount = 0;

  const { librarySnapshot, mutateLibrary, saveSettings, saveHistory } = createSyncStorageBridge();

  if (
    ctx.incoming.length > 0 &&
    (!ctx.cfg?.lastSyncedAt ||
      ctx.sinceSeq === 0 ||
      ctx.incoming.some((r: any) => r.deleted || r.collection === "playlists"))
  ) {
    const reason =
      !ctx.cfg?.lastSyncedAt || ctx.sinceSeq === 0
        ? "Auto backup before full sync"
        : "Auto backup before remote playlist merge";
    await captureSyncSafetyBackup(reason).catch(() => {});
  }

  let hasDeferredFutureRecords = false;
  const incomingByCollection = new Map<string, any[]>();
  for (const r of ctx.incoming) {
    if (!KNOWN_COLLECTIONS.has(r.collection) || isFutureVersionPayload(r.payload)) {
      hasDeferredFutureRecords = true;
      continue;
    }
    if (!incomingByCollection.has(r.collection)) incomingByCollection.set(r.collection, []);
    incomingByCollection.get(r.collection)!.push(r);
  }

  const categoryProgress: CategoryProgressMap = {
    playlists: {
      processed: 0,
      applied: 0,
      total: (incomingByCollection.get("playlists") ?? []).length,
    },
    settings: {
      processed: 0,
      applied: 0,
      total: (incomingByCollection.get("settings") ?? []).length,
    },
    history: {
      processed: 0,
      applied: 0,
      total: (incomingByCollection.get("history") ?? []).length,
    },
    devices: {
      processed: 0,
      applied: 0,
      total: (incomingByCollection.get("devices") ?? []).length,
    },
  };

  const hlcState = { lastHlc: undefined as any };
  const conflictStrategy = ctx.cfg?.conflictStrategy === "lww" ? "lww" : "merge";
  const ctxBase = {
    syncKey: ctx.syncKey,
    localDeviceId: ctx.localDeviceId,
    conflictStrategy,
    hlcState,
  };
  const content = ctx.cfg?.content ?? { playlists: true, settings: true, history: true };
  const toRemoteBatch = (coll: string) =>
    (incomingByCollection.get(coll) ?? []).map((r: any) => ({
      rid: r.rid,
      payload: r.payload,
      deleted: r.deleted,
      version: r.version,
    }));

  if (content.playlists !== false) {
    const playlistCtx = {
      ...ctxBase,
      allowEmptyLibrarySync: !!ctx.cfg?.allowEmptyLibrarySync,
      relayConfig: ctx.relayConfig,
      librarySnapshot: async () => {
        const snap = await librarySnapshot();
        return { playlists: snap.playlists, revision: snap.revision };
      },
      mutateLibrary,
    };
    const remotePlaylists = toRemoteBatch("playlists");
    const pr = await applyRemotePlaylists(playlistCtx as any, remotePlaylists);
    appliedCount += pr.applied;
    failed.push(...pr.failed);
    if (pr.conflicts?.length) conflicts.push(...pr.conflicts);
    const dirtyPlaylists = await collectDirtyPlaylists(playlistCtx as any);
    dirtyCandidates.push(...dirtyPlaylists);
    categoryProgress.playlists = {
      processed: remotePlaylists.length,
      applied: pr.applied,
      total: remotePlaylists.length + dirtyPlaylists.length,
    };
    await ctx.onProgress?.(categoryProgress);
  }

  if (content.history === true) {
    const historyCtx = {
      ...ctxBase,
      librarySnapshot: async () => ({ history: (await librarySnapshot()).history }),
      saveHistory,
    };
    const remoteHistory = toRemoteBatch("history");
    const hr = await applyRemoteHistory(historyCtx as any, remoteHistory);
    appliedCount += hr.applied;
    failed.push(...hr.failed);
    const dirtyHistory = await collectDirtyHistory(historyCtx as any);
    dirtyCandidates.push(...dirtyHistory);
    categoryProgress.history = {
      processed: remoteHistory.length,
      applied: hr.applied,
      total: remoteHistory.length + dirtyHistory.length,
    };
    await ctx.onProgress?.(categoryProgress);
  }

  if (content.settings === true) {
    const settingsCtx = {
      ...ctxBase,
      librarySnapshot: async () => ({ settings: (await librarySnapshot()).settings }),
      saveSettings,
    };
    const remoteSettings = toRemoteBatch("settings");
    const sr = await applyRemoteSettings(settingsCtx as any, remoteSettings);
    appliedCount += sr.applied;
    failed.push(...sr.failed);
    const dirtySettings = await collectDirtySettings(settingsCtx as any);
    dirtyCandidates.push(...dirtySettings);
    categoryProgress.settings = {
      processed: remoteSettings.length,
      applied: sr.applied,
      total: remoteSettings.length + dirtySettings.length,
    };
    await ctx.onProgress?.(categoryProgress);
  }

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
  const remoteDevices = toRemoteBatch("devices");
  const dr = await applyRemoteDevices(devicesCtx as any, remoteDevices);
  appliedCount += dr.applied;
  failed.push(...dr.failed);
  const dirtyDevices = await collectDirtyDevices(devicesCtx as any);
  dirtyCandidates.push(...dirtyDevices);
  categoryProgress.devices = {
    processed: remoteDevices.length,
    applied: dr.applied,
    total: remoteDevices.length + dirtyDevices.length,
  };
  await ctx.onProgress?.(categoryProgress);

  const maxSeq =
    ctx.incoming.length > 0 ? Math.max(...ctx.incoming.map((r: any) => r.seq)) : ctx.sinceSeq;
  const cursorBlocked =
    hasDeferredFutureRecords ||
    ctx.incoming.some((record: any) => {
      if (record.collection === "devices" || !KNOWN_COLLECTIONS.has(record.collection))
        return false;
      return (
        content[record.collection as "playlists" | "history" | "settings"] !== true &&
        !(record.collection === "playlists" && content.playlists !== false)
      );
    });

  return {
    failed,
    conflicts,
    appliedCount,
    allDirty: dirtyCandidates.map((candidate) => candidate.record),
    dirtyCandidates,
    maxSeq,
    cursorBlocked,
    categoryProgress,
  };
}
