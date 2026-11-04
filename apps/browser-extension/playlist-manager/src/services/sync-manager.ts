/**
 * Auto-sync manager: debounced sync after local changes, plus periodic pull.
 *
 * Reads the durable sync config (browser.storage.local), builds a transport for each
 * enabled backend (hosted relay / Supabase BYO / File-Syncthing), and mirrors the same
 * encrypted snapshot across them — write to every backend, read the newest from any.
 * Before applying a pulled snapshot it takes a local pre-import backup.
 */

import { EncryptedSyncService } from "./sync/encrypted-sync-service.js";
import { FileSyncService, loadFolderHandle } from "./sync/file-sync-service.js";
import { createAnonClient } from "./supabase-client.js";
import { computeStorageAddress } from "./sync/keys.js";
import { generateSyncKey } from "./sync/sync-key.js";
import {
  loadSyncConfig,
  saveSyncConfig,
  getOrCreateDeviceId,
  isRelayConfigured,
  RELAY_SUPABASE_URL,
  RELAY_SUPABASE_ANON_KEY,
  type SyncConfig,
  type SyncBackend,
  type DownloadResult,
  type SyncTimestamps,
} from "./sync/sync-config.js";
import type { SyncSnapshot } from "./sync/snapshot-codec.js";
import { selectSyncableSettings } from "./sync/settings-selector.js";
import { applyRemote } from "./sync/apply-remote.js";
import { toast } from "../stores/toast.js";

const DEBOUNCE_MS = 5000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

/** Callback for sync progress updates (used by UI). */
type ProgressCallback = (stage: string, detail?: string) => void;
let progressCallback: ProgressCallback | null = null;

/** Register a callback to receive sync progress updates. */
export function onSyncProgress(cb: ProgressCallback | null): void {
  progressCallback = cb;
}

function notifyProgress(stage: string, detail?: string): void {
  if (progressCallback) progressCallback(stage, detail);
}

type Transport = EncryptedSyncService | FileSyncService;
type Selection = {
  playlists: boolean;
  metadata: boolean;
  thumbnails: boolean;
  history: boolean;
  settings: boolean;
};

function extBrowser() {
  return (globalThis as any).browser || (globalThis as any).chrome;
}

export async function buildTransport(
  config: SyncConfig,
  backend: SyncBackend
): Promise<Transport | null> {
  const deviceId = await getOrCreateDeviceId();
  if (backend === "file") {
    const handle = await loadFolderHandle();
    if (!handle) return null;
    return new FileSyncService(handle, deviceId);
  }
  if (backend === "supabase-byo" && config.supabaseUrl && config.supabaseKey) {
    return new EncryptedSyncService(deviceId, {
      url: config.supabaseUrl,
      key: config.supabaseKey,
    });
  }
  if (backend === "relay") {
    if (!isRelayConfigured()) return null;
    return new EncryptedSyncService(deviceId, {
      url: RELAY_SUPABASE_URL,
      key: RELAY_SUPABASE_ANON_KEY,
    });
  }
  return null;
}

async function readSettings(): Promise<unknown> {
  if (typeof (window as any).getSettings === "function") {
    return (window as any).getSettings();
  }
  return {};
}

async function readHistory(): Promise<unknown> {
  try {
    const stored = await extBrowser().storage.local.get("local_yt_history");
    return stored.local_yt_history ?? {};
  } catch {
    return {};
  }
}

export async function collectSource(): Promise<{
  playlists: unknown;
  settings: unknown;
  history: unknown;
  revision: number;
}> {
  const { librarySnapshot } = await import("../../../shared/storage-client.js");
  const snapshot = await librarySnapshot();
  return {
    playlists: snapshot.playlists,
    settings: selectSyncableSettings(await readSettings()),
    history: await readHistory(),
    revision: snapshot.revision,
  };
}

export function buildSelection(config: SyncConfig): Selection {
  return {
    playlists: config.content.playlists,
    metadata: false,
    thumbnails: false,
    history: config.content.history,
    settings: config.content.settings,
  };
}

/** Snapshot local state before applying a pulled snapshot, as a data-loss safety net. */
async function backupLocal(): Promise<void> {
  try {
    const { librarySnapshot } = await import("../../../shared/storage-client.js");
    const snapshot = await librarySnapshot();
    await extBrowser().storage.local.set({
      yph_sync_preimport_backup: {
        playlists: snapshot.playlists,
        settings: selectSyncableSettings(await readSettings()),
        history: await readHistory(),
        at: Date.now(),
      },
    });
  } catch (e) {
    console.warn("[AUTO-SYNC] pre-import backup failed:", e);
  }
}

/** Debounced trigger called after any local playlist change. */
export function scheduleSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    performSync().catch((e) => console.warn("[AUTO-SYNC] failed:", e));
  }, DEBOUNCE_MS);
}

/** Periodic pull (all backends) so a newer snapshot arrives without a local edit. */
export function startPolling(): void {
  stopPolling();
  scheduleNextPoll();
}

function stopPolling(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function scheduleNextPoll(): void {
  void (async () => {
    try {
      const config = await loadSyncConfig();
      const minutes =
        typeof config.syncIntervalMinutes === "number" ? config.syncIntervalMinutes : 0;
      if (
        !config.syncKey ||
        !Array.isArray(config.backends) ||
        config.backends.length === 0 ||
        minutes <= 0
      ) {
        return;
      }
      pollTimer = setTimeout(
        async () => {
          pollTimer = null;
          try {
            const cfg = await loadSyncConfig();
            if (cfg.syncKey && Array.isArray(cfg.backends) && cfg.backends.length > 0) {
              await performSync({ push: false });
            }
          } catch {
            /* ignore */
          }
          scheduleNextPoll();
        },
        minutes * 60 * 1000
      );
    } catch {
      /* ignore */
    }
  })();
}

/** One pull (no upload) so a newer remote snapshot is applied as soon as the app opens. */
export function pullNow(): Promise<void> {
  return performSync({ push: false });
}

async function performSync(options: { push?: boolean } = {}): Promise<void> {
  const push = options.push !== false;
  if (isSyncing) return;
  const config = await loadSyncConfig();
  if (!config.syncKey || config.backends.length === 0) return;

  const transports: Transport[] = [];
  for (const backend of config.backends) {
    const transport = await buildTransport(config, backend);
    if (transport) transports.push(transport);
  }
  if (transports.length === 0) return;

  isSyncing = true;
  try {
    const selection = buildSelection(config);

    // Read every enabled backend and take the newest snapshot (mirror: any may win).
    let newestRemote: SyncSnapshot | null = null;
    const readErrors: string[] = [];
    notifyProgress("reading", "Checking remote backends…");
    for (const transport of transports) {
      const result = await transport.download(config.syncKey!);
      if (result.status === "ok") {
        if (!newestRemote || result.snapshot.revision > newestRemote.revision) {
          newestRemote = result.snapshot;
        }
      } else if (result.status !== "missing") {
        const msg =
          "message" in result ? result.message : `conflict (${result.branches.length} branches)`;
        readErrors.push(`${result.status}: ${msg}`);
      }
    }
    const remoteRev = newestRemote?.revision ?? 0;
    const localRev = typeof config.syncRevision === "number" ? config.syncRevision : 0;

    // Surface distinct read failures instead of silently reporting "Already up to date."
    if (readErrors.length > 0 && !newestRemote) {
      config.lastError = readErrors.join("; ");
      config.lastSyncSummary = `Sync failed: ${readErrors.join("; ")}`;
      config.lastSyncedAt = Date.now();
      await saveSyncConfig(config);
      isSyncing = false;
      notifyProgress("error", config.lastSyncSummary);
      return;
    }

    let applied: string[] = [];

    if (newestRemote && remoteRev > localRev) {
      // Another device wrote newer data — adopt it (LWW: newer wins).
      notifyProgress("pulling", "Downloading latest data…");
      await backupLocal();
      const pullResult = await applyRemote(newestRemote.payload, selection);
      applied = pullResult.applied;
      const pullFailed = pullResult.failed;

      // Update per-category timestamps for categories that succeeded.
      const now = Date.now();
      if (applied.includes("playlists")) config.categoryTimestamps.playlists = now;
      if (applied.includes("settings")) config.categoryTimestamps.settings = now;
      if (applied.includes("history")) config.categoryTimestamps.history = now;

      // Only advance the sync revision when every intended category applied.
      if (pullFailed.length === 0) {
        const devices = new Set(config.knownDevices ?? []);
        devices.add(await getOrCreateDeviceId());
        if (newestRemote.deviceId) devices.add(newestRemote.deviceId);
        config.knownDevices = [...devices];
        config.syncRevision = remoteRev;
        config.lastError = null;
        config.lastSyncSummary = `Pulled ${applied.join(", ") || "data"} from another device.`;
        notifyProgress("success", config.lastSyncSummary);
      } else {
        config.lastError = `Partial sync: ${pullFailed.join("; ")}`;
        config.lastSyncSummary = `Sync partially applied: ${pullFailed.join("; ")}`;
        // Do NOT advance syncRevision — retry on next sync.
        notifyProgress("partial", config.lastSyncSummary);
      }
    } else if (push) {
      // We are at least as new — push with a fresh Lamport timestamp to every backend.
      notifyProgress("preparing", "Preparing local changes…");
      const source = await collectSource();
      // R2: non-destructive category merge. Categories disabled locally are preserved
      // from the newest remote snapshot instead of being dropped (which would erase
      // another device's data). Explicit deletion still propagates (empty value).
      const remotePayload =
        newestRemote && typeof newestRemote.payload === "object" && newestRemote.payload
          ? (newestRemote.payload as Record<string, unknown>)
          : {};
      const mergedSource: Record<string, unknown> = { ...source };
      const pushSelection: Selection = { ...selection };
      if (!selection.playlists && remotePayload.playlists !== undefined) {
        mergedSource.playlists = remotePayload.playlists;
        pushSelection.playlists = true;
      }
      if (!selection.settings && remotePayload.settings !== undefined) {
        mergedSource.settings = remotePayload.settings;
        pushSelection.settings = true;
      }
      if (!selection.history && remotePayload.history !== undefined) {
        mergedSource.history = remotePayload.history;
        pushSelection.history = true;
      }
      const newRev = Math.max(localRev, remoteRev) + 1;
      let pushError: string | undefined;
      let uploadConflict = false;
      notifyProgress("pushing", "Uploading to backends…");
      for (const transport of transports) {
        const result = await transport.upload(
          config.syncKey!,
          mergedSource as any,
          pushSelection as any,
          newRev
        );
        if (result.error && !pushError) pushError = result.error;
        if (!result.pushed) uploadConflict = true;
      }
      if (pushError) {
        config.lastError = pushError;
        config.lastSyncSummary = `Sync failed: ${pushError}`;
        notifyProgress("error", config.lastSyncSummary);
      } else if (uploadConflict) {
        // Another device wrote newer data during our push — pull it instead of
        // surfacing an error. This makes sync silent and self-healing.
        if (newestRemote && remoteRev > localRev) {
          await backupLocal();
          const pullResult = await applyRemote(newestRemote.payload, selection);
          const pullFailed = pullResult.failed;
          const now = Date.now();
          if (pullResult.applied.includes("playlists")) config.categoryTimestamps.playlists = now;
          if (pullResult.applied.includes("settings")) config.categoryTimestamps.settings = now;
          if (pullResult.applied.includes("history")) config.categoryTimestamps.history = now;
          if (pullFailed.length === 0) {
            const devices = new Set(config.knownDevices ?? []);
            devices.add(await getOrCreateDeviceId());
            if (newestRemote.deviceId) devices.add(newestRemote.deviceId);
            config.knownDevices = [...devices];
            config.syncRevision = remoteRev;
            config.lastError = null;
            config.lastSyncSummary = `Pulled ${pullResult.applied.join(", ") || "data"} from another device.`;
            notifyProgress("success", config.lastSyncSummary);
          } else {
            config.lastError = `Partial sync: ${pullFailed.join("; ")}`;
            config.lastSyncSummary = `Sync partially applied: ${pullFailed.join("; ")}`;
            notifyProgress("partial", config.lastSyncSummary);
          }
        } else {
          // No newer snapshot identified — likely an equal-revision tie.
          // Re-read to reconcile; if still tied, report clearly.
          config.lastError =
            "Another device wrote at the same moment. Click Sync now to reconcile.";
          config.lastSyncSummary = "Sync conflict detected. Click Sync now to reconcile.";
          notifyProgress("conflict", config.lastSyncSummary);
        }
      } else {
        config.syncRevision = newRev;
        config.lastError = null;
        config.lastSyncSummary = "Synced your changes.";
        const now = Date.now();
        if (selection.playlists) config.categoryTimestamps.playlists = now;
        if (selection.settings) config.categoryTimestamps.settings = now;
        if (selection.history) config.categoryTimestamps.history = now;
        notifyProgress("success", config.lastSyncSummary);
      }
    } else {
      config.lastError = null;
      config.lastSyncSummary = "Already up to date.";
      notifyProgress("success", config.lastSyncSummary);
    }

    config.lastSyncedAt = Date.now();
    await saveSyncConfig(config);
    if (applied.length) toast.show(config.lastSyncSummary!, "success");
  } catch (e: any) {
    const config2 = await loadSyncConfig();
    config2.lastError = e?.message || String(e);
    config2.lastSyncSummary = `Sync failed: ${config2.lastError}`;
    config2.lastSyncedAt = Date.now();
    try {
      await saveSyncConfig(config2);
    } catch {
      // Config write is secondary; the sync error is already surfaced.
    }
    console.warn("[AUTO-SYNC] exception:", e);
    notifyProgress("error", config2.lastSyncSummary);
  } finally {
    isSyncing = false;
    notifyProgress("idle", "");
  }
}

export async function getSyncStatus(): Promise<{
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  lastSyncSummary: string | null;
  hasKey: boolean;
  backends: string[];
  knownDevices: number;
  categoryTimestamps: SyncTimestamps;
}> {
  const config = await loadSyncConfig();
  return {
    isSyncing,
    lastSyncedAt: config.lastSyncedAt,
    lastError: config.lastError,
    lastSyncSummary: config.lastSyncSummary,
    hasKey: !!config.syncKey,
    backends: config.backends ?? [],
    knownDevices: config.knownDevices?.length ?? 0,
    categoryTimestamps: config.categoryTimestamps ?? {
      playlists: null,
      settings: null,
      history: null,
    },
  };
}

/** Force an immediate sync (used by the "Sync now" action). */
export async function triggerSyncNow(): Promise<void> {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  await performSync();
}

// Restart polling whenever sync config changes (e.g. interval or backends toggled).
const _extBrowser = extBrowser();
_extBrowser?.storage?.onChanged?.addListener?.((changes: any, area: string) => {
  if (area === "local" && changes?.yph_sync_config) {
    startPolling();
  }
});
