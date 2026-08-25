/// <reference path="../../node_modules/@types/firefox-webext-browser/index.d.ts" />

import type { Playlist, PlaylistExport, Settings } from "../types/model.js";
import { SystemLogger } from "./logger-service.js";
import type { SyncState } from "./sync-state-service.js";

// Guard to prevent duplicate declarations on SPA navigation
if (window._storageServiceLoaded) {
  console.warn("storage-service already loaded - skipping");
} else {
  window._storageServiceLoaded = true;
}

// ─── Playlist Cache ───────────────────────────────────────────────────────────

window.invalidatePlaylistCache = () => {
  bustCache();
};

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const PERSISTENT_CACHE_KEY = "yt_playlist_cache_v1";
const LOCAL_PLAYLISTS_KEY = "yph_local_playlists";

const _cache: {
  list: CacheEntry<Playlist[]> | null;
  accountList: CacheEntry<YtPlaylistInfoExtended[]> | null;
  single: Map<string, CacheEntry<Playlist | null>>;
} = { list: null, accountList: null, single: new Map() };

// Get cache TTL from settings (or use default if settings not loaded yet)
async function getCacheTTL(): Promise<number> {
  const settings = await window.getSettings();
  if (settings.cacheDuration === -1) return Infinity;
  return settings.cacheDuration * 60 * 1000; // minutes to ms
}

async function isFresh(ts: number): Promise<boolean> {
  const ttl = await getCacheTTL();
  if (ttl === Infinity) return true; // No expiration - always fresh
  return Date.now() - ts < ttl;
}

function bustCache(): void {
  _cache.list = null;
  _cache.accountList = null;
  _cache.single.clear();
  // Don't remove from persistent storage - keep as fallback for API failures
}

// Restore cache from storage on module load (survives page reloads)
// We always restore persisted cache without checking freshness -
// freshness will be checked on next access when settings are available
if (typeof browser !== "undefined") {
  browser.storage.local
    .get(PERSISTENT_CACHE_KEY)
    .then((stored: any) => {
      const data = stored[PERSISTENT_CACHE_KEY];
      if (!data) return;
      // Validate shape before restoring to avoid crashes from corrupted storage
      if (data.list && Array.isArray(data.list.data)) {
        _cache.list = data.list;
      }
      if (data.accountList && Array.isArray(data.accountList.data)) {
        _cache.accountList = data.accountList;
      }
      if (_cache.list || _cache.accountList) {
        console.log("Cache restored from persistent storage");
      }
    })
    .catch(() => {});
}

// ─── Metadata Cache Migration (monolithic → per-video idb-keyval) ─────────
const LEGACY_VIDEO_META_CACHE_KEY = "yph_video_metadata_cache";
const META_MIGRATION_FLAG = "yph_meta_cache_migrated_v2";

if (typeof browser !== "undefined") {
  (async () => {
    try {
      const flag = await browser.storage.local.get(META_MIGRATION_FLAG);
      if (flag[META_MIGRATION_FLAG]) return;

      const legacy = await browser.storage.local.get(LEGACY_VIDEO_META_CACHE_KEY);
      const map: Record<string, any> = legacy[LEGACY_VIDEO_META_CACHE_KEY] || {};
      const entries = Object.entries(map);
      if (entries.length === 0) {
        await browser.storage.local.set({ [META_MIGRATION_FLAG]: true });
        return;
      }

      console.log(`[STORAGE] Migrating ${entries.length} legacy metadata entries to IndexedDB...`);
      const { dbPutMetadataBatch } = await import("./db-service.js");
      const batchObj: Record<string, any> = {};
      for (const [videoId, data] of entries) {
        if (data && typeof data === "object") {
          batchObj[videoId] = data;
        }
      }
      if (Object.keys(batchObj).length > 0) {
        await dbPutMetadataBatch(batchObj);
      }
      await browser.storage.local.set({ [META_MIGRATION_FLAG]: true });
      console.log(
        `[STORAGE] Metadata cache migration complete: ${Object.keys(batchObj).length} entries migrated.`
      );
    } catch (e) {
      console.warn("[STORAGE] Metadata cache migration failed:", e);
    }
  })();
}

// ─── Local Playlist Storage ────────────────────────────────────────────────

window.getLocalPlaylists = async (): Promise<Playlist[]> => {
  if (typeof browser === "undefined") return [];
  try {
    const result = await browser.storage.local.get(LOCAL_PLAYLISTS_KEY);
    return result[LOCAL_PLAYLISTS_KEY] || [];
  } catch (e) {
    await SystemLogger.error("StorageService", "getLocalPlaylists", { error: e });
    return [];
  }
};

// Keep a local reference for internal use
const getLocalPlaylists = window.getLocalPlaylists;

async function saveLocalPlaylist(playlist: Playlist): Promise<string> {
  if (typeof browser === "undefined") return playlist.id;
  const playlists = await getLocalPlaylists();
  let id = playlist.id;

  if (!id || id.startsWith("local-") === false) {
    id = "local-" + Date.now();
  }

  const newPlaylist = { ...playlist, id, saved: true, isLocal: true };
  const index = playlists.findIndex((p) => p.id === id);

  if (index >= 0) {
    playlists[index] = newPlaylist;
  } else {
    playlists.push(newPlaylist);
  }

  await browser.storage.local.set({ [LOCAL_PLAYLISTS_KEY]: playlists });
  return id;
}

async function removeLocalPlaylist(id: string): Promise<void> {
  if (typeof browser === "undefined") return;
  const playlists = await getLocalPlaylists();
  const filtered = playlists.filter((p) => p.id !== id);
  await browser.storage.local.set({ [LOCAL_PLAYLISTS_KEY]: filtered });
}

window.ensureWatchLaterPlaylist = async (
  forceCreate = false
): Promise<{ id: string | null; recreated: boolean }> => {
  const settings = await window.getSettings();
  let currentId = settings.watchLaterPlaylistId;
  const signedIn = await window.isSignedIn();

  const recreateLocal = async () => {
    console.log("Recreating local favorite playlist 'Watch Later ⭐️'...");
    const newId = await saveLocalPlaylist({
      id: "",
      title: "Watch Later ⭐️",
      videos: [],
      timestamp: Date.now(),
    });
    await window.storeObject("watchLaterPlaylistId", newId);
    notifyPlaylistsChanged();
    return { id: newId, recreated: true };
  };

  const ensureYouTubeFavorite = async () => {
    try {
      // 1. Get all playlists from their YouTube account
      const ytPlaylists = await window.getAccountPlaylists();

      // 2. Look for an existing "Watch Later [YPH]" or "Watch Later" playlist
      const existingWL = ytPlaylists.find(
        (p) => p.title === "Watch Later [YPH]" || p.title === "Watch Later"
      );

      if (existingWL) {
        console.log(
          `[STORAGE] Linking existing YouTube playlist "${existingWL.title}" as favorite`
        );
        await window.storeObject("watchLaterPlaylistId", existingWL.id);
        notifyPlaylistsChanged();
        return { id: existingWL.id, recreated: false };
      }

      // 3. Create a new "Watch Later [YPH]" playlist on YouTube
      console.log("[STORAGE] Creating new YouTube playlist 'Watch Later [YPH]' as favorite...");
      const newYtId = await window.ytCreatePlaylist("Watch Later [YPH]", "private");
      await window.storeObject("watchLaterPlaylistId", newYtId);
      notifyPlaylistsChanged();
      return { id: newYtId, recreated: true };
    } catch (e) {
      console.error(
        "[STORAGE] Failed to auto-configure YouTube favorite, falling back to local:",
        e
      );
      return await recreateLocal();
    }
  };

  if (signedIn) {
    // Respect local favorites even when signed in
    if (currentId && currentId.startsWith("local-")) {
      const local = await getLocalPlaylists();
      const existingIndex = local.findIndex((p) => p.id === currentId);
      if (existingIndex !== -1) {
        return { id: currentId, recreated: false };
      }
    }

    // If favorite is set to a YouTube playlist, verify it exists
    if (currentId && !currentId.startsWith("local-")) {
      try {
        const yt = await window.ytGetPlaylist(currentId);
        if (yt) return { id: currentId, recreated: false };
      } catch (e) {
        console.warn("Favorite YouTube playlist not found, recreating...", e);
      }
    }
    // If no favorite is set, or not found, create/link a YouTube favorite
    return await ensureYouTubeFavorite();
  } else {
    // Not signed in — expect a local playlist
    if (currentId && currentId.startsWith("local-")) {
      const local = await getLocalPlaylists();
      const existingIndex = local.findIndex((p) => p.id === currentId);
      if (existingIndex !== -1) {
        if (forceCreate && local[existingIndex].title !== "Watch Later ⭐️") {
          local[existingIndex].title = "Watch Later ⭐️";
          await browser.storage.local.set({ [LOCAL_PLAYLISTS_KEY]: local });
          notifyPlaylistsChanged();
          return { id: currentId, recreated: true };
        }
        return { id: currentId, recreated: false };
      }
    }
    return await recreateLocal();
  }
};

// ─── Sync Snapshot Helpers (used by sync-service for conflict detection) ──────

const SYNC_SNAPSHOTS_KEY = "yph_sync_snapshots";

window._saveToLocalStorage = async (playlist: Playlist): Promise<void> => {
  if (playlist.isLocal || playlist.id.startsWith("local-")) {
    if (typeof browser !== "undefined") {
      const key = LOCAL_PLAYLISTS_KEY;
      const result = await browser.storage.local.get(key);
      const playlists: Playlist[] = result[key] || [];
      const index = playlists.findIndex((p) => p.id === playlist.id);
      if (index >= 0) {
        playlists[index] = playlist;
      } else {
        playlists.push(playlist);
      }
      await browser.storage.local.set({ [key]: playlists });
    }
  }
  _cache.single.set(playlist.id, { data: playlist, ts: Date.now() });
  _cache.list = null;
};

window.saveSyncSnapshot = async (id: string, videos: string[]): Promise<void> => {
  if (typeof browser === "undefined") return;
  const result = await browser.storage.local.get(SYNC_SNAPSHOTS_KEY);
  const snapshots: Record<string, string[]> = result[SYNC_SNAPSHOTS_KEY] || {};
  snapshots[id] = videos;
  await browser.storage.local.set({ [SYNC_SNAPSHOTS_KEY]: snapshots });
};

window.getSyncSnapshot = async (id: string): Promise<string[]> => {
  if (typeof browser === "undefined") return [];
  const result = await browser.storage.local.get(SYNC_SNAPSHOTS_KEY);
  const snapshots: Record<string, string[]> = result[SYNC_SNAPSHOTS_KEY] || {};
  return snapshots[id] || [];
};

// ─── Playlist CRUD ────────────────────────────────────────

let _isSyncing = false;

window.savePlaylist = async (
  playlist: Playlist,
  options: { syncToYoutube?: boolean; resumeFromState?: SyncState } = {}
): Promise<string> => {
  await SystemLogger.info("StorageService", "savePlaylist start", {
    playlistId: playlist.id,
    syncOption: options.syncToYoutube,
    hasResumeState: !!options.resumeFromState,
  });
  const signedIn = await window.isSignedIn();
  const shouldSync = options.syncToYoutube !== false && signedIn;

  if (shouldSync && _isSyncing) {
    throw new Error("A synchronization is already in progress. Please wait.");
  }

  if (shouldSync) _isSyncing = true;

  let syncState: SyncState | null = options.resumeFromState || null;

  try {
    console.log("[STORAGE] savePlaylist triggered:", {
      id: playlist.id,
      syncOption: options.syncToYoutube,
      signedIn,
      shouldSync,
      resumeState: syncState?.remotePlaylistId,
    });

    if (shouldSync) {
      const settings = await window.getSettings();

      if (playlist.isLocal || syncState) {
        let ytId: string;
        let videosToSync: string[];

        if (syncState && syncState.remotePlaylistId) {
          // Resume existing sync
          ytId = syncState.remotePlaylistId;
          videosToSync = syncState.remainingVideoIds;
          console.log(
            `[STORAGE] Resuming sync for playlist ${ytId}, ${videosToSync.length} videos remaining`
          );
        } else {
          // New playlist on YouTube - create it
          ytId = await window.ytCreatePlaylist(playlist.title, settings.defaultPrivacy);
          videosToSync = playlist.videos;

          // Initialize sync state for tracking progress (with remote ID known)
          syncState = await window.initializeSyncState(
            playlist.id,
            playlist.title,
            playlist.videos,
            settings.defaultPrivacy,
            ytId // Pass remote playlist ID immediately to avoid race condition
          );
        }

        // Sync videos with progress tracking
        const successfullySynced: string[] = [];
        for (let i = 0; i < videosToSync.length; i++) {
          const videoId = videosToSync[i];
          try {
            await window.ytAddVideo(ytId, videoId);
            successfullySynced.push(videoId);

            // Update progress after each successful addition
            if (syncState) {
              await window.updateSyncProgress(playlist.id, [videoId]);
            }
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);

            // Check if this is a quota error
            if (
              errorMsg.toLowerCase().includes("quota") ||
              errorMsg.toLowerCase().includes("ratelimitexceeded")
            ) {
              // Save error to sync state
              if (syncState) {
                syncState.error = errorMsg;
                await window.saveSyncState(syncState);
              }

              // Calculate progress for error message (read fresh state to avoid double-counting)
              const freshState = await window.getSyncState(playlist.id);
              const synced = freshState?.syncedVideoIds?.length || successfullySynced.length;
              const total = freshState?.totalVideos || playlist.videos.length;
              const remaining = freshState?.remainingVideoIds?.length || total - synced;

              // Schedule auto-retry if enabled
              if (typeof browser !== "undefined" && browser.alarms && settings.autoRetryEnabled) {
                await window.scheduleAutoRetry(playlist.id);
              }

              const autoRetryMsg =
                typeof browser !== "undefined" && browser.alarms && settings.autoRetryEnabled
                  ? " Auto-retry scheduled for 24h."
                  : "";

              throw new Error(
                `API quota exceeded (${synced}/${total} videos synced). ` +
                  `${remaining} videos remaining. Progress saved - click Sync to resume.${autoRetryMsg}`
              );
            }

            // Re-throw other errors
            throw e;
          }
        }

        // Sync completed successfully - clear sync state but keep local playlist
        if (syncState) {
          await window.clearSyncState(playlist.id);
        }

        // Update cache
        const syncedPlaylist: Playlist = {
          ...playlist,
          id: ytId,
          saved: true,
          isLocal: false,
          isTagged: true,
        };
        _cache.single.set(ytId, { data: syncedPlaylist, ts: Date.now() });

        notifyPlaylistsChanged();
        return ytId;
      }

      // Existing YT playlist: sync title and video changes.
      const ytId = playlist.id;
      await window.ytUpdatePlaylist(ytId, playlist.title);

      const currentItems = await window.ytGetPlaylistItems(ytId);
      const currentVideoIds = currentItems.map((i) => i.videoId);

      // Remove videos that were deleted from the playlist.
      const removedItems = currentItems.filter((i) => !playlist.videos.includes(i.videoId));
      for (const item of removedItems) {
        await window.ytRemoveItem(item.itemId);
      }

      // Append/Insert videos that are new.
      const addedVideoIds = playlist.videos.filter((id) => !currentVideoIds.includes(id));
      for (const videoId of addedVideoIds) {
        const position = playlist.videos.indexOf(videoId);
        await window.ytAddVideo(ytId, videoId, position);
      }

      // 3. Reorder existing items if necessary.
      // After additions/removals, we need the fresh state to identify item IDs for reordering.
      const freshItems = await window.ytGetPlaylistItems(ytId);
      for (let i = 0; i < playlist.videos.length; i++) {
        const desiredVideoId = playlist.videos[i];
        const currentItem = freshItems[i];

        // If the video at this position isn't what we expect, move the correct one here.
        if (!currentItem || currentItem.videoId !== desiredVideoId) {
          const currentIndex = freshItems.findIndex((item) => item.videoId === desiredVideoId);
          if (currentIndex !== -1) {
            const itemToReorder = freshItems[currentIndex];
            await window.ytMoveItem(itemToReorder.itemId, ytId, itemToReorder.videoId, i);

            // Sync our local tracked list to match YouTube's shift
            const [moved] = freshItems.splice(currentIndex, 1);
            freshItems.splice(i, 0, moved);
          }
        }
      }

      // Update cache
      const updatedPlaylist: Playlist = {
        ...playlist,
        saved: true,
        isTagged: true,
      };
      _cache.single.set(ytId, { data: updatedPlaylist, ts: Date.now() });

      notifyPlaylistsChanged();
      return ytId;
    } else {
      // Save locally
      const localId = await saveLocalPlaylist(playlist);

      // Update cache for local too
      const localPlaylist: Playlist = {
        ...playlist,
        id: localId,
        saved: true,
        isLocal: true,
      };
      _cache.single.set(localId, { data: localPlaylist, ts: Date.now() });

      notifyPlaylistsChanged();
      return localId;
    }
  } finally {
    if (shouldSync) _isSyncing = false;
    await SystemLogger.info("StorageService", "savePlaylist end", {
      playlistId: playlist.id,
      result: shouldSync ? "synced" : "local",
    });
  }
};

window.importPlaylists = async (playlistsExport: PlaylistExport[]): Promise<void> => {
  // Remember the current favorite before importing
  const settings = await window.getSettings();
  const oldFavoriteId = settings.watchLaterPlaylistId;
  let oldFavoriteTitle: string | null = null;

  if (oldFavoriteId && oldFavoriteId.startsWith("local-")) {
    const currentLocal = await getLocalPlaylists();
    const oldFavorite = currentLocal.find((p) => p.id === oldFavoriteId);
    if (oldFavorite) {
      oldFavoriteTitle = oldFavorite.title;
    }
  }

  // Always import locally first - regardless of sign-in status
  // YouTube sync should only happen via explicit user action in the playlist editor
  for (const p of playlistsExport) {
    await saveLocalPlaylist({
      id: "",
      title: p.title,
      videos: p.videos,
      timestamp: p.timestamp || Date.now(),
      saved: false,
    });
    // Write any bundled metadata into the persistent IndexedDB cache
    if (p.metadata && window.videoService) {
      const validMeta: Record<string, any> = {};
      for (const [vid, meta] of Object.entries(p.metadata)) {
        if (meta && (meta.title || meta.durationISO || (meta as any).durationSeconds)) {
          validMeta[vid] = meta;
        }
      }
      if (Object.keys(validMeta).length > 0) {
        await window.videoService.cacheMetadata(validMeta);
      }
    }
  }
  notifyPlaylistsChanged();

  // After import, check if the old favorite local playlist is gone
  // and relink if a matching title was imported
  if (oldFavoriteId && oldFavoriteId.startsWith("local-") && oldFavoriteTitle) {
    const updatedLocal = await getLocalPlaylists();
    const stillExists = updatedLocal.some((p) => p.id === oldFavoriteId);
    if (!stillExists) {
      const match = updatedLocal.find((p) => p.title === oldFavoriteTitle);
      if (match) {
        await window.storeObject("watchLaterPlaylistId", match.id);
        notifyPlaylistsChanged();
        await SystemLogger.info("StorageService", "importPlaylists relinked favorite", {
          oldId: oldFavoriteId,
          newId: match.id,
          title: oldFavoriteTitle,
        });
      }
    }
  }

  // Show notification about how to sync if signed in
  const signedIn = await window.isSignedIn();
  if (signedIn && playlistsExport.length > 0) {
    window.success(
      `Imported ${playlistsExport.length} playlist(s) locally. Open a playlist and click "Sync to YouTube" to upload to your account.`
    );
  }
};

window.removePlaylist = async (playlist: Playlist): Promise<void> => {
  await SystemLogger.info("StorageService", "removePlaylist start", {
    playlistId: playlist.id,
  });
  if (playlist.id.startsWith("local-") || playlist.isLocal) {
    await removeLocalPlaylist(playlist.id);
  } else if (playlist.saved) {
    await window.ytDeletePlaylist(playlist.id);
  }
  notifyPlaylistsChanged();
  await SystemLogger.info("StorageService", "removePlaylist end", {
    playlistId: playlist.id,
  });
};

window.removePlaylists = async (playlists: Playlist[]): Promise<void> => {
  await SystemLogger.info("StorageService", "removePlaylists start", {
    count: playlists.length,
  });
  for (const playlist of playlists) {
    if (playlist.id.startsWith("local-") || playlist.isLocal) {
      await removeLocalPlaylist(playlist.id);
    } else if (playlist.saved) {
      await window.ytDeletePlaylist(playlist.id);
      // Small delay to prevent hitting rate limits during bulk deletions
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  notifyPlaylistsChanged();
  await SystemLogger.info("StorageService", "removePlaylists batch end", {
    count: playlists.length,
  });
};

window.removeSavedPlaylists = async (): Promise<void> => {
  // Remove local
  if (typeof browser !== "undefined") {
    await browser.storage.local.remove(LOCAL_PLAYLISTS_KEY);
  }

  // Remove YT if signed in
  if (await window.isSignedIn()) {
    const playlists = await window.ytListPlaylists();
    for (const p of playlists) {
      await window.ytDeletePlaylist(p.id);
    }
  }
  notifyPlaylistsChanged();
};

window.getPlaylists = async (): Promise<Playlist[]> => {
  await SystemLogger.info("StorageService", "getPlaylists start");
  const local = await getLocalPlaylists();

  if (!(await window.isSignedIn())) {
    return local;
  }

  if (_cache.list && (await isFresh(_cache.list.ts))) {
    // Merge cached YT with fresh local
    const ytPlaylists = _cache.list.data.filter((p) => !p.id.startsWith("local-"));
    return [...local, ...ytPlaylists];
  }

  const ytPlaylists = await window.ytListPlaylists();
  const playlists = await Promise.all(
    ytPlaylists.map(async (p) => {
      const hit = _cache.single.get(p.id);
      if (hit && hit.data && (await isFresh(hit.ts))) return hit.data;
      const items = await window.ytGetPlaylistItems(p.id);
      const playlist: Playlist = {
        id: p.id,
        title: p.title,
        videos: items.map((i) => i.videoId),
        timestamp: p.timestamp,
        saved: true,
        isTagged: p.isTagged,
      };
      _cache.single.set(p.id, { data: playlist, ts: Date.now() });
      return playlist;
    })
  );

  const all = [...local, ...playlists];
  _cache.list = { data: all, ts: Date.now() };
  persistCache();
  await SystemLogger.info("StorageService", "getPlaylists end", {
    total: all.length,
  });
  return all;
};

window.getPlaylist = async (id: string): Promise<Playlist | null> => {
  await SystemLogger.info("StorageService", "getPlaylist start", { id });
  // Check local first
  if (id.startsWith("local-")) {
    const local = await getLocalPlaylists();
    return local.find((p) => p.id === id) || null;
  }

  const hit = _cache.single.get(id);
  if (hit && (await isFresh(hit.ts))) return hit.data;

  if (!(await window.isSignedIn())) return null;

  const yt = await window.ytGetPlaylist(id);
  if (!yt) {
    _cache.single.set(id, { data: null, ts: Date.now() });
    return null;
  }
  const items = await window.ytGetPlaylistItems(yt.id !== "WL" ? id : yt.id);
  const playlist: Playlist = {
    id: yt.id !== "WL" ? id : yt.id,
    title: yt.title,
    videos: items.map((i) => i.videoId),
    timestamp: yt.timestamp,
    saved: true,
    isTagged: yt.isTagged,
  };
  _cache.single.set(id, { data: playlist, ts: Date.now() });
  await SystemLogger.info("StorageService", "getPlaylist end", {
    id,
    found: !!playlist,
  });
  return playlist;
};

// Helper function to check if any YouTube feature is enabled
async function isAnyYouTubeFeatureEnabled(settings: Settings): Promise<boolean> {
  return (
    settings.enableAccountPlaylists ||
    settings.enableLikedVideos ||
    settings.enableUploadedVideos ||
    settings.enableSubscriptions ||
    settings.enableActivities ||
    settings.enableSearch ||
    settings.enableComments ||
    settings.enableWatchLater
  );
}

// Return all playlists on the user's YouTube account (not filtered by YPH tag).
window.getAccountPlaylists = async (): Promise<YtPlaylistInfoExtended[]> => {
  await SystemLogger.info("StorageService", "getAccountPlaylists start");
  await window.ensureWatchLaterPlaylist();
  const settings = await window.getSettings();
  const local = await getLocalPlaylists();
  const localMapped: YtPlaylistInfoExtended[] = local.map((p) => ({
    id: p.id,
    title: p.title,
    timestamp: p.timestamp,
    videoCount: p.videos.length,
    isTagged: false,
    isLocal: true,
    thumbnailUrl: p.videos[0] ? window.videoService.getVideoThumbnailUrl(p.videos[0]) : undefined,
  }));

  // If not signed in, only return local playlists
  if (!(await window.isSignedIn())) {
    return localMapped;
  }

  // If no YouTube features are enabled, only return local playlists
  if (!(await isAnyYouTubeFeatureEnabled(settings))) {
    await SystemLogger.info("StorageService", "getAccountPlaylists", {
      message: "No YouTube features enabled, returning only local playlists",
    });
    return localMapped;
  }

  if (_cache.accountList && (await isFresh(_cache.accountList.ts))) {
    const ytAccount = _cache.accountList.data.filter((p) => !p.id.startsWith("local-"));
    return [...localMapped, ...ytAccount];
  }

  try {
    const playlists: YtPlaylistInfoExtended[] = [];

    // Only fetch account playlists if enabled or if signed in
    if (settings.enableAccountPlaylists) {
      const accountPlaylists = await window.ytListAllPlaylists();
      playlists.push(...accountPlaylists);
    } else {
      // Basic tagged playlists check if account-playlists is disabled but we still want managed ones
      const tagged = await window.ytListPlaylists();
      for (const t of tagged) {
        playlists.push({
          ...t,
          videoCount: 0,
          isTagged: true,
          thumbnailUrl: undefined,
        });
      }
    }

    // Robust check: Ensure the favorite playlist is in the list
    if (settings.watchLaterPlaylistId) {
      const favoriteInList = playlists.some((p) => p.id === settings.watchLaterPlaylistId);
      if (!favoriteInList) {
        console.log(
          `Favorite playlist ${settings.watchLaterPlaylistId} missing from bulk list, fetching directly...`
        );
        try {
          const fav = await window.ytGetPlaylist(settings.watchLaterPlaylistId);
          if (fav) {
            playlists.push({
              ...fav,
              videoCount: 0,
              isTagged: true,
              thumbnailUrl: undefined,
            });
          }
        } catch (e) {
          console.warn("Failed to fetch favorite playlist directly", e);
        }
      }
    }

    // Add virtual playlists conditionally
    try {
      if (settings.enableLikedVideos) {
        const likedId = await window.ytGetLikedVideosPlaylistId();
        if (likedId) {
          playlists.push({
            id: "LIKED",
            title: "Liked Videos",
            timestamp: Date.now(),
            videoCount: 0,
            isTagged: false,
            thumbnailUrl: undefined,
          });
        }
      }

      if (settings.enableUploadedVideos) {
        const uploadsId = await window.ytGetUploadedVideosPlaylistId();
        if (uploadsId) {
          playlists.push({
            id: "UPLOADS",
            title: "Uploaded Videos",
            timestamp: Date.now(),
            videoCount: 0,
            isTagged: false,
            thumbnailUrl: undefined,
          });
        }
      }

      if (settings.enableWatchLater) {
        const wlExists = playlists.some((p) => p.id === "WL");
        if (!wlExists) {
          playlists.push({
            id: "WL",
            title: "Watch Later",
            timestamp: Date.now(),
            videoCount: 0,
            isTagged: false,
            thumbnailUrl: undefined,
          });
        }
      }
    } catch (e) {
      console.warn("Failed to fetch virtual playlist IDs", e);
    }

    const all = [...localMapped, ...playlists];
    _cache.accountList = { data: all, ts: Date.now() };
    persistCache();
    await SystemLogger.info("StorageService", "getAccountPlaylists end", {
      total: all.length,
    });
    return all;
  } catch (e) {
    // API failed - return cached data if available
    console.warn("API call failed, returning cached playlists if available", e);
    if (_cache.accountList) {
      const ytAccount = _cache.accountList.data.filter((p) => !p.id.startsWith("local-"));
      return [...localMapped, ...ytAccount];
    }
    // Try to restore from persistent storage
    if (typeof browser !== "undefined") {
      const stored = await browser.storage.local.get(PERSISTENT_CACHE_KEY);
      const cached = stored[PERSISTENT_CACHE_KEY]?.accountList as
        CacheEntry<YtPlaylistInfoExtended[]> | undefined;
      if (cached) {
        _cache.accountList = cached;
        const ytAccount = cached.data.filter((p) => !p.id.startsWith("local-"));
        return [...localMapped, ...ytAccount];
      }
    }
    throw e; // Re-throw if no cache available
  }
};

// Return the user's channel subscriptions.
window.getAccountSubscriptions = async (): Promise<
  { channelId: string; title: string; thumbnail: string }[]
> => {
  if (!(await window.isSignedIn())) return [];
  return window.ytListSubscriptions();
};

// Return the user's recent activities.
window.getAccountActivities = async (
  maxResults: number = 20
): Promise<
  {
    type: string;
    title: string;
    videoId?: string;
    channelId: string;
    timestamp: string;
  }[]
> => {
  if (!(await window.isSignedIn())) return [];
  return window.ytListActivities(maxResults);
};

// Return the user's comments.
window.getAccountComments = async (
  maxResults: number = 20
): Promise<
  {
    id: string;
    textDisplay: string;
    videoId: string;
    authorDisplayName: string;
    publishedAt: string;
  }[]
> => {
  if (!(await window.isSignedIn())) return [];
  return window.ytListComments(maxResults);
};

// Perform a YouTube search.
window.youtubeSearch = async (
  query: string,
  maxResults: number = 20
): Promise<
  {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    publishedAt: string;
  }[]
> => {
  if (!(await window.isSignedIn())) return [];
  return window.ytSearch(query, maxResults);
};

// Adopt a YouTube playlist by tagging it with [YPH], making it visible in the
// extension's Saved view. This overwrites the playlist's existing description.
window.adoptPlaylist = async (ytId: string): Promise<void> => {
  await SystemLogger.info("StorageService", "adoptPlaylist start", { ytId });
  const yt = await window.ytGetPlaylist(ytId);
  if (!yt) throw new Error("Playlist not found");
  await window.ytUpdatePlaylist(ytId, yt.title);
  notifyPlaylistsChanged();
  await SystemLogger.info("StorageService", "adoptPlaylist end", { ytId });
};

// ─── Settings storage (browser.storage.sync) ─────────────────────────────────
// Convention: Use browser.storage.sync for settings/preferences (to sync across devices)
//             Use browser.storage.local for data, cache, and tokens.

let _cachedSettings: Settings | null = null;
let _settingsInFlight: Promise<Settings> | null = null;

export function invalidateSettingsCache() {
  _cachedSettings = null;
}

if (typeof browser !== "undefined") {
  window.fetchObject = async (id, defaultValue) => {
    if (_cachedSettings && _cachedSettings[id] !== undefined) {
      return _cachedSettings[id];
    }
    let result = await browser.storage.sync.get(id);
    if (result && result[id] != null) {
      if (typeof defaultValue === "number") return +result[id];
      return result[id];
    }
    // Fallback to local if not found in sync
    result = await browser.storage.local.get(id);
    if (result && result[id] != null) {
      if (typeof defaultValue === "number") return +result[id];
      return result[id];
    }
    return defaultValue;
  };

  window.fetchAllObjects = async () => {
    const sync = await browser.storage.sync.get(undefined);
    const local = await browser.storage.local.get(undefined);
    return { ...local, ...sync };
  };

  window.storeObject = async (id, obj) => {
    _cachedSettings = null;
    const items: Record<string, any> = {};
    items[id] = obj;
    try {
      return await browser.storage.sync.set(items);
    } catch (e) {
      console.warn("[STORAGE] sync.set failed, falling back to local:", e);
      return await browser.storage.local.set(items);
    }
  };

  window.removeObject = async (id) => {
    _cachedSettings = null;
    try {
      await browser.storage.sync.remove(id);
    } catch (e) {
      console.warn("[STORAGE] sync.remove failed, falling back to local:", e);
    }
    await browser.storage.local.remove(id);
  };
} else if (window.location.protocol.startsWith("http")) {
  // Development fallback: localStorage for settings only.
  window.fetchObject = async (id, defaultValue) => {
    const value = localStorage.getItem(id);
    if (value !== null) {
      try {
        const parsed = JSON.parse(value);
        if (typeof defaultValue === "number") return +parsed;
        return parsed;
      } catch (e) {
        return value;
      }
    }
    return defaultValue;
  };
  window.fetchAllObjects = async () => ({ ...localStorage });
  window.storeObject = async (id, obj) => {
    _cachedSettings = null;
    localStorage.setItem(id, typeof obj === "string" ? obj : JSON.stringify(obj));
  };
  window.removeObject = async (id) => {
    _cachedSettings = null;
    localStorage.removeItem(id);
  };
}

// Temporary IDs for in-memory playlist objects before they are saved to YouTube.
window.generatePlaylistId = async () => Date.now().toString();
window.generatePlaylistIds = async (size: number) => {
  const base = Date.now();
  return [...Array(size).keys()].map((i) => (base + i).toString());
};

// ─── Settings ─────────────────────────────────────────────────────────────────

window.getSettings = async (): Promise<Settings> => {
  if (_cachedSettings) {
    return { ..._cachedSettings };
  }
  if (_settingsInFlight) {
    return await _settingsInFlight;
  }

  _settingsInFlight = (async (): Promise<Settings> => {
    const DEFAULT_SETTINGS: Settings = {
      openPlaylistEditorAfterCreation: true,
      openPlaylistPage: false,
      closeAddedTabs: true,
      disableThumbnails: false,
      openPlaylistBuilderAfterAdd: true,
      openSavedPlaylistAfterAdd: true,
      defaultEditorPage: "/saved",
      saveCreatedPlaylists: false,
      disableContextBuilder: false,
      disableContextSaved: false,
      themeChoice: "device",
      defaultPageSize: 100,
      cacheDuration: -1, // -1 = no expiration
      watchLaterPlaylistId: null, // null = use YouTube's Watch Later
      maxLogLines: 500,
      defaultPrivacy: "private",
      autoRemoveDuplicates: false,
      autoDeleteEmptyPlaylists: false,
      addToLatestPosition: "bottom",
      defaultQuickAddTarget: "create",
      defaultTabScope: "all-this-window-include",
      manageSortBy: "newest",
      deleteAfterMerge: true,
      ruleEnabled: true,
      ruleTrackPause: true,
      ruleTrackUnload: true,
      ruleAutoDelete: false,
      ruleCompletionThreshold: 99,
      ruleHistoryRetentionDays: 30,
      ruleHistoryThrottleMs: 5000, // Minimum time between saves in milliseconds
      ruleHistoryDebounceMs: 1000, // Delay before saving after pause/unload in milliseconds
      ruleTrackDuringPlayback: false, // Enable periodic position saves during active playback
      playAllChunkEnabled: false, // split large playlists into multiple tabs
      playAllChunkSize: 50, // max videos per tab when chunking is enabled
      enableLikedVideos: false,
      enableUploadedVideos: false,
      enableSubscriptions: false,
      enableActivities: false,
      enableSearch: false,
      enableComments: false,
      enableAccountPlaylists: false,
      enableWatchLater: false,
      enableOpenById: false,
      enableMyChannel: false,
      autoSaveEditor: false,
      autoSaveInterval: 2,
      autoRetryEnabled: true, // Auto-retry sync after quota reset (default ON)
      autoFetchMetadata: false, // Auto-fetch missing metadata on page load (default OFF)
      metadataExecutionStrategy: "free_first",
      enableInnertubeScraping: true,
      enableEmbedScraping: true,
      enableOEmbedScraping: true,
      enableInvidiousPiped: true,
      customInvidiousInstances: "",
      customPipedInstances: "",
    };

    if (typeof browser === "undefined" || !browser.storage) {
      if (typeof localStorage !== "undefined") {
        const localSettings: any = {};
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            try {
              localSettings[key] = JSON.parse(val);
            } catch {
              localSettings[key] = val;
            }
          }
        }
        _cachedSettings = { ...DEFAULT_SETTINGS, ...localSettings } as Settings;
        return { ..._cachedSettings };
      }
      _cachedSettings = { ...DEFAULT_SETTINGS };
      return { ..._cachedSettings };
    }

    try {
      const [syncItems, localItems] = await Promise.all([
        browser.storage.sync.get(undefined).catch(() => ({})),
        browser.storage.local.get(undefined).catch(() => ({})),
      ]);

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        ...localItems,
        ...syncItems,
      } as Settings;

      await migrateSettings(settings);
      _cachedSettings = settings;
      return { ...settings };
    } catch (e) {
      console.warn("[STORAGE] Failed to fetch settings in batch, returning defaults:", e);
      _cachedSettings = { ...DEFAULT_SETTINGS };
      return { ..._cachedSettings };
    } finally {
      _settingsInFlight = null;
    }
  })();

  return await _settingsInFlight;
};

async function migrateSettings(settings: Settings) {
  if (typeof browser === "undefined") return;
  if (settings.createdPlaylistStorage === "saved") {
    settings.saveCreatedPlaylists = true;
    await browser.storage.sync.set({
      saveCreatedPlaylists: settings.saveCreatedPlaylists,
    });
  }
  if ((settings.defaultEditorPage as any) === "/recent") {
    settings.defaultEditorPage = "/saved";
    await browser.storage.sync.set({
      defaultEditorPage: settings.defaultEditorPage,
    });
  }
}

// ─── Data Management ────────────────────────────────────────────────────────

function persistCache(): void {
  if (typeof browser === "undefined") return;
  const data: Record<string, any> = {};
  if (_cache.list) data.list = _cache.list;
  if (_cache.accountList) data.accountList = _cache.accountList;
  if (Object.keys(data).length > 0) {
    browser.storage.local.set({ [PERSISTENT_CACHE_KEY]: data }).catch(() => {});
  }
}

function notifyPlaylistsChanged() {
  bustCache();
  persistCache();
  if (typeof browser !== "undefined") {
    browser.runtime.sendMessage({ cmd: "update-saved-playlists" }).catch(() => {});
  }
}

window.invalidateCacheAndNotify = () => {
  notifyPlaylistsChanged();
};

if (typeof window !== "undefined") {
  window.addEventListener("yt-auth-changed", async () => {
    try {
      console.log(
        "[STORAGE] Auth change detected, ensuring favorite Watch Later playlist is updated..."
      );
      await window.ensureWatchLaterPlaylist();
    } catch (e) {
      console.error("[STORAGE] Failed to ensure Watch Later playlist on auth change:", e);
    }
  });
}

export {};
