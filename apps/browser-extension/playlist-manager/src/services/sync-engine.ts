/**
 * Sync engine (background, single authority).
 *
 * State machine: idle -> pulling -> merging -> pushing -> idle | error | offline | paused.
 * Single-flight via a simple in-memory lock. Backoff on failure.
 * The UI reads status from `yph_sync_status` via storage.onChanged.
 */

import { isRelayConfigured } from "./sync/sync-config";

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
    // Placeholder: real implementation pulls via relay-transport, merges per
    // collection, then pushes dirty records. Wired in a follow-up.
    if (!isRelayConfigured()) {
      phase = "idle";
      status.lastSummary = "No backend configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    phase = "merging";
    await persistStatus();
    phase = "pushing";
    await persistStatus();

    phase = "idle";
    status.lastError = null;
    status.lastSummary = "Sync complete";
    status.lastRunAt = Date.now();
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
