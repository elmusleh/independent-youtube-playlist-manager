/**
 * Auto-sync manager: debounced sync triggered after local playlist changes.
 *
 * Reads the sync key from localStorage (set via SyncSettings). When a sync key
 * is present, schedules a sync after a short debounce. Uses EncryptedSyncService
 * for the actual upload/download round-trip.
 */

import { EncryptedSyncService } from "./sync/encrypted-sync-service.js";
import { generateSyncKey } from "./sync/sync-key.js";

const DEBOUNCE_MS = 5000;
const SYNC_KEY_STORAGE = "yph_sync_key";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let lastSyncedAt: number | null = null;
let lastError: string | null = null;

const syncService = new EncryptedSyncService();

function getSyncKey(): string | null {
  return localStorage.getItem(SYNC_KEY_STORAGE);
}

export function scheduleSync(): void {
  const key = getSyncKey();
  if (!key) return; // No sync key configured — skip

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    performSync().catch((e) => console.warn("[AUTO-SYNC] failed:", e));
  }, DEBOUNCE_MS);
}

async function performSync(): Promise<void> {
  const key = getSyncKey();
  if (!key || isSyncing) return;

  isSyncing = true;
  try {
    const { librarySnapshot } = await import("../../../shared/storage-client.js");
    const snapshot = await librarySnapshot();
    const source = {
      playlists: snapshot.playlists,
      settings: {},
      history: [],
    };

    const result = await syncService.sync(key, source as any, {}, snapshot.revision);

    if (result.error) {
      lastError = result.error;
      console.warn("[AUTO-SYNC] error:", result.error);
    } else {
      lastSyncedAt = Date.now();
      lastError = null;
      if (result.pulled && result.snapshot) {
        // Remote is newer — apply to local storage
        const remotePlaylists = (result.snapshot.payload as any)?.playlists;
        if (remotePlaylists) {
          const { mutateLibrary } = await import("../../../shared/storage-client.js");
          await mutateLibrary({
            type: "replace",
            playlists: remotePlaylists,
            expectedRevision: snapshot.revision,
          });
        }
      }
    }
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.warn("[AUTO-SYNC] exception:", e);
  } finally {
    isSyncing = false;
  }
}

export function getSyncStatus(): {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  hasKey: boolean;
} {
  return {
    isSyncing,
    lastSyncedAt,
    lastError,
    hasKey: !!getSyncKey(),
  };
}

export function triggerSyncNow(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  performSync().catch((e) => console.warn("[AUTO-SYNC] failed:", e));
}
