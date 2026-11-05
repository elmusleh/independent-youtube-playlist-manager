/**
 * Rolling local safety restore points (`yph_sync_safety_backups`) for zero-data-loss
 * sync protection. Captures automatic pre-sync snapshots before initial/full merges
 * or remote playlist deletions, plus on-demand manual snapshots and 1-click restore.
 */

import { createSyncStorageBridge } from "./adapter-storage-io.js";
import { clearAllShadows } from "./shadow-store.js";
import { loadSyncConfig, saveSyncConfig } from "./sync-config.js";
import { resetSyncConfigCursors } from "./sync-state-reset.js";

export const SAFETY_BACKUPS_KEY = "yph_sync_safety_backups";
export const MAX_SAFETY_BACKUPS = 3;
const AUTO_BACKUP_MIN_INTERVAL_MS = 60_000;

export type SyncSafetyBackup = {
  id: string;
  createdAt: number;
  reason: string;
  playlistsCount: number;
  videosCount: number;
  historyCount: number;
  settingsCount: number;
  playlists: unknown[];
  history: Record<string, unknown>;
  settings: Record<string, unknown>;
};

function getLocalStorageArea(): {
  get: (key: string) => Promise<unknown>;
  set: (key: string, val: unknown) => Promise<void>;
} | null {
  const b = (globalThis as any).browser || (globalThis as any).chrome;
  if (b?.storage?.local?.get && b?.storage?.local?.set) {
    return {
      get: async (k) => (await b.storage.local.get(k))?.[k],
      set: async (k, v) => b.storage.local.set({ [k]: v }),
    };
  }
  if (typeof localStorage !== "undefined") {
    return {
      get: async (k) => JSON.parse(localStorage.getItem(k) || "null"),
      set: async (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    };
  }
  return null;
}

export async function listSyncSafetyBackups(): Promise<SyncSafetyBackup[]> {
  const area = getLocalStorageArea();
  if (!area) return [];
  try {
    const raw = await area.get(SAFETY_BACKUPS_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is SyncSafetyBackup => !!item && typeof item.id === "string");
  } catch {
    return [];
  }
}

export async function captureSyncSafetyBackup(
  reason: string,
  options: { force?: boolean } = {}
): Promise<SyncSafetyBackup | null> {
  const area = getLocalStorageArea();
  if (!area) return null;

  const existing = await listSyncSafetyBackups();
  const now = Date.now();
  if (!options.force && existing.length > 0) {
    const latest = existing[0];
    if (now - latest.createdAt < AUTO_BACKUP_MIN_INTERVAL_MS) {
      return latest;
    }
  }

  const bridge = createSyncStorageBridge();
  const snap = await bridge.librarySnapshot();
  const playlists = Array.isArray(snap.playlists) ? snap.playlists : [];
  const history = snap.history && typeof snap.history === "object" ? snap.history : {};
  const settings = snap.settings && typeof snap.settings === "object" ? snap.settings : {};

  let videosCount = 0;
  for (const pl of playlists) {
    const videos = (pl as { videos?: unknown[] })?.videos;
    if (Array.isArray(videos)) videosCount += videos.length;
  }

  // Skip automatic empty-library backups when nothing exists locally yet.
  if (
    !options.force &&
    playlists.length === 0 &&
    Object.keys(history).length === 0 &&
    Object.keys(settings).length === 0
  ) {
    return null;
  }

  const entry: SyncSafetyBackup = JSON.parse(
    JSON.stringify({
      id: `snap-${now}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      reason,
      playlistsCount: playlists.length,
      videosCount,
      historyCount: Object.keys(history).length,
      settingsCount: Object.keys(settings).length,
      playlists,
      history,
      settings,
    })
  );

  const updated = [entry, ...existing].slice(0, MAX_SAFETY_BACKUPS);
  await area.set(SAFETY_BACKUPS_KEY, updated);
  return entry;
}

export async function restoreSyncSafetyBackup(backupId: string): Promise<SyncSafetyBackup> {
  const backups = await listSyncSafetyBackups();
  const target = backups.find((b) => b.id === backupId);
  if (!target) {
    throw new Error("Safety restore point was not found.");
  }

  const bridge = createSyncStorageBridge();
  const current = await bridge.librarySnapshot();
  await bridge.mutateLibrary({
    type: "replace",
    playlists: structuredClone(target.playlists),
    expectedRevision: current.revision,
  });

  const historyEntries = Object.entries(target.history ?? {}).map(([videoId, val]) =>
    val && typeof val === "object" ? { ...(val as Record<string, unknown>), videoId } : { videoId }
  );
  await bridge.saveHistory(historyEntries);
  if (target.settings && Object.keys(target.settings).length > 0) {
    await bridge.saveSettings(structuredClone(target.settings));
  }

  // Clear shadows and cursors so the restored local state is treated as authoritative on next sync.
  await clearAllShadows();
  const cfg = await loadSyncConfig();
  resetSyncConfigCursors(cfg, "Local safety restore point applied");
  await saveSyncConfig(cfg);

  return target;
}

export function serializeSafetyBackupJson(backup: SyncSafetyBackup): string {
  return JSON.stringify(
    {
      schema: "iypm-sync-safety-backup-v1",
      exportedAt: new Date().toISOString(),
      ...backup,
    },
    null,
    2
  );
}
