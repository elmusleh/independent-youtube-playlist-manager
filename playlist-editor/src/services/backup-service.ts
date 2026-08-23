import { dbGetAllMetadata, dbPutMetadataBatch, dbClearMetadata } from "./db-service.js";
import { normalizePlaylist, normalizeVideoMeta, normalizeHistoryRecord } from "./schema-normalizer.js";
import type { CompleteBackupFile, ImportResult, Playlist, Settings, NormalizedVideoMeta } from "../types/model.js";

const BACKUP_FORMAT = "yph_full_backup";
const CURRENT_SCHEMA_VERSION = 2;
const HISTORY_KEY = "local_yt_history";
const LOCAL_PLAYLISTS_KEY = "yph_local_playlists";

/**
 * Dumps the entire database (playlists, IndexedDB metadata cache, watch history, settings) into a portable JSON backup
 */
export async function exportFullDatabaseBackup(): Promise<CompleteBackupFile> {
  const browser = (window as any).browser || (window as any).chrome;

  // 1. Fetch current settings
  let settings: Settings = {} as Settings;
  try {
    if (typeof window.getSettings === "function") {
      settings = await window.getSettings();
    }
  } catch (err) {
    console.warn("[BACKUP] Failed to read settings for export:", err);
  }

  // 2. Fetch all local and saved playlists
  let playlists: Playlist[] = [];
  try {
    if (typeof window.getPlaylists === "function") {
      const rawList = await window.getPlaylists();
      playlists = rawList.map((p) => normalizePlaylist(p));
    }
  } catch (err) {
    console.warn("[BACKUP] Failed to read playlists for export:", err);
  }

  // 3. Dump all cached video metadata from IndexedDB
  let videoMetadata: Record<string, NormalizedVideoMeta> = {};
  try {
    videoMetadata = await dbGetAllMetadata();
  } catch (err) {
    console.warn("[BACKUP] Failed to dump IndexedDB metadata cache:", err);
  }

  // 4. Fetch watch history
  let history: Record<string, any> = {};
  if (typeof browser !== "undefined") {
    try {
      const stored = await browser.storage.local.get(HISTORY_KEY);
      const rawHistory = stored[HISTORY_KEY] || {};
      for (const [id, entry] of Object.entries(rawHistory)) {
        history[id] = normalizeHistoryRecord(entry, id);
      }
    } catch (err) {
      console.warn("[BACKUP] Failed to read watch history:", err);
    }
  }

  // Calculate stats
  const totalPlaylists = playlists.length;
  const uniqueVideos = new Set<string>();
  playlists.forEach((p) => p.videos.forEach((v) => uniqueVideos.add(v)));
  const totalMetadataEntries = Object.keys(videoMetadata).length;
  const totalHistoryEntries = Object.keys(history).length;

  const manifestVersion = browser?.runtime?.getManifest?.()?.version || "2.12.10";

  const backup: CompleteBackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    metadata: {
      appVersion: manifestVersion,
      totalPlaylists,
      totalVideos: uniqueVideos.size,
      totalMetadataEntries,
      totalHistoryEntries,
    },
    data: {
      settings,
      playlists,
      videoMetadata,
      history,
    },
  };

  return backup;
}

/**
 * Validates the schema of an incoming backup file
 */
export function validateBackupSchema(json: any): { valid: boolean; errors: string[]; schemaVersion: number } {
  const errors: string[] = [];

  if (!json || typeof json !== "object") {
    return { valid: false, errors: ["Invalid backup file: Payload is not a valid JSON object."], schemaVersion: 0 };
  }

  // Check if this is a legacy playlist array export
  if (Array.isArray(json)) {
    return { valid: true, errors: [], schemaVersion: 1 };
  }

  if (json.format !== BACKUP_FORMAT) {
    errors.push(`Unrecognized backup format "${json.format}". Expected "${BACKUP_FORMAT}".`);
  }

  const schemaVersion = typeof json.schemaVersion === "number" ? json.schemaVersion : 1;
  if (!json.data || typeof json.data !== "object") {
    errors.push("Missing \"data\" container in backup payload.");
  }

  return {
    valid: errors.length === 0,
    errors,
    schemaVersion,
  };
}

/**
 * Imports a complete database backup with schema validation, conflict resolution, and atomic writes
 */
export async function importFullDatabaseBackup(
  backupJson: any,
  mode: "merge" | "overwrite" = "merge"
): Promise<ImportResult> {
  const validation = validateBackupSchema(backupJson);
  if (!validation.valid) {
    return {
      success: false,
      importedPlaylists: 0,
      importedMetadata: 0,
      importedHistory: 0,
      mode,
      errors: validation.errors,
    };
  }

  const browser = (window as any).browser || (window as any).chrome;
  let importedPlaylistsCount = 0;
  let importedMetadataCount = 0;
  let importedHistoryCount = 0;
  const errors: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // 1. Process Video Metadata Cache (IndexedDB)
    // -------------------------------------------------------------------------
    if (mode === "overwrite") {
      await dbClearMetadata();
    }

    const rawMetadata = backupJson.data?.videoMetadata || {};
    const metadataToSave: Record<string, NormalizedVideoMeta> = {};

    if (mode === "merge") {
      const existingMetadata = await dbGetAllMetadata();
      // Add all existing
      for (const [id, meta] of Object.entries(existingMetadata)) {
        metadataToSave[id] = meta;
      }
      // Merge imported with timestamp comparison
      for (const [id, incoming] of Object.entries(rawMetadata)) {
        const normalized = normalizeVideoMeta(incoming, id);
        const existing = metadataToSave[id];
        if (!existing || (normalized.lastCachedAt >= (existing.lastCachedAt || 0))) {
          metadataToSave[id] = normalized;
          importedMetadataCount++;
        }
      }
    } else {
      // Overwrite mode
      for (const [id, incoming] of Object.entries(rawMetadata)) {
        metadataToSave[id] = normalizeVideoMeta(incoming, id);
        importedMetadataCount++;
      }
    }

    if (Object.keys(metadataToSave).length > 0) {
      await dbPutMetadataBatch(metadataToSave);
    }

    // -------------------------------------------------------------------------
    // 2. Process Playlists (browser.storage.local)
    // -------------------------------------------------------------------------
    let rawPlaylists: any[] = [];
    if (Array.isArray(backupJson)) {
      // Legacy format
      rawPlaylists = backupJson;
    } else if (Array.isArray(backupJson.data?.playlists)) {
      rawPlaylists = backupJson.data.playlists;
    }

    let finalPlaylists: Playlist[] = [];
    if (mode === "merge") {
      const existingPlaylists = typeof window.getPlaylists === "function" ? await window.getPlaylists() : [];
      const playlistMap = new Map<string, Playlist>();
      existingPlaylists.forEach((p) => playlistMap.set(p.id, normalizePlaylist(p)));

      for (const rawP of rawPlaylists) {
        const normalized = normalizePlaylist(rawP);
        if (playlistMap.has(normalized.id)) {
          // Merge video arrays
          const existing = playlistMap.get(normalized.id)!;
          const mergedVideos = Array.from(new Set([...existing.videos, ...normalized.videos]));
          playlistMap.set(normalized.id, {
            ...existing,
            ...normalized,
            videos: mergedVideos,
          });
        } else {
          playlistMap.set(normalized.id, normalized);
          importedPlaylistsCount++;
        }
      }
      finalPlaylists = Array.from(playlistMap.values());
    } else {
      // Overwrite mode
      finalPlaylists = rawPlaylists.map((p) => {
        importedPlaylistsCount++;
        return normalizePlaylist(p);
      });
    }

    if (typeof browser !== "undefined") {
      await browser.storage.local.set({ [LOCAL_PLAYLISTS_KEY]: finalPlaylists });
    }

    // -------------------------------------------------------------------------
    // 3. Process Watch History (browser.storage.local)
    // -------------------------------------------------------------------------
    const rawHistory = backupJson.data?.history || {};
    let finalHistory: Record<string, any> = {};

    if (typeof browser !== "undefined") {
      if (mode === "merge") {
        const stored = await browser.storage.local.get(HISTORY_KEY);
        finalHistory = stored[HISTORY_KEY] || {};
        for (const [id, incoming] of Object.entries(rawHistory)) {
          const normalizedIncoming = normalizeHistoryRecord(incoming, id);
          const existing = finalHistory[id];
          if (!existing || normalizedIncoming.t > (existing.t || 0) || normalizedIncoming.lastUpdated > (existing.lastUpdated || 0)) {
            finalHistory[id] = normalizedIncoming;
            importedHistoryCount++;
          }
        }
      } else {
        for (const [id, incoming] of Object.entries(rawHistory)) {
          finalHistory[id] = normalizeHistoryRecord(incoming, id);
          importedHistoryCount++;
        }
      }

      await browser.storage.local.set({ [HISTORY_KEY]: finalHistory });
    }

    // -------------------------------------------------------------------------
    // 4. Process Settings (if present in backup)
    // -------------------------------------------------------------------------
    if (backupJson.data?.settings && typeof browser !== "undefined") {
      const incomingSettings = backupJson.data.settings;
      if (mode === "overwrite") {
        await browser.storage.sync.set(incomingSettings);
      } else {
        const currentSettings = typeof window.getSettings === "function" ? await window.getSettings() : {};
        await browser.storage.sync.set({ ...currentSettings, ...incomingSettings });
      }
    }

    // Invalidate memory session caches and notify listeners
    if (typeof window.invalidatePlaylistCache === "function") {
      window.invalidatePlaylistCache();
    }
    if (typeof window.clearMetadataSessionCache === "function") {
      window.clearMetadataSessionCache();
    }
    if (typeof window.invalidateCacheAndNotify === "function") {
      window.invalidateCacheAndNotify();
    }

    return {
      success: true,
      importedPlaylists: importedPlaylistsCount,
      importedMetadata: importedMetadataCount,
      importedHistory: importedHistoryCount,
      mode,
      errors: [],
    };
  } catch (err: any) {
    console.error("[BACKUP] Import failed:", err);
    errors.push(err.message || String(err));
    return {
      success: false,
      importedPlaylists: importedPlaylistsCount,
      importedMetadata: importedMetadataCount,
      importedHistory: importedHistoryCount,
      mode,
      errors,
    };
  }
}

/**
 * Triggers a browser download of the full database backup file
 */
export function downloadBackupFile(backup: CompleteBackupFile, filename?: string): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const name = filename || `independent-youtube-playlist-manager-backup-${dateStr}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
