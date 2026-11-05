import { loadSyncConfig } from "./sync/sync-config";
import { needsV2RelayAcknowledgement } from "./sync/sync-config-compatibility";
import { verifyRelayConnection } from "./sync/sync-diagnostics";
import type { SyncStatus } from "./sync-engine";

type SyncEngineHandlers = {
  runOnce: () => Promise<SyncStatus>;
  scheduleRun: (delayMs?: number) => void;
  pause: () => void;
  resume: () => void;
  getStatus: () => SyncStatus;
  isRunning: () => boolean;
};

const IGNORED_STORAGE_KEYS = new Set([
  "yph_sync_status",
  "yph_system_logs",
  "yph_sync_devices",
  "yph_sync_safety_backups",
  "yt_playlist_cache_v1",
]);

/** Register engine triggers and the runtime message bridge in the background context. */
export function registerSyncEngine(handlers: SyncEngineHandlers): void {
  const browserObj = (globalThis as any).browser || (globalThis as any).chrome;
  if (!browserObj?.runtime) return;

  if (typeof (globalThis as any).window === "undefined") {
    (globalThis as any).window = globalThis;
  }
  const host = (globalThis as any).window || globalThis;
  host.syncEngine = {
    runOnce: handlers.runOnce,
    scheduleRun: handlers.scheduleRun,
    pause: handlers.pause,
    resume: handlers.resume,
    getStatus: handlers.getStatus,
    triggerSync: handlers.runOnce,
  };

  const pathname = (globalThis as any).location?.pathname ?? "";
  if (pathname.endsWith("/editor/index.html") || pathname.endsWith("/popup/popup.html")) {
    return;
  }

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
    if ((area !== "local" && area !== "sync") || handlers.isRunning()) return;
    const changedKeys = Object.keys(changes ?? {}).filter((k) => !IGNORED_STORAGE_KEYS.has(k));
    if (changedKeys.length === 0) return;

    if (area === "local" && changes?.yph_sync_config) {
      refreshPeriodicAlarm().catch(() => {});
      const prev = changes.yph_sync_config.oldValue;
      const next = changes.yph_sync_config.newValue;
      const onlyCursorOrMetaChanged =
        prev &&
        next &&
        prev.syncKey === next.syncKey &&
        JSON.stringify(prev.backends) === JSON.stringify(next.backends) &&
        prev.supabaseUrl === next.supabaseUrl &&
        prev.supabaseKey === next.supabaseKey &&
        prev.conflictStrategy === next.conflictStrategy;
      if (changedKeys.length === 1 && onlyCursorOrMetaChanged) return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      handlers.runOnce().catch(() => {});
    }, 3_000);
  });

  browserObj.alarms?.onAlarm?.addListener?.((alarm: any) => {
    if (alarm?.name === "yph-sync-periodic") handlers.runOnce().catch(() => {});
  });

  const isNativeFirefox = typeof browserObj?.runtime?.getBrowserInfo === "function";

  browserObj.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
    if (request?.cmd === "sync-now") {
      const p = handlers
        .runOnce()
        .catch((error) => ({ phase: "error", lastError: String(error) }) as any);
      if (isNativeFirefox) return p;
      p.then((result: any) => sendResponse(result));
      return true;
    }
    if (request?.cmd === "sync-test-connection") {
      const p = loadSyncConfig()
        .then((cfg) => verifyRelayConnection(cfg, request?.targetBackend))
        .catch((error) => ({ ok: false, error: String(error), summary: String(error) }));
      if (isNativeFirefox) return p;
      p.then((res: any) => sendResponse(res));
      return true;
    }
    if (request?.cmd === "sync-pause") {
      handlers.pause();
      if (isNativeFirefox) return Promise.resolve(handlers.getStatus());
      sendResponse(handlers.getStatus());
      return false;
    }
    if (request?.cmd === "sync-status") {
      if (isNativeFirefox) return Promise.resolve(handlers.getStatus());
      sendResponse(handlers.getStatus());
      return false;
    }
    return undefined;
  });
}
