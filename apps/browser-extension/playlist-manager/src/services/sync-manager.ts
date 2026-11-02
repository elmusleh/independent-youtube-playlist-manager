/**
 * Auto-sync manager: debounced sync after local changes, plus periodic pull for the
 * File/Syncthing transport.
 *
 * Reads the durable sync config (browser.storage.local), selects the transport from the
 * backend (hosted relay / Supabase BYO / File-Syncthing), and syncs playlists, settings and
 * watch history per the user's toggles. Before applying a pulled snapshot it takes a local
 * pre-import backup, and it reports granular per-category results.
 */

import { EncryptedSyncService } from "./sync/encrypted-sync-service.js";
import { FileSyncService, loadFolderHandle } from "./sync/file-sync-service.js";
import {
  loadSyncConfig,
  saveSyncConfig,
  getOrCreateDeviceId,
  RELAY_SUPABASE_URL,
  RELAY_SUPABASE_ANON_KEY,
  type SyncConfig,
} from "./sync/sync-config.js";
import { toast } from "../stores/toast.js";

const DEBOUNCE_MS = 5000;
const POLL_MS = 5 * 60 * 1000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

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

async function buildTransport(config: SyncConfig): Promise<Transport | null> {
  const deviceId = await getOrCreateDeviceId();
  if (config.backend === "file") {
    const handle = await loadFolderHandle();
    if (!handle) return null;
    return new FileSyncService(handle, deviceId);
  }
  if (config.backend === "supabase-byo" && config.supabaseUrl && config.supabaseKey) {
    return new EncryptedSyncService(deviceId, {
      url: config.supabaseUrl,
      key: config.supabaseKey,
    });
  }
  if (config.backend === "relay") {
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

async function collectSource(): Promise<{
  playlists: unknown;
  settings: unknown;
  history: unknown;
  revision: number;
}> {
  const { librarySnapshot } = await import("../../../shared/storage-client.js");
  const snapshot = await librarySnapshot();
  return {
    playlists: snapshot.playlists,
    settings: await readSettings(),
    history: await readHistory(),
    revision: snapshot.revision,
  };
}

function buildSelection(config: SyncConfig): Selection {
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
        settings: await readSettings(),
        history: await readHistory(),
        at: Date.now(),
      },
    });
  } catch (e) {
    console.warn("[AUTO-SYNC] pre-import backup failed:", e);
  }
}

/** Apply a pulled snapshot's categories that are selected; returns the applied names. */
async function applyRemote(
  payload: Record<string, unknown>,
  selection: Selection
): Promise<string[]> {
  const applied: string[] = [];
  if (selection.playlists && Array.isArray(payload.playlists)) {
    const { librarySnapshot, mutateLibrary } = await import("../../../shared/storage-client.js");
    const local = await librarySnapshot();
    await mutateLibrary({
      type: "replace",
      playlists: payload.playlists,
      expectedRevision: local.revision,
    });
    applied.push("playlists");
  }
  if (selection.settings && payload.settings && typeof payload.settings === "object") {
    for (const [key, value] of Object.entries(payload.settings as Record<string, unknown>)) {
      if (typeof (window as any).storeObject === "function") {
        await (window as any).storeObject(key, value);
      }
    }
    applied.push("settings");
  }
  if (selection.history && payload.history) {
    await extBrowser().storage.local.set({ local_yt_history: payload.history });
    applied.push("history");
  }
  return applied;
}

/** Debounced trigger called after any local playlist change. */
export function scheduleSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    performSync().catch((e) => console.warn("[AUTO-SYNC] failed:", e));
  }, DEBOUNCE_MS);
}

/** Periodic pull so a Syncthing-dropped file is noticed without a local edit. */
export function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const config = await loadSyncConfig();
    if (config.syncKey && config.backend === "file") {
      performSync().catch(() => {});
    }
  }, POLL_MS);
}

async function performSync(): Promise<void> {
  if (isSyncing) return;
  const config = await loadSyncConfig();
  if (!config.syncKey || !config.backend) return;

  const transport = await buildTransport(config);
  if (!transport) return;

  isSyncing = true;
  try {
    const source = await collectSource();
    const selection = buildSelection(config);

    const result = await transport.sync(
      config.syncKey,
      source as any,
      selection as any,
      source.revision
    );

    let summary: string;
    let applied: string[] = [];

    if (result.error) {
      summary = `Sync failed: ${result.error}`;
      config.lastError = result.error;
      config.lastSyncSummary = summary;
    } else {
      if (result.pulled && result.snapshot) {
        await backupLocal();
        applied = await applyRemote(result.snapshot.payload, selection);
        const devices = new Set(config.knownDevices ?? []);
        devices.add(await getOrCreateDeviceId());
        if (result.snapshot.deviceId) devices.add(result.snapshot.deviceId);
        config.knownDevices = [...devices];
      }

      const pulledLabel = applied.length ? applied.join(", ") : "";
      if (result.pushed && applied.length) {
        summary = `Synced your changes and pulled ${pulledLabel} from another device.`;
      } else if (applied.length) {
        summary = `Pulled ${pulledLabel} from another device.`;
      } else if (result.pushed) {
        summary = "Synced your changes.";
      } else {
        summary = "Already up to date.";
      }
      config.lastError = null;
      config.lastSyncSummary = summary;
    }

    config.lastSyncedAt = Date.now();
    await saveSyncConfig(config);

    if (applied.length) {
      toast.show(summary, "success");
    }
  } catch (e: any) {
    const config2 = await loadSyncConfig();
    config2.lastError = e?.message || String(e);
    config2.lastSyncSummary = `Sync failed: ${config2.lastError}`;
    config2.lastSyncedAt = Date.now();
    await saveSyncConfig(config2);
    console.warn("[AUTO-SYNC] exception:", e);
  } finally {
    isSyncing = false;
  }
}

export async function getSyncStatus(): Promise<{
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  lastSyncSummary: string | null;
  hasKey: boolean;
  backend: string | null;
  knownDevices: number;
}> {
  const config = await loadSyncConfig();
  return {
    isSyncing,
    lastSyncedAt: config.lastSyncedAt,
    lastError: config.lastError,
    lastSyncSummary: config.lastSyncSummary,
    hasKey: !!config.syncKey,
    backend: config.backend,
    knownDevices: config.knownDevices?.length ?? 0,
  };
}

/** Force an immediate sync (used by the "Sync now" action). */
export function triggerSyncNow(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  performSync().catch((e) => console.warn("[AUTO-SYNC] failed:", e));
}
