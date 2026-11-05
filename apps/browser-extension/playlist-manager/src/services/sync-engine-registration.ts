import { loadSyncConfig } from "./sync/sync-config";
import { needsV2RelayAcknowledgement } from "./sync/sync-config-compatibility";
import { verifyRelayConnection } from "./sync/sync-diagnostics";
import { clampSyncIntervalMinutes } from "./sync/sync-schedule";
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
  "yph_last_sync_report",
  "yph_system_logs",
  "yph_sync_devices",
  "yph_sync_safety_backups",
  "yt_playlist_cache_v1",
]);

function isTrustedExtensionSender(sender: any, browserObj: any): boolean {
  const runtimeId = browserObj?.runtime?.id;
  if (typeof runtimeId === "string" && runtimeId.length > 0 && sender?.id !== runtimeId) {
    return false;
  }
  if (sender?.tab?.incognito) return false;
  if (typeof sender?.url === "string" && sender.url.length > 0) {
    try {
      const source = new URL(sender.url);
      if (typeof browserObj?.runtime?.getURL === "function") {
        const root = new URL(browserObj.runtime.getURL("/"));
        if (source.protocol !== root.protocol || source.host !== root.host) return false;
      } else if (source.protocol === "http:" || source.protocol === "https:") {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

function canRunAutoSyncNow(): boolean {
  const nav = (globalThis as any).navigator;
  if (nav && nav.onLine === false) return false;
  if (nav?.connection?.saveData === true) return false;
  return true;
}

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

  let alarmRefreshSeq = 0;
  let pendingOnlineCatchUp = false;

  function runAutoSync(): Promise<SyncStatus | undefined> {
    if (!canRunAutoSyncNow()) {
      pendingOnlineCatchUp = true;
      return Promise.resolve(undefined);
    }
    pendingOnlineCatchUp = false;
    return handlers.runOnce();
  }

  async function refreshPeriodicAlarm(): Promise<void> {
    const seq = ++alarmRefreshSeq;
    try {
      await browserObj.alarms?.clear?.("yph-sync-periodic");
    } catch {
      /* ignore */
    }
    try {
      const cfg = await loadSyncConfig();
      if (seq !== alarmRefreshSeq) return;
      const interval = clampSyncIntervalMinutes(cfg?.syncIntervalMinutes, 0);
      const enabled =
        !!cfg?.syncKey &&
        Array.isArray(cfg?.backends) &&
        cfg.backends.length > 0 &&
        !needsV2RelayAcknowledgement(cfg);
      if (interval > 0 && enabled) {
        browserObj.alarms?.create?.("yph-sync-periodic", {
          delayInMinutes: interval,
          periodInMinutes: interval,
        });
      }
    } catch {
      /* ignore */
    }
  }

  refreshPeriodicAlarm().catch(() => {});
  browserObj.runtime.onInstalled?.addListener?.(() => {
    refreshPeriodicAlarm().catch(() => {});
  });
  browserObj.runtime.onStartup?.addListener?.(() => {
    refreshPeriodicAlarm().catch(() => {});
    loadSyncConfig()
      .then((cfg) => {
        if (cfg.autoSyncOnStartup !== false) return runAutoSync();
      })
      .catch(() => {});
  });

  if (typeof (globalThis as any).addEventListener === "function") {
    (globalThis as any).addEventListener("online", () => {
      if (!pendingOnlineCatchUp || !canRunAutoSyncNow()) return;
      pendingOnlineCatchUp = false;
      loadSyncConfig()
        .then((cfg) => {
          const autoEnabled =
            (cfg.syncIntervalMinutes ?? 0) > 0 ||
            cfg.autoSyncOnChange !== false ||
            cfg.autoSyncOnStartup !== false;
          if (cfg.syncKey && cfg.backends.length > 0 && autoEnabled) {
            return handlers.runOnce();
          }
        })
        .catch(() => {});
    });
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  browserObj.storage?.onChanged?.addListener?.((changes: any, area: string) => {
    if ((area !== "local" && area !== "sync") || handlers.isRunning()) return;
    const changedKeys = Object.keys(changes ?? {}).filter((k) => !IGNORED_STORAGE_KEYS.has(k));
    if (changedKeys.length === 0) return;

    if (area === "local" && changes?.yph_sync_config) {
      refreshPeriodicAlarm().catch(() => {});
      const prev = changes.yph_sync_config.oldValue;
      const next = changes.yph_sync_config.newValue;
      if (next?.autoSyncOnChange === false && debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      const onlyScheduleOrMetaChanged =
        prev &&
        next &&
        prev.syncKey === next.syncKey &&
        JSON.stringify(prev.backends) === JSON.stringify(next.backends) &&
        prev.supabaseUrl === next.supabaseUrl &&
        prev.supabaseKey === next.supabaseKey &&
        prev.conflictStrategy === next.conflictStrategy;
      if (changedKeys.length === 1 && onlyScheduleOrMetaChanged) return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      loadSyncConfig()
        .then((cfg) => {
          if (cfg.autoSyncOnChange !== false) return runAutoSync();
        })
        .catch(() => {});
    }, 3_000);
  });

  browserObj.alarms?.onAlarm?.addListener?.((alarm: any) => {
    if (alarm?.name === "yph-sync-periodic") runAutoSync().catch(() => {});
  });

  const isNativeFirefox = typeof browserObj?.runtime?.getBrowserInfo === "function";

  browserObj.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
    if (typeof request?.cmd === "string" && request.cmd.startsWith("sync-")) {
      if (!isTrustedExtensionSender(sender, browserObj)) return undefined;
    }
    if (request?.cmd === "sync-now") {
      const p = handlers
        .runOnce()
        .catch((error) => ({ phase: "error", lastError: String(error) }) as any);
      if (isNativeFirefox) return p;
      p.then((result: any) => sendResponse(result));
      return true;
    }
    if (request?.cmd === "sync-refresh-schedule") {
      const p = refreshPeriodicAlarm()
        .then(async () => {
          const alarm = await browserObj.alarms?.get?.("yph-sync-periodic");
          return {
            ok: true,
            scheduledTime: alarm?.scheduledTime ?? null,
            periodInMinutes: alarm?.periodInMinutes ?? null,
          };
        })
        .catch((error) => ({ ok: false, scheduledTime: null, error: String(error) }));
      if (isNativeFirefox) return p;
      p.then((res: any) => sendResponse(res));
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
