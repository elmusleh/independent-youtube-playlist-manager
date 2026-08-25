// sync-state-service.ts
// Manages persistent state for partial playlist syncs, enabling resume capability
// and multi-day syncs with automatic retry support.

import { SystemLogger } from "./logger-service.js";

// Guard to prevent duplicate declarations on SPA navigation
if (window._syncStateServiceLoaded) {
  console.warn("sync-state-service already loaded - skipping");
} else {
  window._syncStateServiceLoaded = true;
}

export interface SyncState {
  localPlaylistId: string;
  remotePlaylistId: string;
  playlistTitle: string;
  totalVideos: number;
  syncedVideoIds: string[];
  remainingVideoIds: string[];
  privacyStatus: "private" | "unlisted" | "public";
  startedAt: number;
  lastAttemptAt: number;
  error?: string;
  autoRetryEnabled: boolean;
  retryCount: number;
}

const SYNC_STATE_KEY = "yph_sync_state";

/**
 * Save sync state to persistent storage
 */
window.saveSyncState = async (state: SyncState): Promise<void> => {
  if (typeof browser === "undefined") return;

  try {
    const result = await browser.storage.local.get(SYNC_STATE_KEY);
    const allStates: Record<string, SyncState> = result[SYNC_STATE_KEY] || {};

    allStates[state.localPlaylistId] = {
      ...state,
      lastAttemptAt: Date.now(),
    };

    await browser.storage.local.set({ [SYNC_STATE_KEY]: allStates });

    await SystemLogger.info("SyncState", "saveSyncState", {
      localPlaylistId: state.localPlaylistId,
      remotePlaylistId: state.remotePlaylistId,
      syncedCount: state.syncedVideoIds.length,
      remainingCount: state.remainingVideoIds.length,
    });
  } catch (e) {
    await SystemLogger.error("SyncState", "saveSyncState failed", { error: e });
    throw e;
  }
};

/**
 * Get sync state for a specific local playlist
 */
window.getSyncState = async (localPlaylistId: string): Promise<SyncState | null> => {
  if (typeof browser === "undefined") return null;

  try {
    const result = await browser.storage.local.get(SYNC_STATE_KEY);
    const allStates: Record<string, SyncState> = result[SYNC_STATE_KEY] || {};
    return allStates[localPlaylistId] || null;
  } catch (e) {
    await SystemLogger.error("SyncState", "getSyncState failed", { error: e });
    return null;
  }
};

/**
 * Clear sync state for a specific playlist (called when sync completes)
 */
window.clearSyncState = async (localPlaylistId: string): Promise<void> => {
  if (typeof browser === "undefined") return;

  try {
    const result = await browser.storage.local.get(SYNC_STATE_KEY);
    const allStates: Record<string, SyncState> = result[SYNC_STATE_KEY] || {};

    if (allStates[localPlaylistId]) {
      delete allStates[localPlaylistId];
      await browser.storage.local.set({ [SYNC_STATE_KEY]: allStates });

      // Also clear any scheduled retry alarm
      const alarmName = `sync-retry-${localPlaylistId}`;
      if (browser.alarms) {
        await browser.alarms.clear(alarmName);
      }

      await SystemLogger.info("SyncState", "clearSyncState", { localPlaylistId });
    }
  } catch (e) {
    await SystemLogger.error("SyncState", "clearSyncState failed", { error: e });
  }
};

/**
 * Get all pending syncs (for showing in UI or processing)
 */
window.getAllPendingSyncs = async (): Promise<SyncState[]> => {
  if (typeof browser === "undefined") return [];

  try {
    const result = await browser.storage.local.get(SYNC_STATE_KEY);
    const allStates: Record<string, SyncState> = result[SYNC_STATE_KEY] || {};
    return Object.values(allStates).filter((state) => (state.remainingVideoIds || []).length > 0);
  } catch (e) {
    await SystemLogger.error("SyncState", "getAllPendingSyncs failed", { error: e });
    return [];
  }
};

/**
 * Check if there's a pending auto-retry scheduled for a playlist
 */
window.isAutoRetryScheduled = async (localPlaylistId: string): Promise<boolean> => {
  if (typeof browser === "undefined" || !browser.alarms) return false;

  try {
    const alarmName = `sync-retry-${localPlaylistId}`;
    const alarm = await browser.alarms.get(alarmName);
    return !!alarm;
  } catch (e) {
    return false;
  }
};

/**
 * Cancel scheduled auto-retry for a playlist
 */
window.cancelAutoRetry = async (localPlaylistId: string): Promise<void> => {
  if (typeof browser === "undefined" || !browser.alarms) return;

  try {
    const alarmName = `sync-retry-${localPlaylistId}`;
    await browser.alarms.clear(alarmName);

    // Update sync state to disable auto-retry
    const state = await window.getSyncState(localPlaylistId);
    if (state) {
      state.autoRetryEnabled = false;
      await window.saveSyncState(state);
    }

    await SystemLogger.info("SyncState", "cancelAutoRetry", { localPlaylistId });
  } catch (e) {
    await SystemLogger.error("SyncState", "cancelAutoRetry failed", { error: e });
  }
};

/**
 * Schedule automatic retry after quota error
 */
window.scheduleAutoRetry = async (localPlaylistId: string): Promise<void> => {
  if (typeof browser === "undefined" || !browser.alarms) return;

  try {
    const alarmName = `sync-retry-${localPlaylistId}`;

    // Schedule retry for 24 hours later (1440 minutes)
    await browser.alarms.create(alarmName, {
      delayInMinutes: 24 * 60,
    });

    // Update sync state
    const state = await window.getSyncState(localPlaylistId);
    if (state) {
      state.autoRetryEnabled = true;
      await window.saveSyncState(state);
    }

    await SystemLogger.info("SyncState", "scheduleAutoRetry", {
      localPlaylistId,
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    await SystemLogger.error("SyncState", "scheduleAutoRetry failed", { error: e });
  }
};

/**
 * Initialize sync state for a new playlist sync
 * Guards against overwriting existing state to prevent wiping partial progress
 */
window.initializeSyncState = async (
  localPlaylistId: string,
  playlistTitle: string,
  allVideoIds: string[],
  privacyStatus: "private" | "unlisted" | "public" = "private",
  remotePlaylistId: string = ""
): Promise<SyncState> => {
  // Check if state already exists (prevent overwriting partial progress)
  const existingState = await window.getSyncState(localPlaylistId);
  if (existingState) {
    await SystemLogger.info("SyncState", "initializeSyncState - using existing state", {
      localPlaylistId,
      syncedCount: existingState.syncedVideoIds.length,
      remainingCount: existingState.remainingVideoIds.length,
    });
    // Update remote ID if newly provided
    if (remotePlaylistId && !existingState.remotePlaylistId) {
      existingState.remotePlaylistId = remotePlaylistId;
      await window.saveSyncState(existingState);
    }
    return existingState;
  }

  const state: SyncState = {
    localPlaylistId,
    remotePlaylistId, // Set immediately if known, empty string if not yet created
    playlistTitle,
    totalVideos: allVideoIds.length,
    syncedVideoIds: [],
    remainingVideoIds: [...allVideoIds],
    privacyStatus,
    startedAt: Date.now(),
    lastAttemptAt: Date.now(),
    autoRetryEnabled: false,
    retryCount: 0, // Track number of retry attempts
  };

  await window.saveSyncState(state);
  return state;
};

/**
 * Update sync progress after successfully adding videos
 */
window.updateSyncProgress = async (
  localPlaylistId: string,
  newlySyncedVideoIds: string[]
): Promise<void> => {
  const state = await window.getSyncState(localPlaylistId);
  if (!state) return;

  // Add newly synced videos to the list (using Set to prevent duplicates)
  const syncedSet = new Set(state.syncedVideoIds);
  newlySyncedVideoIds.forEach((id) => syncedSet.add(id));
  state.syncedVideoIds = Array.from(syncedSet);

  // Remove from remaining
  state.remainingVideoIds = state.remainingVideoIds.filter((id) => !syncedSet.has(id));

  state.lastAttemptAt = Date.now();

  await window.saveSyncState(state);
};

/**
 * Check if a sync is complete
 */
window.isSyncComplete = async (localPlaylistId: string): Promise<boolean> => {
  const state = await window.getSyncState(localPlaylistId);
  if (!state) return true; // No state = nothing to sync
  return state.remainingVideoIds.length === 0;
};

export {};
