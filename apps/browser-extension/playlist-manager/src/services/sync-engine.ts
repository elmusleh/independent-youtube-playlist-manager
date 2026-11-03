/**
 * Sync engine (background, single authority).
 *
 * State machine: idle -> pulling -> merging -> pushing -> idle | error | offline | paused.
 * Single-flight via a simple in-memory lock. Backoff on failure.
 * The UI reads status from `yph_sync_status` via storage.onChanged.
 */

import { isRelayConfigured } from "./sync/sync-config";
import { collectDirtyPlaylists, applyRemotePlaylists } from "./sync/adapters/playlists";
import { collectDirtyHistory, applyRemoteHistory } from "./sync/adapters/history";
import { collectDirtySettings, applyRemoteSettings } from "./sync/adapters/settings";
import { deriveKeys, computeRecordId, computeStorageAddress, computeAuthToken } from "./sync/keys";
import type { RelayRecord } from "./sync/relay-transport";
import { claimSpace, pullAll, pushAll, deleteSpace } from "./sync/relay-transport";

export type SyncPhase = "idle" | "pulling" | "merging" | "pushing" | "error" | "offline" | "paused";

export type SyncStatus = {
  phase: SyncPhase;
  lastRunAt: number | null;
  lastError: string | null;
  lastSummary: string | null;
  pendingCount: number;
  incomingCount: number;
  failedCount: number;
};

const STATUS_KEY = "yph_sync_status";
const BACKOFF_STEPS = [30_000, 60_000, 300_000, 900_000];

let phase: SyncPhase = "idle";
let isRunning = false;
let backoffIndex = 0;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let status: SyncStatus = {
  phase: "idle",
  lastRunAt: null,
  lastError: null,
  lastSummary: null,
  pendingCount: 0,
  incomingCount: 0,
  failedCount: 0,
};

function getStorage(): { get: (k: string) => Promise<any>; set: (o: any) => Promise<void> } | null {
  const b = (globalThis as any).browser || (globalThis as any).chrome;
  if (!b?.storage?.local) return null;
  return {
    get: (k) => b.storage.local.get(k).then((r: any) => r?.[k]),
    set: (o) => b.storage.local.set(o),
  };
}

async function persistStatus(): Promise<void> {
  const s = getStorage();
  if (!s) return;
  status.phase = phase;
  try {
    await s.set({ [STATUS_KEY]: status });
  } catch {
    /* ignore */
  }
}

export function getStatus(): SyncStatus {
  return { ...status };
}

// ---------------------------------------------------------------------------
// Registration: expose on window and wire alarms / triggers (browser only).
// ---------------------------------------------------------------------------

const browserObj = (globalThis as any).browser || (globalThis as any).chrome;

if (browserObj?.runtime) {
  // Expose for the legacy alarm handler and UI messaging.
  (globalThis as any).window = (globalThis as any).window || globalThis;
  (globalThis as any).window.syncEngine = {
    runOnce,
    scheduleRun,
    pause,
    resume,
    getStatus,
    triggerSync: runOnce,
  };

  // Periodic pull every 5 minutes.
  try {
    browserObj.alarms?.create?.("yph-sync-periodic", { periodInMinutes: 5 });
  } catch {
    /* ignore */
  }

  // Run once on startup.
  browserObj.runtime.onStartup?.addListener?.(() => {
    runOnce().catch(() => {});
  });

  // Debounced push on storage change.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  browserObj.storage?.onChanged?.addListener?.(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runOnce().catch(() => {});
    }, 3_000);
  });

  // Alarm handler for the periodic sync.
  browserObj.alarms?.onAlarm?.addListener?.((alarm: any) => {
    if (alarm?.name === "yph-sync-periodic") {
      runOnce().catch(() => {});
    }
  });

  // Message commands for the UI.
  browserObj.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
    if (request?.cmd === "sync-now") {
      runOnce()
        .then((s) => sendResponse(s))
        .catch((e) => sendResponse({ phase: "error", lastError: String(e) }));
      return true;
    }
    if (request?.cmd === "sync-pause") {
      pause();
      sendResponse(getStatus());
      return false;
    }
    if (request?.cmd === "sync-status") {
      sendResponse(getStatus());
      return false;
    }
    return undefined;
  });
}

export async function runOnce(): Promise<SyncStatus> {
  if (isRunning) return getStatus();
  isRunning = true;
  phase = "pulling";
  await persistStatus();

  try {
    if (!isRelayConfigured()) {
      phase = "idle";
      status.lastSummary = "No backend configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    const storage =
      (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
    if (!storage) throw new Error("storage unavailable");

    // Load sync config from storage.
    const cfg = (await storage.get("yph_sync_config")) ?? {};
    const syncKey = cfg?.syncKey;
    if (!syncKey) {
      phase = "idle";
      status.lastSummary = "No sync key configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    const space = await computeStorageAddress(syncKey);
    const authHash = await computeAuthToken(syncKey, space);
    const relayConfig = {
      url: cfg?.relayUrl ?? "https://qvwitlpnetwthyhrobca.supabase.co",
      anonKey: cfg?.relayAnonKey ?? "sb_publishable_HV50FQtJrkoNcKLsFk5BHQ_KUU2GeKb",
    };

    // Claim the space (idempotent).
    await claimSpace(relayConfig, space, authHash);

    const localDeviceId = (await storage.get("yph_sync_device_id")) || "unknown";

    const ctxBase = {
      syncKey,
      localDeviceId,
    };

    // Phase: pulling
    phase = "pulling";
    await persistStatus();
    const sinceSeq = cfg?.lastSeq ?? 0;
    const incoming = await pullAll(relayConfig, space, authHash, sinceSeq);

    // Phase: merging
    phase = "merging";
    await persistStatus();

    // Build adapter contexts using window globals.
    const librarySnapshot = async () => {
      const w = (globalThis as any).window;
      const playlists = w?.getPlaylists ? await w.getPlaylists() : [];
      const settings = w?.getSettings ? await w.getSettings() : {};
      const historyObj = w?.getSyncSnapshot ? await w.getSyncSnapshot("history") : {};
      return { playlists, settings, history: historyObj ?? {} };
    };
    const mutateLibrary = async (op: any) => {
      const w = (globalThis as any).window;
      if (w?.mutateLibrary) return w.mutateLibrary(op);
      // fallback via runtime message
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

    // Apply remote records per collection.
    const incomingByCollection = new Map<string, typeof incoming>();
    for (const r of incoming) {
      if (!incomingByCollection.has(r.collection)) incomingByCollection.set(r.collection, []);
      incomingByCollection.get(r.collection)!.push(r);
    }

    let failed: string[] = [];
    let appliedCount = 0;

    // Playlists
    const playlistCtx = {
      ...ctxBase,
      relayConfig,
      librarySnapshot: async () => ({ playlists: (await librarySnapshot()).playlists }),
      mutateLibrary,
    };
    const dirtyPlaylists = await collectDirtyPlaylists(playlistCtx as any);
    const remotePlaylists = (incomingByCollection.get("playlists") ?? []).map((r) => ({
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
    const remoteHistory = (incomingByCollection.get("history") ?? []).map((r) => ({
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
    const remoteSettings = (incomingByCollection.get("settings") ?? []).map((r) => ({
      rid: r.rid,
      payload: r.payload,
      deleted: r.deleted,
      version: r.version,
    }));
    const sr = await applyRemoteSettings(settingsCtx as any, remoteSettings);
    appliedCount += sr.applied;
    failed.push(...sr.failed);

    // Phase: pushing
    phase = "pushing";
    await persistStatus();

    const allDirty: RelayRecord[] = [...dirtyPlaylists, ...dirtyHistory, ...dirtySettings];
    if (allDirty.length > 0) {
      await pushAll(relayConfig, space, authHash, allDirty);
    }

    // Update lastSeq
    if (incoming.length > 0) {
      const maxSeq = Math.max(...incoming.map((r) => r.seq));
      cfg.lastSeq = maxSeq;
      await storage.set({ yph_sync_config: cfg });
    }

    phase = "idle";
    status.lastError = failed.length ? failed.join("; ") : null;
    status.lastSummary = failed.length
      ? `Partial: ${failed.join("; ")}`
      : `Synced ${appliedCount} records`;
    status.lastRunAt = Date.now();
    status.pendingCount = 0;
    status.failedCount = failed.length;
    backoffIndex = 0;
  } catch (err) {
    phase = "error";
    status.lastError = err instanceof Error ? err.message : String(err);
    status.lastSummary = `Sync failed: ${status.lastError}`;
    status.lastRunAt = Date.now();
    backoffIndex = Math.min(backoffIndex + 1, BACKOFF_STEPS.length - 1);
  } finally {
    isRunning = false;
    await persistStatus();
  }
  return getStatus();
}

export function scheduleRun(delayMs?: number): void {
  if (backoffTimer) return;
  const delay = delayMs ?? (phase === "error" ? BACKOFF_STEPS[backoffIndex] : 5_000);
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    runOnce().catch(() => {});
  }, delay);
}

export function pause(): void {
  phase = "paused";
  persistStatus();
}

export function resume(): void {
  if (phase === "paused") phase = "idle";
  scheduleRun(0);
}
