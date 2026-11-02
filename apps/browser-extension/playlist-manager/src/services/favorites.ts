import type { Settings } from "../types/model";

/** A favorite playlist resolved to the shape the sidebar and Favorites page need. */
export interface FavoritePlaylistInfo {
  id: string;
  title: string;
  videoCount: number;
  isLocal: boolean;
  thumbnailUrl?: string;
}

/** Number of pinned favorites shown directly in the sidebar before the overflow link. */
export const MAX_VISIBLE_FAVORITES = 6;

/** Coerce arbitrary stored data into a de-duplicated list of playlist ids. */
export function sanitizeFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.length === 0) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

export function isFavorite(ids: unknown, id: string): boolean {
  return Array.isArray(ids) && ids.includes(id);
}

/** Add or remove `id`; returns a new list. New entries are pinned at the end. */
export function toggleFavorite(ids: unknown, id: string): string[] {
  const list = sanitizeFavoriteIds(ids);
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [...list, id];
}

/** Move an item one step up (-1) or down (+1). Returns a new list. */
export function moveFavorite(ids: unknown, index: number, direction: -1 | 1): string[] {
  const list = sanitizeFavoriteIds(ids);
  const target = index + direction;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export async function getFavoriteIds(): Promise<string[]> {
  const settings: Settings = await window.getSettings();
  return sanitizeFavoriteIds(settings.favoritePlaylistIds);
}

/** Persist the ordered list and notify the rest of the app. */
export async function persistFavoriteIds(ids: unknown): Promise<void> {
  const list = sanitizeFavoriteIds(ids);
  await window.storeObject("favoritePlaylistIds", list);
  window.invalidateCacheAndNotify();
}

/**
 * Resolve favorite ids to display info, dropping any that no longer resolve
 * (deleted playlists, or YouTube playlists locked behind sign-out). Local-first
 * and cached-first via `getPlaylist`, so this never triggers a network storm.
 */
export async function resolveFavoritePlaylists(ids: unknown): Promise<FavoritePlaylistInfo[]> {
  const result: FavoritePlaylistInfo[] = [];
  for (const id of sanitizeFavoriteIds(ids)) {
    try {
      const playlist = await window.getPlaylist(id);
      if (!playlist) continue;
      const firstVideoId = playlist.videos?.[0];
      result.push({
        id: playlist.id,
        title: playlist.title || "Untitled Playlist",
        videoCount: playlist.videos?.length ?? 0,
        isLocal: !!playlist.isLocal || id.startsWith("local-"),
        thumbnailUrl: firstVideoId
          ? (window.videoService?.getVideoThumbnailUrl?.(firstVideoId) ?? undefined)
          : undefined,
      });
    } catch {
      // A favorite that fails to resolve is simply not shown.
    }
  }
  return result;
}
