/**
 * Playlist merge for Sync v2.
 *
 * Implements 3-way merge (and optional Last-Write-Wins) for playlists:
 *   - Each playlist is its own record
 *   - Edits to different playlists never conflict
 *   - Concurrent edits to the SAME playlist:
 *       * Title: single-sided edit wins cleanly; concurrent edit uses latest timestamp/HLC
 *       * Videos: add/remove merge (supports both `string[]` IDs and `PlaylistVideo[]`)
 *       * If one device deletes while another edits: edit wins, conflict logged
 */

import type { RecordEnvelope } from "../record-codec";
import {
  mergeVideoArrays,
  playlistVideosEqual,
  type PlaylistVideo,
  type VideoEntry,
} from "./playlist-videos";

export type { PlaylistVideo };

export type Playlist = {
  id: string; // local playlist id
  title: string;
  description?: string;
  videos: VideoEntry[];
  createdAt?: number | string;
  updatedAt?: number | string;
  timestamp?: number;
  revision?: number;
  pinned?: boolean;
  isWatchLater?: boolean;
  [key: string]: unknown;
};

export type PlaylistRecord = RecordEnvelope<Playlist>;
export type PlaylistTombstone = RecordEnvelope<null>;

export type MergeOptions = {
  strategy?: "merge" | "lww";
  remoteVersions?: Map<string, number>;
};

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

function toEpochMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function getPlaylistTimestamp(playlist: Playlist, overrideVersion?: number): number {
  return (
    toEpochMs(playlist.updatedAt) ||
    toEpochMs(playlist.timestamp) ||
    toEpochMs(playlist.createdAt) ||
    overrideVersion ||
    0
  );
}

function formatMergedUpdatedAt(local: Playlist, remote: Playlist, maxMs: number): number | string {
  if (typeof local.updatedAt === "string" || typeof remote.updatedAt === "string") {
    return new Date(maxMs > 0 ? maxMs : Date.now()).toISOString();
  }
  return maxMs;
}

/**
 * Merge two playlist arrays with a common base (3-way merge or LWW).
 * Each playlist is merged independently.
 */
export function mergePlaylists(
  local: Playlist[],
  remote: Playlist[],
  base: Playlist[],
  options: MergeOptions = {}
): MergeResult {
  const conflicts: MergeConflict[] = [];
  const mergedMap = new Map<string, Playlist>();

  const localMap = new Map(local.map((p) => [p.id, p]));
  const remoteMap = new Map(remote.map((p) => [p.id, p]));
  const baseMap = new Map(base.map((p) => [p.id, p]));

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()]);

  for (const id of allIds) {
    const l = localMap.get(id) ?? null;
    const r = remoteMap.get(id) ?? null;
    const b = baseMap.get(id) ?? null;

    const result = mergeSinglePlaylist(l, r, b, options, options.remoteVersions?.get(id));
    if (result.playlist) mergedMap.set(id, result.playlist);
    if (result.conflict) conflicts.push(result.conflict);
  }

  return { merged: [...mergedMap.values()], conflicts };
}

function mergeSinglePlaylist(
  local: Playlist | null,
  remote: Playlist | null,
  base: Playlist | null,
  options: MergeOptions,
  remoteVersion?: number
): { playlist: Playlist | null; conflict: MergeConflict | null } {
  if (!local && !remote) {
    return { playlist: null, conflict: null };
  }
  if (!local && remote && base && playlistsEqual(remote, base)) {
    return { playlist: null, conflict: null };
  }
  if (local && !remote && base && playlistsEqual(local, base)) {
    return { playlist: null, conflict: null };
  }
  if (!local && remote && base && !playlistsEqual(remote, base)) {
    return {
      playlist: remote,
      conflict: {
        type: "delete-vs-edit",
        playlistId: remote.id,
        local: null,
        remote,
        base,
        resolution: "remote",
        message: `Playlist "${remote.title}" was deleted locally but edited remotely. Remote edit kept.`,
      },
    };
  }
  if (local && !remote && base && !playlistsEqual(local, base)) {
    return {
      playlist: local,
      conflict: {
        type: "delete-vs-edit",
        playlistId: local.id,
        local,
        remote: null,
        base,
        resolution: "local",
        message: `Playlist "${local.title}" was deleted remotely but edited locally. Local edit kept.`,
      },
    };
  }
  if (local && !remote && !base) {
    return { playlist: local, conflict: null };
  }
  if (!local && remote && !base) {
    return { playlist: remote, conflict: null };
  }
  if (local && remote) {
    return mergeModifiedPlaylist(local, remote, base, options.strategy ?? "merge", remoteVersion);
  }
  return { playlist: null, conflict: null };
}

function mergeModifiedPlaylist(
  local: Playlist,
  remote: Playlist,
  base: Playlist | null,
  strategy: "merge" | "lww",
  remoteVersion?: number
): { playlist: Playlist; conflict: MergeConflict | null } {
  if (playlistsEqual(local, remote)) {
    return { playlist: local, conflict: null };
  }

  if (base) {
    if (playlistsEqual(local, base) && !playlistsEqual(remote, base)) {
      return { playlist: remote, conflict: null };
    }
    if (playlistsEqual(remote, base) && !playlistsEqual(local, base)) {
      return { playlist: local, conflict: null };
    }
  }

  const localTime = getPlaylistTimestamp(local);
  const remoteTime = getPlaylistTimestamp(remote, remoteVersion);
  const remoteIsNewer = remoteTime > localTime;
  const maxTime = Math.max(localTime, remoteTime);
  const nextRevision = Math.max(Number(local.revision) || 0, Number(remote.revision) || 0) + 1;

  if (strategy === "lww") {
    const winner = remoteIsNewer ? remote : local;
    const resolution = remoteIsNewer ? "remote" : "local";
    return {
      playlist: {
        ...winner,
        updatedAt: formatMergedUpdatedAt(local, remote, maxTime),
        revision: nextRevision,
      },
      conflict: {
        type: "video-conflict",
        playlistId: local.id,
        local,
        remote,
        base,
        resolution,
        message: `Concurrent edits on "${winner.title}" resolved via Last-Write-Wins (${resolution}).`,
      },
    };
  }

  let title = local.title;
  let titleConflict: MergeConflict | null = null;
  if (local.title !== remote.title) {
    if (base && local.title === base.title) {
      title = remote.title;
    } else if (base && remote.title === base.title) {
      title = local.title;
    } else if (!remoteIsNewer) {
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

  const videos = mergeVideoArrays(
    local.videos || [],
    remote.videos || [],
    base?.videos || [],
    remoteIsNewer
  );

  const merged: Playlist = {
    ...local,
    ...(remoteIsNewer ? remote : {}),
    id: local.id,
    title,
    videos,
    updatedAt: formatMergedUpdatedAt(local, remote, maxTime),
    revision: nextRevision,
  };

  if (base) {
    if (local.description === base.description && remote.description !== base.description) {
      merged.description = remote.description;
    } else if (remote.description === base.description && local.description !== base.description) {
      merged.description = local.description;
    }
  }

  return { playlist: merged, conflict: titleConflict };
}

/**
 * Check if two playlists are equal (for detecting unchanged).
 */
export function playlistsEqual(a: Playlist, b: Playlist): boolean {
  if (a.title !== b.title) return false;
  if (a.description !== b.description) return false;
  return playlistVideosEqual(a.videos || [], b.videos || []);
}
