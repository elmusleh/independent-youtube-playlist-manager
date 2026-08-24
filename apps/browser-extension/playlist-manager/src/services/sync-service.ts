import type { Playlist, Video } from "../types/model.js";
import { SystemLogger } from "./logger-service.js";

// Guard to prevent duplicate declarations
if ((window as any)._syncServiceLoaded) {
  console.warn("sync-service already loaded - skipping");
} else {
  (window as any)._syncServiceLoaded = true;
}

const SYNC_PACE_MS = 150;

/**
 * SyncService handles the reconciliation between local state and YouTube cloud state.
 * Following the "Offline-First" principle, local changes are pushed to YouTube.
 */
class SyncService {
  private _isSyncing = false;
  private _syncLock = false;

  private async updateGlobalStatus(status: { active: boolean, playlistId?: string, playlistTitle?: string, progress?: number, message?: string }) {
    if (typeof browser === "undefined") return;
    try {
      await browser.storage.local.set({
        yph_sync_status: {
          ...status,
          lastUpdated: Date.now()
        }
      });
    } catch (e) {
      console.warn("Failed to update global sync status", e);
    }
  }

  public async syncPlaylist(playlistId: string): Promise<void> {
    if (this._isSyncing) {
      throw new Error("A synchronization is already in progress.");
    }

    const playlist = await window.getPlaylist(playlistId);
    if (!playlist) throw new Error("Playlist not found: " + playlistId);
    if (playlist.isLocal || playlist.id.startsWith("local-")) {
      await SystemLogger.info('SyncService', 'syncPlaylist skipped (local-only)', { playlistId });
      return;
    }

    this._isSyncing = true;
    await this.updateGlobalStatus({ active: true, playlistId, playlistTitle: playlist.title, progress: 0, message: 'Starting...' });
    await SystemLogger.info('SyncService', 'syncPlaylist start', { playlistId, videoCount: playlist.videos.length });

    try {
      // 1. Fetch current YouTube state
      await this.updateGlobalStatus({ active: true, playlistId, playlistTitle: playlist.title, progress: 5, message: 'Fetching YouTube state...' });
      const ytItems = await window.ytGetPlaylistItems(playlistId);
      const ytVideoIds = ytItems.map(item => item.videoId);

      // ─── Phase 0: Conflict Detection & Merging ────────────────────────
      const baseSnapshot = await (window as any).getSyncSnapshot(playlistId) || [];
      const remoteAdded = ytVideoIds.filter((id: string) => !baseSnapshot.includes(id));
      const remoteRemoved = baseSnapshot.filter((id: string) => !ytVideoIds.includes(id));
      
      let mergedVideos = [...playlist.videos];
      let mergeHappened = false;

      // Rule: Remote additions should be merged into local state
      for (const vid of remoteAdded) {
        if (!mergedVideos.includes(vid)) {
          mergedVideos.push(vid);
          mergeHappened = true;
          if (window.logSystemEvent) await window.logSystemEvent("INFO", `Merge: Detected remote addition ${vid}. Merging into local state.`);
        }
      }

      // Rule: Remote removals should be reflected locally IF they were in our last known state
      // and haven't been re-added locally.
      for (const vid of remoteRemoved) {
        if (mergedVideos.includes(vid) && !playlist.videos.includes(vid)) {
          // This case means it's already gone from playlist.videos but was in snapshot.
          // No action needed, current sync will remove it from YT.
        }
      }

      if (mergeHappened) {
        playlist.videos = mergedVideos;
        // Immediate local save of merged state
        await (window as any)._saveToLocalStorage({ ...playlist, isDirty: true });
      }

      // 2. Identify required YouTube mutations to reach merged state
      const settings = await window.getSettings();
      const keepWatchedOnCloud = playlist.syncSettings?.keepWatchedOnCloud ?? settings.globalKeepWatchedOnCloud;

      const toAdd = playlist.videos.filter((vid: string) => !ytVideoIds.includes(vid));
      const toRemoveItems = ytItems.filter(item => {
        const isLocallyMissing = !playlist.videos.includes(item.videoId);
        return isLocallyMissing && !keepWatchedOnCloud;
      });

      // Progress Calculation
      const totalSteps = toRemoveItems.length + toAdd.length + playlist.videos.length + 2;
      let completedSteps = 0;

      const report = async (msg: string) => {
        completedSteps++;
        const pct = Math.min(95, Math.round((completedSteps / totalSteps) * 100));
        await this.updateGlobalStatus({ active: true, playlistId, playlistTitle: playlist.title, progress: pct, message: msg });
      };

      // ─── Phase A: Removals ─────────────────────────────────
      const likedPlaylistId = await (window as any).ytGetLikedVideosPlaylistId();
      const isLiked = playlistId === "LIKED" || playlistId === likedPlaylistId;

      for (const item of toRemoveItems) {
        await report(`Removing ${item.videoId}...`);
        // Pass both item property to support specialized lists (like LIKED)
        await (window as any).ytRemoveItem(item.itemId, item.videoId, isLiked);
        await this._pace();
      }

      // ─── Phase B: Additions ────────────────────────────────
      for (const videoId of toAdd) {
        await report(`Adding ${videoId}...`);
        await window.ytAddVideo(playlistId, videoId);
        await this._pace();
      }

      // ─── Phase C: Reordering ───────────────────────────────
      // System playlists (LIKED, UPLOADS) do not support reordering via the API
      if (playlistId === "LIKED" || playlistId === likedPlaylistId || playlistId === "UPLOADS") {
        await report(`Skipping reorder for system playlist...`);
      } else {
        await report(`Fetching fresh state for reorder...`);
        const freshYtItems = await window.ytGetPlaylistItems(playlistId);
        
        for (let i = 0; i < playlist.videos.length; i++) {
          const desiredVideoId = playlist.videos[i];
          const currentItem = freshYtItems[i];

          if (!currentItem || currentItem.videoId !== desiredVideoId) {
            const currentIndex = freshYtItems.findIndex(item => item.videoId === desiredVideoId);
            if (currentIndex !== -1) {
              const itemToMove = freshYtItems[currentIndex];
              await report(`Ordering ${i+1}/${playlist.videos.length}...`);
              await window.ytMoveItem(itemToMove.itemId, playlistId, itemToMove.videoId, i);
              await this._pace();
              
              const [moved] = freshYtItems.splice(currentIndex, 1);
              freshYtItems.splice(i, 0, moved);
            }
          } else {
            completedSteps++;
          }
        }
      }

      // 4. Update local state
      await this.updateGlobalStatus({ active: true, playlistId, playlistTitle: playlist.title, progress: 98, message: 'Finalizing...' });
      const syncedPlaylist: Playlist = {
        ...playlist,
        isDirty: false,
        lastSyncedAt: Date.now()
      };
      
      await (window as any)._saveToLocalStorage(syncedPlaylist);
      // Update Snapshot
      await (window as any).saveSyncSnapshot(playlistId, [...syncedPlaylist.videos]);
      window.invalidateCacheAndNotify();

      await SystemLogger.info('SyncService', 'syncPlaylist success', { playlistId });
      await this.updateGlobalStatus({ active: false, progress: 100, message: 'Sync complete' });
    } catch (e) {
      await SystemLogger.error('SyncService', 'syncPlaylist failure', { playlistId, error: e });
      await this.updateGlobalStatus({ active: false, progress: 0, message: 'Sync failed' });
      this.notifyError(`Sync failed for "${playlist.title}": ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    } finally {
      this._isSyncing = false;
    }
  }

  private notifyError(message: string) {
    if (typeof browser === "undefined" || !browser.notifications) return;
    const isAndroid = /Android/i.test(navigator.userAgent);
    browser.notifications.create({
      type: 'basic',
      title: 'YPH: Synchronization Error',
      message: message,
      ...(isAndroid ? {} : { iconUrl: browser.runtime.getURL('assets/icons/icon_128.png') })
    });
  }

  /**
   * background processor: Pulls latest state from YouTube for all managed playlists.
   * Only updates if local state is NOT dirty.
   */
  public async refreshAllManaged(): Promise<void> {
    if (this._syncLock) return;
    const signedIn = await (window as any).isSignedIn();
    if (!signedIn) return;

    this._syncLock = true;
    try {
      const playlists = await (window as any).getPlaylists() as Playlist[];
      const managed = playlists.filter((p) => p.isTagged && !p.isLocal && !p.isDirty);
      
      if (managed.length === 0) return;

      await SystemLogger.info('SyncService', 'refreshAllManaged start', { count: managed.length });

      for (const p of managed) {
        try {
          const ytItems = await window.ytGetPlaylistItems(p.id);
          const ytVideoIds = ytItems.map(item => item.videoId);
          
          // Basic array equality check
          const isSame = p.videos.length === ytVideoIds.length && 
                         p.videos.every((val: string, index: number) => val === ytVideoIds[index]);

          if (!isSame) {
            const updated = { ...p, videos: ytVideoIds, lastSyncedAt: Date.now() };
            await (window as any)._saveToLocalStorage(updated);
            // Update Snapshot
            await (window as any).saveSyncSnapshot(p.id, [...ytVideoIds]);
            if (window.logSystemEvent) await window.logSystemEvent("INFO", `Background Refresh: Updated playlist "${p.title}" from YouTube`);
          }
        } catch (e) {
          console.error(`Failed to refresh playlist ${p.id}`, e);
        }
        await this._pace();
      }
      window.invalidateCacheAndNotify();
    } finally {
      this._syncLock = false;
    }
  }

  /**
   * background processor: finds all dirty playlists and syncs them sequentially.
   */
  public async syncAllDirty(): Promise<void> {
    if (this._syncLock) return;
    this._syncLock = true;

    try {
      const playlists = await (window as any).getPlaylists();
      const dirty = playlists.filter((p: any) => p.isDirty && !p.isLocal);
      
      if (dirty.length === 0) return;

      await SystemLogger.info('SyncService', 'syncAllDirty start', { count: dirty.length });

      for (const p of dirty) {
        try {
          await this.syncPlaylist(p.id);
        } catch (e) {
          console.error(`Failed to auto-sync playlist ${p.id}`, e);
        }
      }
    } finally {
      this._syncLock = false;
    }
  }

  public isSyncing(): boolean {
    return this._isSyncing;
  }

  private _pace(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, SYNC_PACE_MS));
  }
}

// Export as window global for extension visibility
(window as any).SyncService = new SyncService();

export {};
