/**
 * Auto-sync manager: debounced sync triggered after local playlist changes.
 *
 * Reads the durable sync config (browser.storage.local) and selects the transport from the
 * configured backend — the built-in relay, a bring-your-own Supabase project, or the
 * File/Syncthing folder (Chromium desktop). It never touches `localStorage`.
 */

import { EncryptedSyncService } from "./sync/encrypted-sync-service.js";
import { FileSyncService, loadFolderHandle } from "./sync/file-sync-service.js";
import {
  loadSyncConfig,
  saveSyncConfig,
  RELAY_SUPABASE_URL,
  RELAY_SUPABASE_ANON_KEY,
  type SyncConfig,
} from "./sync/sync-config.js";

const DEBOUNCE_MS = 5000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

type Transport = EncryptedSyncService | FileSyncService;

async function buildTransport(config: SyncConfig): Promise<Transport | null> {
  if (config.backend === "file") {
    const handle = await loadFolderHandle();
    if (!handle) return null;
    return new FileSyncService(handle);
  }
  // Supabase (relay or bring-your-own): differ only by endpoint.
  if (config.backend === "supabase-byo" && config.supabaseUrl && config.supabaseKey) {
    return new EncryptedSyncService(undefined, {
      url: config.supabaseUrl,
      key: config.supabaseKey,
    });
  }
  if (config.backend === "relay") {
    return new EncryptedSyncService(undefined, {
      url: RELAY_SUPABASE_URL,
      key: RELAY_SUPABASE_ANON_KEY,
    });
  }
  return null;
}

/** Debounced trigger called after any local playlist change. */
export function scheduleSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    const config = await loadSyncConfig();
    if (!config.syncKey || !config.backend) return;
    performSync().catch((e) => console.warn("[AUTO-SYNC] failed:", e));
  }, DEBOUNCE_MS);
}

async function performSync(): Promise<void> {
  if (isSyncing) return;
  const config = await loadSyncConfig();
  if (!config.syncKey || !config.backend) return;

  const transport = await buildTransport(config);
  if (!transport) return;

  isSyncing = true;
  try {
    const { librarySnapshot, mutateLibrary } = await import("../../../shared/storage-client.js");
    const snapshot = await librarySnapshot();
    const source = {
      playlists: snapshot.playlists,
      settings: {},
      history: [],
    };

    const result = await transport.sync(
      config.syncKey,
      source as any,
      config.content as any,
      snapshot.revision
    );

    if (result.error) {
      config.lastError = result.error;
      await saveSyncConfig(config);
      console.warn("[AUTO-SYNC] error:", result.error);
    } else {
      config.lastSyncedAt = Date.now();
      config.lastError = null;
      await saveSyncConfig(config);
      if (result.pulled && result.snapshot) {
        const remotePlaylists = (result.snapshot.payload as any)?.playlists;
        if (remotePlaylists) {
          await mutateLibrary({
            type: "replace",
            playlists: remotePlaylists,
            expectedRevision: snapshot.revision,
          });
        }
      }
    }
  } catch (e: any) {
    const config2 = await loadSyncConfig();
    config2.lastError = e?.message || String(e);
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
  hasKey: boolean;
  backend: string | null;
}> {
  const config = await loadSyncConfig();
  return {
    isSyncing,
    lastSyncedAt: config.lastSyncedAt,
    lastError: config.lastError,
    hasKey: !!config.syncKey,
    backend: config.backend,
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
