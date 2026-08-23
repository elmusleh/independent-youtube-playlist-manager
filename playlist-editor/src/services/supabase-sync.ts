import { getSupabaseClient, getSession } from "./supabase-client";
import { dbGetMetadataBatch, dbPutMetadataBatch } from "./db-service";
import type { NormalizedVideoMeta, Playlist, SyncRecord, CatalogVideo } from "../types/model";

declare const chrome: any;
declare const browser: any;

const LOCAL_PLAYLISTS_KEY = "yph_local_playlists";
const LAST_SYNC_KEY = "yph:last_sync_timestamp";

/**
 * Bidirectional delta sync manager with Last-Write-Wins (LWW) conflict resolution
 */
export class BackgroundSyncEngine {
  private isSyncing = false;
  private retryDelayMs = 1000;
  private maxRetryDelayMs = 30000;

  /**
   * Main sync trigger: Pushes local mutations and pulls remote delta changes
   */
  async triggerSync(): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> {
    if (this.isSyncing) {
      return { success: false, pushed: 0, pulled: 0, error: "Sync already in progress" };
    }
    this.isSyncing = true;

    try {
      const session = await getSession();
      if (!session || !session.user) {
        return { success: true, pushed: 0, pulled: 0, error: "User logged out (changes kept local)" };
      }

      const client = await getSupabaseClient();
      const userId = session.user.id;

      // 1. Push local changes (Pending & Soft-deleted)
      const pushedCount = await this.pushLocalChanges(client, userId);

      // 2. Pull remote delta updates
      const pulledCount = await this.pullRemoteChanges(client, userId);

      // Reset exponential backoff on success
      this.retryDelayMs = 1000;

      return { success: true, pushed: pushedCount, pulled: pulledCount };
    } catch (err: any) {
      console.error("[SUPABASE-SYNC] Background sync failed:", err);
      // Exponential backoff
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, this.maxRetryDelayMs);
      return { success: false, pushed: 0, pulled: 0, error: err.message || String(err) };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push local pending and soft-deleted records to Supabase
   */
  private async pushLocalChanges(client: any, userId: string): Promise<number> {
    const rawLocal = await this.getStorageItem<SyncRecord<Playlist>[]>(LOCAL_PLAYLISTS_KEY) || [];
    const pending = rawLocal.filter((p) => p.syncStatus !== "synced");
    if (pending.length === 0) return 0;

    let count = 0;

    for (const record of pending) {
      const playlist = record.data;

      if (record.syncStatus === "deleted") {
        // Soft delete (tombstone)
        await client
          .from("playlists")
          .update({ deleted_at: record.updatedAt })
          .eq("id", record.id)
          .eq("user_id", userId);
      } else {
        // Upsert playlist header
        const { error: plErr } = await client.from("playlists").upsert({
          id: record.id,
          user_id: userId,
          name: playlist.title,
          description: "",
          updated_at: record.updatedAt || new Date().toISOString(),
        });

        if (!plErr && Array.isArray(playlist.videos)) {
          // Sync playlist items ordering
          const itemsToUpsert = playlist.videos.map((vid, pos) => ({
            playlist_id: record.id,
            video_id: vid,
            position: pos,
            updated_at: new Date().toISOString(),
          }));

          if (itemsToUpsert.length > 0) {
            // First ensure videos exist in catalog (or push placeholder)
            const videoMetas = await dbGetMetadataBatch(playlist.videos);
            await this.syncVideoMetadataToCatalog(Object.values(videoMetas));

            await client.from("playlist_items").upsert(itemsToUpsert, {
              onConflict: "playlist_id,video_id",
            });
          }
        }
      }

      record.syncStatus = "synced";
      count++;
    }

    await this.setStorageItem(LOCAL_PLAYLISTS_KEY, rawLocal);
    return count;
  }

  /**
   * Pull remote delta updates from Supabase since last sync timestamp
   */
  private async pullRemoteChanges(client: any, userId: string): Promise<number> {
    const lastSync = (await this.getStorageItem<string>(LAST_SYNC_KEY)) || new Date(0).toISOString();

    // 1. Fetch updated playlists
    const { data: remotePlaylists, error: plErr } = await client
      .from("playlists")
      .select("*")
      .eq("user_id", userId)
      .gt("updated_at", lastSync);

    if (plErr || !remotePlaylists) return 0;

    const rawLocal = (await this.getStorageItem<SyncRecord<Playlist>[]>(LOCAL_PLAYLISTS_KEY)) || [];
    const localMap = new Map<string, SyncRecord<Playlist>>(rawLocal.map((p) => [p.id, p]));
    let pulledCount = 0;

    for (const remote of remotePlaylists) {
      const local = localMap.get(remote.id);

      // Last-Write-Wins (LWW) rule
      if (!local || new Date(remote.updated_at) > new Date(local.updatedAt)) {
        if (remote.deleted_at) {
          // Soft-deleted on another device
          localMap.delete(remote.id);
        } else {
          // Fetch remote playlist items
          const { data: items } = await client
            .from("playlist_items")
            .select("video_id, position")
            .eq("playlist_id", remote.id)
            .order("position", { ascending: true });

          const videoIds = items ? items.map((it: any) => it.video_id) : [];

          localMap.set(remote.id, {
            id: remote.id,
            data: {
              id: remote.id,
              title: remote.name,
              videos: videoIds,
              timestamp: new Date(remote.created_at || remote.updated_at).getTime(),
              isLocal: true,
              saved: true,
            },
            syncStatus: "synced",
            updatedAt: remote.updated_at,
          });
        }
        pulledCount++;
      }
    }

    await this.setStorageItem(LOCAL_PLAYLISTS_KEY, Array.from(localMap.values()));
    await this.setStorageItem(LAST_SYNC_KEY, new Date().toISOString());

    return pulledCount;
  }

  /**
   * Syncs video metadata into the global shared `videos_catalog` table (cross-user deduplication)
   */
  async syncVideoMetadataToCatalog(metas: NormalizedVideoMeta[]): Promise<void> {
    if (!metas || metas.length === 0) return;

    try {
      const client = await getSupabaseClient();
      const rows: CatalogVideo[] = metas.map((m) => ({
        video_id: m.videoId,
        title: m.title || "Unknown Title",
        channel: m.channel || "Unknown Channel",
        duration_iso: m.durationISO || "PT0S",
        duration_seconds: m.durationSeconds || 0,
        view_count: m.viewCount || 0,
        published_at: m.publishedAt || new Date().toISOString(),
        is_live: m.isLive || false,
        is_private: m.isPrivate || false,
        is_deleted: m.isDeleted || false,
        thumbnail_url: `https://i.ytimg.com/vi/${m.videoId}/hqdefault.jpg`,
        updated_at: new Date().toISOString(),
      }));

      await client.from("videos_catalog").upsert(rows, { onConflict: "video_id" });
    } catch (e) {
      console.warn("[SUPABASE-SYNC] Catalog upsert warning:", e);
    }
  }

  /**
   * Fetches metadata from global catalog before hitting YouTube API quota
   */
  async fetchCatalogMetadata(videoIds: string[]): Promise<Record<string, NormalizedVideoMeta>> {
    if (!videoIds || videoIds.length === 0) return {};

    try {
      const client = await getSupabaseClient();
      const { data, error } = await client
        .from("videos_catalog")
        .select("*")
        .in("video_id", videoIds);

      if (error || !data) return {};

      const result: Record<string, NormalizedVideoMeta> = {};
      const batchToSave: Array<{ id: string; meta: any }> = [];

      for (const row of data) {
        const meta: NormalizedVideoMeta = {
          videoId: row.video_id,
          title: row.title,
          channel: row.channel,
          durationISO: row.duration_iso,
          durationSeconds: row.duration_seconds,
          viewCount: Number(row.view_count || 0),
          publishedAt: row.published_at,
          isLive: Boolean(row.is_live),
          isPrivate: Boolean(row.is_private),
          isDeleted: Boolean(row.is_deleted),
          isBroken: false,
          lastCachedAt: Date.now(),
        };
        result[row.video_id] = meta;
        batchToSave.push({ id: row.video_id, meta });
      }

      // Populate local IndexedDB cache with catalog hits
      if (batchToSave.length > 0) {
        await dbPutMetadataBatch(batchToSave);
      }

      return result;
    } catch {
      return {};
    }
  }

  /**
   * Subscribes to Supabase Realtime WebSocket changes for instant cross-device updates
   */
  async subscribeToRealtimeChanges(onRemoteUpdate?: () => void): Promise<(() => void) | null> {
    try {
      const session = await getSession();
      if (!session || !session.user) return null;

      const client = await getSupabaseClient();
      const userId = session.user.id;

      const channel = client
        .channel(`realtime:playlists:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "playlists",
            filter: `user_id=eq.${userId}`,
          },
          async () => {
            console.log("[SUPABASE-REALTIME] Remote playlist change detected, pulling delta...");
            await this.pullRemoteChanges(client, userId);
            if (onRemoteUpdate) onRemoteUpdate();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "playlist_items",
          },
          async () => {
            console.log("[SUPABASE-REALTIME] Remote playlist item change detected, pulling delta...");
            await this.pullRemoteChanges(client, userId);
            if (onRemoteUpdate) onRemoteUpdate();
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    } catch (err) {
      console.warn("[SUPABASE-REALTIME] Failed to initialize realtime channel:", err);
      return null;
    }
  }

  // Cross-browser storage helpers
  private async getStorageItem<T>(key: string): Promise<T | null> {
    try {
      if (typeof browser !== "undefined" && browser?.storage?.local) {
        const res = await browser.storage.local.get(key);
        return res[key] || null;
      }
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        const res = await chrome.storage.local.get(key);
        return res[key] || null;
      }
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private async setStorageItem<T>(key: string, value: T): Promise<void> {
    try {
      if (typeof browser !== "undefined" && browser?.storage?.local) {
        await browser.storage.local.set({ [key]: value });
        return;
      }
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        await chrome.storage.local.set({ [key]: value });
        return;
      }
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
}

export const syncEngine = new BackgroundSyncEngine();

// Expose on global window object for background worker
if (typeof window !== "undefined") {
  (window as any).syncEngine = syncEngine;
  (window as any).supabaseGetSession = getSession;
}
