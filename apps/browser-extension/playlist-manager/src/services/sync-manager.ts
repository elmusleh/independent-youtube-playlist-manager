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

/** Periodic pull (all backends) so a newer snapshot arrives without a local edit. */
export function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const config = await loadSyncConfig();
    if (config.syncKey && config.backend) {
      performSync({ push: false }).catch(() => {});
    }
  }, POLL_MS);
}

async function performSync(options: { push?: boolean } = {}): Promise<void> {
  const push = options.push !== false;
  if (isSyncing) return;
  const config = await loadSyncConfig();
  if (!config.syncKey || !config.backend) return;

  const transport = await buildTransport(config);
  if (!transport) return;

  isSyncing = true;
  try {
    const selection = buildSelection(config);

    // Lamport clock: the sync revision must be globally monotonic, so derive it from
    // the remote snapshot — never the device-local library revision, which can tie
    // across two devices and then neither would ever pull the other's data.
    const remote = await transport.download(config.syncKey);
    const remoteRev = remote?.revision ?? 0;
    const localRev = typeof config.syncRevision === "number" ? config.syncRevision : 0;

    let applied: string[] = [];

    if (remote && remoteRev > localRev) {
      // Another device wrote newer data — adopt it (LWW: newer wins).
      await backupLocal();
      applied = await applyRemote(remote.payload, selection);
      config.syncRevision = remoteRev;
      const devices = new Set(config.knownDevices ?? []);
      devices.add(await getOrCreateDeviceId());
      if (remote.deviceId) devices.add(remote.deviceId);
      config.knownDevices = [...devices];
      config.lastError = null;
      config.lastSyncSummary = `Pulled ${applied.join(", ") || "data"} from another device.`;
    } else if (push) {
      // We are at least as new — push with a fresh Lamport timestamp.
      const source = await collectSource();
      const newRev = Math.max(localRev, remoteRev) + 1;
      const uploadResult = await transport.upload(
        config.syncKey,
        source as any,
        selection as any,
        newRev
      );
      if (uploadResult.error) {
        config.lastError = uploadResult.error;
        config.lastSyncSummary = `Sync failed: ${uploadResult.error}`;
      } else if (uploadResult.pushed) {
        config.syncRevision = newRev;
        config.lastError = null;
        config.lastSyncSummary = "Synced your changes.";
      } else {
        // Our write lost a race to a concurrent device — re-read and adopt the winner.
        const after = await transport.download(config.syncKey);
        if (after && after.revision > localRev) {
          await backupLocal();
          applied = await applyRemote(after.payload, selection);
          config.syncRevision = after.revision;
          config.lastSyncSummary = `Pulled ${applied.join(", ") || "data"} from another device.`;
        } else {
          config.lastError = null;
          config.lastSyncSummary = "Already up to date.";
        }
      }
    } else {
      config.lastError = null;
      config.lastSyncSummary = "Already up to date.";
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
