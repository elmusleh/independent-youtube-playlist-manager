/**
 * Sync engine (background, single authority).
 *
 * State machine: idle -> pulling -> merging -> pushing -> idle | error | offline | paused.
 * Single-flight via a simple in-memory lock. Backoff on failure.
 * The UI reads status from `yph_sync_status` via storage.onChanged.
 */

import { isRelayConfigured, loadSyncConfig, getOrCreateDeviceId } from "./sync/sync-config";
import { runAdapterPass } from "./sync-engine-adapters";
import { deriveKeys, computeStorageAddress, computeAuthToken } from "./sync/keys";
import type { RelayRecord } from "./sync/relay-transport";
import { claimSpace, pullAll, pushAll } from "./sync/relay-transport";

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

  // Configure periodic alarm from sync config (interval 0 = manual only).
  async function refreshPeriodicAlarm(): Promise<void> {
    try {
      browserObj.alarms?.clear?.("yph-sync-periodic");
    } catch {
      /* ignore */
    }
    try {
      const cfg = await loadSyncConfig();
      const interval = typeof cfg?.syncIntervalMinutes === "number" ? cfg.syncIntervalMinutes : 0;
      const enabled = !!cfg?.syncKey && Array.isArray(cfg?.backends) && cfg.backends.length > 0;
      if (interval > 0 && enabled) {
        browserObj.alarms?.create?.("yph-sync-periodic", { periodInMinutes: interval });
      }
    } catch {
      /* ignore */
    }
  }
  refreshPeriodicAlarm().catch(() => {});

  // Run once on startup.
  browserObj.runtime.onStartup?.addListener?.(() => {
    runOnce().catch(() => {});
  });

  // Debounced push on storage change.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  browserObj.storage?.onChanged?.addListener?.((changes: any, area: string) => {
    if (area !== "local") return;
    // Ignore change events that fire while a sync pass is in flight (self-trigger).
    if (isRunning) return;
    // Our own status writes must never re-trigger a sync pass (H3).
    if (changes?.yph_sync_status) return;
    if (area === "local" && changes?.yph_sync_config) {
      refreshPeriodicAlarm().catch(() => {});
    }
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
    const storage =
      (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
    if (!storage) throw new Error("storage unavailable");

    const cfg = (await getStorage()?.get("yph_sync_config")) ?? {};
    const syncKey = cfg?.syncKey;
    const backends = Array.isArray(cfg?.backends) ? cfg.backends : [];

    if (!syncKey || backends.length === 0) {
      phase = "idle";
      status.lastError = null;
      status.lastSummary =
        backends.length === 0 ? "Offline mode (sync disabled)" : "No sync key configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    if (!isRelayConfigured() && backends.includes("relay") && backends.length === 1) {
      phase = "idle";
      status.lastSummary = "No backend configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    if (!isRelayConfigured() && !backends.includes("relay")) {
      // non-relay backends handled elsewhere; nothing to do here
      phase = "idle";
      status.lastSummary = "No backend configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    const space = await computeStorageAddress(syncKey);
    const authHash = await computeAuthToken(syncKey, space);
    const relayConfig = {
      url:
        (backends.includes("supabase-byo") && cfg?.supabaseUrl) ||
        cfg?.relayUrl ||
        "https://qvwitlpnetwthyhrobca.supabase.co",
      anonKey:
        (backends.includes("supabase-byo") && cfg?.supabaseKey) ||
        cfg?.relayAnonKey ||
        "sb_publishable_HV50FQtJrkoNcKLsFk5BHQ_KUU2GeKb",
    };

    await claimSpace(relayConfig, space, authHash);

    const localDeviceId = await getOrCreateDeviceId();

    phase = "pulling";
    await persistStatus();
    const sinceSeq = cfg?.lastSeq ?? 0;
    const incoming = await pullAll(relayConfig, space, authHash, sinceSeq);

    phase = "merging";
    await persistStatus();

    const result = await runAdapterPass({
      syncKey,
      localDeviceId,
      relayConfig,
      space,
      authHash,
      incoming,
      sinceSeq,
      storage,
      cfg,
    });

    phase = "pushing";
    await persistStatus();

    if (result.allDirty.length > 0) {
      await pushAll(relayConfig, space, authHash, result.allDirty);
      // Notify peers via Realtime broadcast (best-effort, no data).
      try {
        const { broadcastSyncNudge } = await import("./sync/realtime-nudge");
        await broadcastSyncNudge(syncKey, { url: relayConfig.url, anonKey: relayConfig.anonKey });
      } catch {
        /* best-effort */
      }
    }

    if (incoming.length > 0 && result.failed.length === 0) {
      cfg.lastSeq = result.maxSeq;
      await storage.set({ yph_sync_config: cfg });
    } else if (incoming.length > 0 && result.failed.length > 0) {
      // Keep lastSeq unchanged so failed records are re-pulled next run.
      status.lastError = result.failed.join("; ");
    }

    phase = "idle";
    status.lastError = result.failed.length ? result.failed.join("; ") : null;
    status.lastSummary = result.failed.length
      ? `Partial: ${result.failed.join("; ")}`
      : `Synced ${result.appliedCount} records`;
    status.lastRunAt = Date.now();
    status.pendingCount = 0;
    status.failedCount = result.failed.length;
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
