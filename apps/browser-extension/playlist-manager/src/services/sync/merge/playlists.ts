/**
 * Playlist merge for Sync v2.
 *
 * Implements 3-way merge for playlists:
 *   - Each playlist is its own record
 *   - Edits to different playlists never conflict
 *   - Concurrent edits to the SAME playlist:
 *       * Title: latest HLC wins
 *       * Videos: add/remove merge (additions from both sides kept, removals from both applied)
 *       * If one device deletes while another edits: edit wins, conflict logged
 */

import type { RecordEnvelope } from "../record-codec";
import type { HlcTimestamp } from "../hlc";
import { compareHlc } from "../hlc";

export type PlaylistVideo = {
  videoId: string;
  title?: string;
  channelName?: string;
  duration?: number;
  position?: number;
  addedAt?: number;
  [key: string]: unknown;
};

export type Playlist = {
  id: string; // local playlist id
  title: string;
  description?: string;
  videos: PlaylistVideo[];
  createdAt: number;
  updatedAt: number;
  revision: number;
  pinned?: boolean;
  isWatchLater?: boolean;
  [key: string]: unknown;
};

export type PlaylistRecord = RecordEnvelope<Playlist>;
export type PlaylistTombstone = RecordEnvelope<null>;

export type MergeResult = {
  merged: Playlist[];
  conflicts: MergeConflict[];
};

export type MergeConflict = {
  type: "delete-vs-edit" | "title-conflict" | "video-conflict";
  playlistId: string;
  local: Playlist | null;
  remote: Playlist | null;
  base: Playlist | null;
  resolution: "local" | "remote" | "merged";
  message: string;
};

/**
 * Merge two playlist arrays with a common base (3-way merge).
 * Each playlist is merged independently based on its HLC.
 */
export function mergePlaylists(
  local: Playlist[],
  remote: Playlist[],
  base: Playlist[]
): MergeResult {
  const conflicts: MergeConflict[] = [];
  const mergedMap = new Map<string, Playlist>();

  // Index by local playlist id
  const localMap = new Map(local.map((p) => [p.id, p]));
  const remoteMap = new Map(remote.map((p) => [p.id, p]));
  const baseMap = new Map(base.map((p) => [p.id, p]));

  // All playlist IDs across all three versions
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()]);

  for (const id of allIds) {
    const l = localMap.get(id) ?? null;
    const r = remoteMap.get(id) ?? null;
    const b = baseMap.get(id) ?? null;

    const result = mergeSinglePlaylist(l, r, b);
    if (result.playlist) mergedMap.set(id, result.playlist);
    if (result.conflict) conflicts.push(result.conflict);
  }

  return { merged: [...mergedMap.values()], conflicts };
}

/**
 * Merge a single playlist (3-way).
 * Returns merged playlist and optional conflict.
 */
function mergeSinglePlaylist(
  local: Playlist | null,
  remote: Playlist | null,
  base: Playlist | null
): { playlist: Playlist | null; conflict: MergeConflict | null } {
  // Case 1: Deleted on both sides
  if (!local && !remote) {
    return { playlist: null, conflict: null };
  }

  // Case 2: Deleted locally, unchanged remotely -> keep deleted
  if (!local && remote && base && playlistsEqual(remote, base)) {
    return { playlist: null, conflict: null };
  }

  // Case 3: Deleted remotely, unchanged locally -> keep deleted
  if (local && !remote && base && playlistsEqual(local, base)) {
    return { playlist: null, conflict: null };
  }

  // Case 4: Deleted on one side, EDITED on the other -> EDIT wins (with conflict)
  if (!local && remote && base && !playlistsEqual(remote, base)) {
    const conflict: MergeConflict = {
      type: "delete-vs-edit",
      playlistId: remote.id,
      local: null,
      remote,
      base,
      resolution: "remote",
      message: `Playlist "${remote.title}" was deleted locally but edited remotely. Remote edit kept.`,
    };
    return { playlist: remote, conflict };
  }

  if (local && !remote && base && !playlistsEqual(local, base)) {
    const conflict: MergeConflict = {
      type: "delete-vs-edit",
      playlistId: local.id,
      local,
      remote: null,
      base,
      resolution: "local",
      message: `Playlist "${local.title}" was deleted remotely but edited locally. Local edit kept.`,
    };
    return { playlist: local, conflict };
  }

  // Case 5: New on one side only (not in base)
  if (local && !remote && !base) {
    return { playlist: local, conflict: null };
  }
  if (!local && remote && !base) {
    return { playlist: remote, conflict: null };
  }

  // Case 6: Both sides have it - need 3-way merge
  if (local && remote && base) {
    return mergeModifiedPlaylist(local, remote, base);
  }

  // Case 7: Both sides have it, no base (shouldn't happen, but handle)
  if (local && remote && !base) {
    return mergeModifiedPlaylist(local, remote, null);
  }

  // Case 8: Only in base (deleted on both) - already handled
  return { playlist: null, conflict: null };
}

/**
 * Merge two modified versions of the same playlist with a common base.
 */
function mergeModifiedPlaylist(
  local: Playlist,
  remote: Playlist,
  base: Playlist | null
): { playlist: Playlist; conflict: MergeConflict | null } {
  // If identical, no conflict
  if (playlistsEqual(local, remote)) {
    return { playlist: local, conflict: null };
  }

  // Determine which version is newer using HLC (updatedAt as proxy for now)
  // In production, we'd use the record's HLC timestamp
  const localTime = local.updatedAt || local.createdAt || 0;
  const remoteTime = remote.updatedAt || remote.createdAt || 0;

  // Title conflict: latest wins
  let title = local.title;
  let titleConflict: MergeConflict | null = null;
  if (local.title !== remote.title) {
    if (localTime >= remoteTime) {
      title = local.title;
      titleConflict = {
        type: "title-conflict",
        playlistId: local.id,
        local,
        remote,
        base,
        resolution: "local",
        message: `Title conflict: "${local.title}" vs "${remote.title}". Local (newer) kept.`,
      };
    } else {
      title = remote.title;
      titleConflict = {
        type: "title-conflict",
        playlistId: local.id,
        local,
        remote,
        base,
        resolution: "remote",
        message: `Title conflict: "${local.title}" vs "${remote.title}". Remote (newer) kept.`,
      };
    }
  }

  // Video merge: add/remove merge
  const localVideos = local.videos || [];
  const remoteVideos = remote.videos || [];
  const baseVideos = base?.videos || [];

  const { videos, videoConflicts } = mergeVideos(localVideos, remoteVideos, baseVideos);

  // Merge other fields (latest wins)
  const merged: Playlist = {
    ...local, // start with local as base
    title,
    videos,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    revision: Math.max(local.revision, remote.revision) + 1,
  };

  // If base exists, preserve fields that only changed on one side
  if (base) {
    if (local.description === base.description && remote.description !== base.description) {
      merged.description = remote.description;
    } else if (remote.description === base.description && local.description !== base.description) {
      merged.description = local.description;
    }
    // For other fields, local wins by default (could be smarter)
  }

  const allConflicts = [titleConflict, ...videoConflicts].filter(
    (c): c is MergeConflict => c !== null
  );
  return { playlist: merged, conflict: allConflicts[0] ?? null }; // Return first conflict for logging
}

/**
 * Merge video arrays (3-way add/remove merge).
 * - Additions from both sides are kept
 * - Removals from both sides are applied
 * - Position: latest wins for moved videos
 */
function mergeVideos(
  local: PlaylistVideo[],
  remote: PlaylistVideo[],
  base: PlaylistVideo[]
): { videos: PlaylistVideo[]; videoConflicts: MergeConflict[] } {
  const conflicts: MergeConflict[] = [];
  const videoMap = new Map<string, PlaylistVideo>();

  // Index by videoId
  const localMap = new Map(local.map((v) => [v.videoId, v]));
  const remoteMap = new Map(remote.map((v) => [v.videoId, v]));
  const baseMap = new Map(base.map((v) => [v.videoId, v]));

  const allVideoIds = new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()]);

  for (const videoId of allVideoIds) {
    const l = localMap.get(videoId) ?? null;
    const r = remoteMap.get(videoId) ?? null;
    const b = baseMap.get(videoId) ?? null;

    // Added on both sides -> keep (dedupe)
    if (!b && l && r) {
      videoMap.set(videoId, l); // local wins for metadata
      continue;
    }

    // Added on one side -> keep
    if (!b && l && !r) {
      videoMap.set(videoId, l);
      continue;
    }
    if (!b && !l && r) {
      videoMap.set(videoId, r);
      continue;
    }

    // Existed in base
    if (b) {
      // Removed on both -> drop
      if (!l && !r) {
        continue;
      }
      // Removed on one side -> drop
      if (!l && r) {
        continue;
      }
      if (l && !r) {
        continue;
      }
      // Modified on both -> merge metadata, latest position wins
      if (l && r) {
        const mergedVideo: PlaylistVideo = { ...l };
        // Position: latest wins
        if (l.position !== r.position) {
          const lTime = l.addedAt || 0;
          const rTime = r.addedAt || 0;
          if (rTime > lTime) mergedVideo.position = r.position;
        }
        // Title/channel: latest wins
        if (l.title !== r.title || l.channelName !== r.channelName) {
          const lTime = l.addedAt || 0;
          const rTime = r.addedAt || 0;
          if (rTime > lTime) {
            mergedVideo.title = r.title;
            mergedVideo.channelName = r.channelName;
          }
        }
        videoMap.set(videoId, mergedVideo);
      }
    }
  }

  // Sort by position, then by addedAt
  const videos = [...videoMap.values()].sort((a, b) => {
    const posA = a.position ?? Number.MAX_SAFE_INTEGER;
    const posB = b.position ?? Number.MAX_SAFE_INTEGER;
    if (posA !== posB) return posA - posB;
    return (a.addedAt || 0) - (b.addedAt || 0);
  });

  return { videos, videoConflicts: conflicts };
}

/**
 * Check if two playlists are equal (for detecting unchanged).
 */
function playlistsEqual(a: Playlist, b: Playlist): boolean {
  if (a.title !== b.title) return false;
  if (a.description !== b.description) return false;
  if (a.videos.length !== b.videos.length) return false;
  for (let i = 0; i < a.videos.length; i++) {
    if (a.videos[i].videoId !== b.videos[i].videoId) return false;
    if (a.videos[i].position !== b.videos[i].position) return false;
  }
  return true;
}
