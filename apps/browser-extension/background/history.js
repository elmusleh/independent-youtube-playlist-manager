/* eslint-disable no-console */
import { HISTORY_KEY } from "./utils.js";

// ---------------------------------------------------------------------------
// Watch history persistence
// ---------------------------------------------------------------------------

/**
 * Save video watch history
 * @param {string} videoId
 * @param {number} t - Watch position in seconds
 * @param {number} dur - Video duration in seconds
 * @param {string} title
 * @param {string} channel
 * @param {boolean} isCompleted
 */
export async function saveHistory(videoId, t, dur, title, channel, isCompleted) {
  const start = Date.now();
  try {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        `Background: Saving history for ${videoId} at ${t}s (Completed: ${isCompleted})`
      );
    const data = await browser.storage.local.get(HISTORY_KEY);
    const history = data[HISTORY_KEY] || {};

    const existing = history[videoId] || {};

    history[videoId] = {
      title: title || existing.title || "Unknown Title",
      channel: channel || existing.channel || "Unknown Channel",
      timestamp: t,
      duration: dur,
      isCompleted: !!isCompleted,
      lastWatchedAt: Date.now(),
    };
    await browser.storage.local.set({ [HISTORY_KEY]: history });
    return true;
  } catch (e) {
    console.error("[Background] saveHistory failed:", e);
    return false;
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `saveHistory took ${duration}ms`);
    }
  }
}

/**
 * Get video watch history
 * @param {string} videoId
 * @returns {Promise<object|null>}
 */
export async function getHistory(videoId) {
  const start = Date.now();
  try {
    const data = await browser.storage.local.get(HISTORY_KEY);
    const history = data[HISTORY_KEY] || {};
    const item = history[videoId] || null;
    if (item) {
      return {
        ...item,
        t: item.timestamp,
        dur: item.duration,
        ts: item.lastWatchedAt,
      };
    }
    return null;
  } catch (e) {
    console.error("[Background] getHistory failed:", e);
    return null;
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `getHistory took ${duration}ms`);
    }
  }
}

// ---------------------------------------------------------------------------
// Delete a single history entry
// ---------------------------------------------------------------------------

/**
 * Delete a single video's watch history entry
 * @param {string} videoId
 * @returns {Promise<boolean>}
 */
export async function deleteHistoryItem(videoId) {
  const start = Date.now();
  try {
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", `Background: Deleting history for ${videoId}`);
    const data = await browser.storage.local.get(HISTORY_KEY);
    const history = data[HISTORY_KEY] || {};

    if (!(videoId in history)) {
      if (window.logSystemEvent)
        await window.logSystemEvent("WARN", `Background: History entry ${videoId} not found`);
      return false;
    }

    delete history[videoId];
    await browser.storage.local.set({ [HISTORY_KEY]: history });

    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", `Background: Deleted history entry for ${videoId}`);
    return true;
  } catch (e) {
    console.error("[Background] deleteHistoryItem failed:", e);
    return false;
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `deleteHistoryItem took ${duration}ms`);
    }
  }
}

// ---------------------------------------------------------------------------
// Auto-cleanup of watched videos
// ---------------------------------------------------------------------------

/**
 * Handle auto-deletion of watched videos based on settings
 * @param {string} videoId
 * @param {string} playlistId
 */
export async function handleCleanupWatchedVideo(videoId, playlistId) {
  const start = Date.now();
  try {
    const settings = await window.getSettings();
    if (!settings.ruleAutoDelete) {
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `Background: Skipping cleanup for ${videoId} (ruleAutoDelete is false)`
        );
      return false;
    }

    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        `Background: Running cleanup for ${videoId} in playlist ${playlistId}`
      );

    const LOCAL_PLAYLISTS_KEY = "yph_local_playlists";
    const result = await browser.storage.local.get(LOCAL_PLAYLISTS_KEY);
    const playlists = result[LOCAL_PLAYLISTS_KEY] || [];

    const index = playlists.findIndex((p) => p.id === playlistId);
    if (index >= 0) {
      const playlist = playlists[index];

      // SAFEGUARD: Skip auto-delete for permanent playlists
      if (playlist.isPermanent) {
        if (window.logSystemEvent)
          await window.logSystemEvent("INFO", `[CLEANUP] Skipping permanent playlist`, {
            videoId,
            playlistId,
          });
        return false;
      }

      const initialLength = playlist.videos.length;
      playlist.videos = playlist.videos.filter((id) => id !== videoId);

      if (playlist.videos.length < initialLength) {
        await browser.storage.local.set({ [LOCAL_PLAYLISTS_KEY]: playlists });
        if (window.logSystemEvent)
          await window.logSystemEvent("INFO", `[CLEANUP] Video removed from local playlist`, {
            videoId,
            playlistId,
          });

        if (window.invalidatePlaylistCache) {
          window.invalidatePlaylistCache();
        }

        try {
          browser.runtime.sendMessage({ cmd: "update-saved-playlists" }).catch(() => {});
        } catch {
          /* ignore */
        }

        return true;
      }
    } else {
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "WARN",
          `Background: Playlist ${playlistId} not found during cleanup`
        );
    }
    return false;
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `handleCleanupWatchedVideo took ${duration}ms`);
    }
  }
}

// ---------------------------------------------------------------------------
// Periodic pruning
// ---------------------------------------------------------------------------

export async function pruneHistory() {
  try {
    const settings = await window.getSettings();
    const retentionDays = settings.ruleHistoryRetentionDays || 30;
    const cutoffTs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const data = await browser.storage.local.get(HISTORY_KEY);
    const history = data[HISTORY_KEY];
    if (!history) return;

    let deletedCount = 0;
    for (const videoId in history) {
      if (history[videoId].lastWatchedAt < cutoffTs) {
        delete history[videoId];
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await browser.storage.local.set({ [HISTORY_KEY]: history });
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `Background: Pruned ${deletedCount} stale history records`
        );
    }
  } catch (e_inner) {
    console.error("Failed to prune history:", e_inner);
  }
}

/**
 * Prune IndexedDB metadata cache entries older than 30 days
 */
export function pruneStaleMetadataCache() {
  if (typeof indexedDB === "undefined") return;
  try {
    const dbRequest = indexedDB.open("keyval-store");
    dbRequest.onerror = (e) => {
      console.warn("[Background] Failed to open keyval-store for pruning:", e.target.error);
    };
    dbRequest.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("keyval")) return;
      const tx = db.transaction("keyval", "readwrite");
      tx.onerror = (ev) => {
        console.warn("[Background] Prune transaction failed:", ev.target.error);
      };
      const store = tx.objectStore("keyval");
      const req = store.openCursor();
      const now = Date.now();
      const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const key = String(cursor.key);
          if (key.startsWith("yph:meta:")) {
            const val = cursor.value;
            if (val && val.lastCachedAt && now - val.lastCachedAt > MAX_AGE_MS) {
              cursor.delete();
            }
          }
          cursor.continue();
        }
      };
    };
  } catch (err) {
    console.warn("[Background] Stale cache pruning failed:", err);
  }
}
