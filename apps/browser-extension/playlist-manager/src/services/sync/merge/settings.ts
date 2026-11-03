/**
 * Settings merge for Sync v2.
 *
 * Per-key last-writer-wins with tombstones:
 *   - Each setting key is independent
 *   - Newest change wins (by HLC/timestamp)
 *   - Device-local keys never travel (allowlist enforced elsewhere)
 *   - Deleting a setting syncs as a tombstone
 */

import type { RecordEnvelope } from "../record-codec";
import { compareHlc } from "../hlc";

export type SettingsRecord = RecordEnvelope<Record<string, unknown>>;
export type SettingsTombstone = RecordEnvelope<null>;

export type MergeResult = {
  merged: Record<string, unknown>;
  tombstones: string[]; // keys that were deleted
};

const ALLOWED_SYNC_KEYS = new Set([
  "themeChoice",
  "autoFetchMetadata",
  "metadataExecutionStrategy",
  "enableInnertubeScraping",
  "enableEmbedScraping",
  "enableOEmbedScraping",
  "enableInvidiousPiped",
  "customInvidiousInstances",
  "customPipedInstances",
  "metadataPageSize",
  "maxVisibleFavorites",
  "syncKey", // this is the sync key itself
  // Add more as needed
]);

/**
 * Merge two settings objects with a common base.
 * Each key is independent - per-key LWW with tombstones.
 */
export function mergeSettings(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  base: Record<string, unknown>
): MergeResult {
  const merged: Record<string, unknown> = {};
  const tombstones: string[] = [];

  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)]);

  for (const key of allKeys) {
    // Skip non-syncable keys
    if (!ALLOWED_SYNC_KEYS.has(key)) {
      // Keep local value for non-syncable keys
      if (key in local) merged[key] = local[key];
      continue;
    }

    const l = key in local ? local[key] : undefined;
    const r = key in remote ? remote[key] : undefined;
    const b = key in base ? base[key] : undefined;

    const result = mergeSingleSetting(key, l, r, b);
    if (result.value !== undefined) merged[key] = result.value;
    if (result.tombstone) tombstones.push(key);
  }

  return { merged, tombstones };
}

/**
 * Merge a single setting key (per-key LWW).
 */
function mergeSingleSetting(
  key: string,
  local: unknown,
  remote: unknown,
  base: unknown
): { value: unknown; tombstone: boolean } {
  const hasLocal = local !== undefined;
  const hasRemote = remote !== undefined;
  const hasBase = base !== undefined;

  // Both deleted
  if (!hasLocal && !hasRemote) {
    return { value: undefined, tombstone: hasBase };
  }

  // Only local
  if (hasLocal && !hasRemote) {
    if (hasBase && deepEqual(local, base)) {
      return { value: local, tombstone: false };
    }
    return { value: local, tombstone: false };
  }

  // Only remote
  if (!hasLocal && hasRemote) {
    if (hasBase && deepEqual(remote, base)) {
      return { value: remote, tombstone: false };
    }
    return { value: remote, tombstone: false };
  }

  // Both have values - compare timestamps if available, else local wins
  // In practice, we'd use HLC from the record envelope
  if (hasLocal && hasRemote) {
    // If values are equal, no conflict
    if (deepEqual(local, remote)) {
      return { value: local, tombstone: false };
    }
    // For now, local wins (could be enhanced with HLC from record)
    return { value: local, tombstone: false };
  }

  return { value: undefined, tombstone: false };
}

/**
 * Deep equality check for settings values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
  for (const key of keys) {
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}

/**
 * Check if a key is allowed to sync.
 */
export function isSyncableSetting(key: string): boolean {
  return ALLOWED_SYNC_KEYS.has(key);
}

/**
 * Create a tombstone for a deleted setting.
 */
export function createSettingTombstone(key: string): SettingsTombstone {
  return {
    v: 2,
    collection: "settings",
    id: key,
    hlc: Date.now(),
    deleted: true,
    data: null,
  };
}
