/**
 * Watch history merge for Sync v2.
 *
 * Per-video last-writer-wins with tombstones:
 *   - Each video's history entry is its own record
 *   - Newest `lastWatchedAt` wins
 *   - Deleting a history item syncs as a tombstone
 *   - No cross-video conflicts possible
 */

import type { RecordEnvelope } from "../record-codec";
import { compareHlc } from "../hlc";

export type HistoryEntry = {
  videoId: string;
  title?: string;
  channelName?: string;
  lastWatchedAt: number;
  watchCount?: number;
  progress?: number; // 0-1
  duration?: number;
  [key: string]: unknown;
};

export type HistoryRecord = RecordEnvelope<HistoryEntry>;
export type HistoryTombstone = RecordEnvelope<null>;

export type MergeResult = {
  merged: HistoryEntry[];
  tombstones: string[]; // videoIds that were deleted
};

/**
 * Merge two history arrays with a common base.
 * Each video is independent - per-video LWW with tombstones.
 */
export function mergeHistory(
  local: HistoryEntry[],
  remote: HistoryEntry[],
  base: HistoryEntry[]
): MergeResult {
  const mergedMap = new Map<string, HistoryEntry>();
  const tombstones = new Set<string>();

  const localMap = new Map(local.map((h) => [h.videoId, h]));
  const remoteMap = new Map(remote.map((h) => [h.videoId, h]));
  const baseMap = new Map(base.map((h) => [h.videoId, h]));

  const allVideoIds = new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()]);

  for (const videoId of allVideoIds) {
    const l = localMap.get(videoId) ?? null;
    const r = remoteMap.get(videoId) ?? null;
    const b = baseMap.get(videoId) ?? null;

    const result = mergeSingleHistory(l, r, b);
    if (result.entry) mergedMap.set(videoId, result.entry);
    if (result.tombstone) tombstones.add(videoId);
  }

  // Sort by lastWatchedAt descending (most recent first)
  const merged = [...mergedMap.values()].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);

  return { merged, tombstones: [...tombstones] };
}

/**
 * Merge a single history entry (per-video LWW).
 */
function mergeSingleHistory(
  local: HistoryEntry | null,
  remote: HistoryEntry | null,
  base: HistoryEntry | null
): { entry: HistoryEntry | null; tombstone: string | null } {
  // Both deleted -> tombstone
  if (!local && !remote) {
    if (base) return { entry: null, tombstone: base.videoId };
    return { entry: null, tombstone: null };
  }

  // Only local exists
  if (local && !remote) {
    // If base exists and local == base, it's unchanged
    if (base && historyEqual(local, base)) {
      return { entry: local, tombstone: null };
    }
    return { entry: local, tombstone: null };
  }

  // Only remote exists
  if (!local && remote) {
    if (base && historyEqual(remote, base)) {
      return { entry: remote, tombstone: null };
    }
    return { entry: remote, tombstone: null };
  }

  // Both exist - compare lastWatchedAt (LWW)
  if (local && remote) {
    if (local.lastWatchedAt >= remote.lastWatchedAt) {
      return { entry: local, tombstone: null };
    }
    return { entry: remote, tombstone: null };
  }

  return { entry: null, tombstone: null };
}

/**
 * Check if two history entries are equal.
 */
function historyEqual(a: HistoryEntry, b: HistoryEntry): boolean {
  return (
    a.videoId === b.videoId &&
    a.lastWatchedAt === b.lastWatchedAt &&
    a.watchCount === b.watchCount &&
    a.progress === b.progress
  );
}

/**
 * Create a tombstone for a deleted history entry.
 */
export function createHistoryTombstone(videoId: string): HistoryTombstone {
  return {
    v: 2,
    collection: "history",
    id: videoId,
    hlc: Date.now(),
    deleted: true,
    data: null,
  };
}
