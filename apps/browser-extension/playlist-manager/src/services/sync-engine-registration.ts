import { loadSyncConfig } from "./sync/sync-config";
import { needsV2RelayAcknowledgement } from "./sync/sync-config-compatibility";
import type { SyncStatus } from "./sync-engine";

type SyncEngineHandlers = {
  runOnce: () => Promise<SyncStatus>;
  scheduleRun: (delayMs?: number) => void;
  pause: () => void;
  resume: () => void;
  getStatus: () => SyncStatus;
  isRunning: () => boolean;
};

/** Register engine triggers and the runtime message bridge in the background context. */
export function registerSyncEngine(handlers: SyncEngineHandlers): void {
  const browserObj = (globalThis as any).browser || (globalThis as any).chrome;
  if (!browserObj?.runtime) return;

  (globalThis as any).window = (globalThis as any).window || globalThis;
  (globalThis as any).window.syncEngine = {
    runOnce: handlers.runOnce,
    scheduleRun: handlers.scheduleRun,
    pause: handlers.pause,
    resume: handlers.resume,
    getStatus: handlers.getStatus,
    triggerSync: handlers.runOnce,
  };

  async function refreshPeriodicAlarm(): Promise<void> {
    try {
      browserObj.alarms?.clear?.("yph-sync-periodic");
    } catch {
      /* ignore */
    }
    try {
      const cfg = await loadSyncConfig();
      const interval = typeof cfg?.syncIntervalMinutes === "number" ? cfg.syncIntervalMinutes : 0;
      const enabled =
        !!cfg?.syncKey &&
        Array.isArray(cfg?.backends) &&
        cfg.backends.length > 0 &&
        !needsV2RelayAcknowledgement(cfg);
      if (interval > 0 && enabled) {
        browserObj.alarms?.create?.("yph-sync-periodic", { periodInMinutes: interval });
      }
    } catch {
      /* ignore */
    }
  }

  refreshPeriodicAlarm().catch(() => {});
  browserObj.runtime.onStartup?.addListener?.(() => {
    handlers.runOnce().catch(() => {});
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  browserObj.storage?.onChanged?.addListener?.((changes: any, area: string) => {
    if (area !== "local" || handlers.isRunning()) return;
    if (changes?.yph_sync_status) return;
    if (changes?.yph_sync_config) refreshPeriodicAlarm().catch(() => {});
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      handlers.runOnce().catch(() => {});
    }, 3_000);
  });

  browserObj.alarms?.onAlarm?.addListener?.((alarm: any) => {
    if (alarm?.name === "yph-sync-periodic") handlers.runOnce().catch(() => {});
  });

  browserObj.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
    if (request?.cmd === "sync-now") {
      handlers
        .runOnce()
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ phase: "error", lastError: String(error) }));
      return true;
    }
    if (request?.cmd === "sync-pause") {
      handlers.pause();
      sendResponse(handlers.getStatus());
      return false;
    }
    if (request?.cmd === "sync-status") {
      sendResponse(handlers.getStatus());
      return false;
    }
    return undefined;
  });
}
