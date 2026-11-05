/**
 * Settings merge for Sync v2.
 *
 * Per-key 3-way merge / last-writer-wins with tombstones:
 *   - Each setting key is independent
 *   - Uses the canonical `SYNCABLE_SETTING_KEYS` allowlist (including `favoritePlaylistIds`
 *     and `watchLaterPlaylistId`) while keeping credentials/tokens strictly device-local
 *   - Single-sided edits win cleanly against `base`; concurrent `favoritePlaylistIds`
 *     changes merge additively in `"merge"` mode
 */

import type { RecordEnvelope } from "../record-codec";
import { SYNCABLE_SETTING_KEYS } from "../settings-selector";

export type SettingsRecord = RecordEnvelope<Record<string, unknown>>;
export type SettingsTombstone = RecordEnvelope<null>;

export type SettingsMergeOptions = {
  strategy?: "merge" | "lww";
  preferRemoteOnTie?: boolean;
};

export type MergeResult = {
  merged: Record<string, unknown>;
  tombstones: string[]; // keys that were deleted
};

const ALLOWED_SYNC_KEYS = new Set<string>([
  ...SYNCABLE_SETTING_KEYS,
  "metadataPageSize",
  "metadataFetchDelayMs",
  "metadataRetryCount",
]);

/**
 * Merge two settings objects with a common base.
 * Each key is independent - per-key 3-way merge / LWW with tombstones.
 */
export function mergeSettings(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  base: Record<string, unknown>,
  options: SettingsMergeOptions = {}
): MergeResult {
  const merged: Record<string, unknown> = {};
  const tombstones: string[] = [];

  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)]);

  for (const key of allKeys) {
    if (!ALLOWED_SYNC_KEYS.has(key)) {
      if (key in local) merged[key] = local[key];
      continue;
    }

    const l = key in local ? local[key] : undefined;
    const r = key in remote ? remote[key] : undefined;
    const b = key in base ? base[key] : undefined;

    const result = mergeSingleSetting(key, l, r, b, options);
    if (result.value !== undefined) merged[key] = result.value;
    if (result.tombstone) tombstones.push(key);
  }

  return { merged, tombstones };
}

function mergeOrderedStringIds(
  local: string[],
  remote: string[],
  base: string[] | undefined
): string[] {
  const baseSet = new Set(base ?? []);
  const localSet = new Set(local);
  const remoteSet = new Set(remote);
  const removed = new Set<string>();
  for (const id of baseSet) {
    if (!localSet.has(id) || !remoteSet.has(id)) removed.add(id);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...remote, ...local]) {
    if (typeof id !== "string" || !id || removed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function mergeSingleSetting(
  key: string,
  local: unknown,
  remote: unknown,
  base: unknown,
  options: SettingsMergeOptions
): { value: unknown; tombstone: boolean } {
  const hasLocal = local !== undefined;
  const hasRemote = remote !== undefined;
  const hasBase = base !== undefined;
  const strategy = options.strategy ?? "merge";
  const preferRemote = options.preferRemoteOnTie ?? true;

  if (!hasLocal && !hasRemote) {
    return { value: undefined, tombstone: hasBase };
  }

  if (hasLocal && !hasRemote) {
    return { value: local, tombstone: false };
  }

  if (!hasLocal && hasRemote) {
    if (hasBase && deepEqual(remote, base)) {
      return { value: undefined, tombstone: true };
    }
    return { value: remote, tombstone: false };
  }

  if (hasLocal && hasRemote) {
    if (deepEqual(local, remote)) {
      return { value: local, tombstone: false };
    }

    if (hasBase) {
      if (deepEqual(local, base)) {
        return { value: remote, tombstone: false };
      }
      if (deepEqual(remote, base)) {
        return { value: local, tombstone: false };
      }
    }

    if (
      key === "favoritePlaylistIds" &&
      strategy !== "lww" &&
      Array.isArray(local) &&
      Array.isArray(remote)
    ) {
      return {
        value: mergeOrderedStringIds(
          local as string[],
          remote as string[],
          Array.isArray(base) ? (base as string[]) : undefined
        ),
        tombstone: false,
      };
    }

    return { value: preferRemote ? remote : local, tombstone: false };
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
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

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
