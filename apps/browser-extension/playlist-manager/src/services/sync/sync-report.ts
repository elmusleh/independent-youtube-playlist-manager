/**
 * Builds local sync inventory snapshots and post-run `SyncRunReport` summaries
 * for the Sync Center banner and `SyncReportModal.svelte`.
 */

import { librarySnapshot } from "../../../../shared/storage-client.js";
import { readSyncableSettingsFromStorage } from "./adapter-storage-io.js";
import { resolveActiveRelayEndpoint } from "./sync-diagnostics.js";
import type { SyncConfig } from "./sync-config.js";

export type LocalSyncInventory = {
  playlistsCount: number;
  videosCount: number;
  historyCount: number;
  settingsCount: number;
};

export type SyncCategoryReportRow = {
  key: "playlists" | "history" | "settings" | "devices";
  label: string;
  enabled: boolean;
  applied: number;
  processed: number;
  localSummary: string;
};

export type SyncRunReport = {
  completedAt: number;
  durationMs: number;
  ok: boolean;
  summary: string;
  error: string | null;
  endpointHost: string;
  pushedCount: number;
  pulledCount: number;
  knownDevices: number;
  rows: SyncCategoryReportRow[];
};

export async function readLocalSyncInventory(): Promise<LocalSyncInventory> {
  let playlistsCount = 0;
  let videosCount = 0;
  let historyCount = 0;
  let settingsCount = 0;

  try {
    const snap = await librarySnapshot();
    const list = Array.isArray(snap?.playlists) ? snap.playlists : [];
    playlistsCount = list.length;
    for (const pl of list) {
      if (Array.isArray(pl?.videos)) videosCount += pl.videos.length;
    }
  } catch {
    // Fallback when called in lightweight test contexts without storage bridge.
  }

  try {
    const b = (globalThis as any).browser || (globalThis as any).chrome;
    if (b?.storage?.local?.get) {
      const stored = await b.storage.local.get("local_yt_history");
      const raw = stored?.local_yt_history;
      if (raw && typeof raw === "object") {
        historyCount = Object.keys(raw).length;
      }
    }
  } catch {
    // Ignore history read failure.
  }

  try {
    const settings = await readSyncableSettingsFromStorage();
    settingsCount = Object.keys(settings).length;
  } catch {
    // Ignore settings read failure.
  }

  return { playlistsCount, videosCount, historyCount, settingsCount };
}

export function buildSyncRunReport(params: {
  config: SyncConfig;
  statusSnapshot: any;
  inventoryAfter: LocalSyncInventory;
  knownDevices: number;
  durationMs: number;
  fallbackError?: string | null;
  fallbackSummary?: string | null;
}): SyncRunReport {
  const { config, statusSnapshot, inventoryAfter, knownDevices, durationMs } = params;
  const error = statusSnapshot?.lastError ?? params.fallbackError ?? config.lastError ?? null;
  const summary =
    statusSnapshot?.lastSummary ??
    params.fallbackSummary ??
    config.lastSyncSummary ??
    (error ? "Sync failed" : "Sync complete (up to date)");

  let endpointHost = "Offline / Local";
  if (config.backends.includes("relay") || config.backends.includes("supabase-byo")) {
    const resolved = resolveActiveRelayEndpoint(config);
    try {
      endpointHost = new URL(resolved.url).host;
    } catch {
      endpointHost = resolved.url || "Cloud relay";
    }
  } else if (config.backends.includes("file")) {
    endpointHost = "Local sync folder";
  }

  const cp = statusSnapshot?.categoryProgress ?? {};
  const playlistsEnabled = config.content?.playlists !== false;
  const historyEnabled = config.content?.history === true;
  const settingsEnabled = config.content?.settings === true;

  const rows: SyncCategoryReportRow[] = [
    {
      key: "playlists",
      label: "Playlists",
      enabled: playlistsEnabled,
      applied: cp?.playlists?.applied ?? 0,
      processed: cp?.playlists?.processed ?? 0,
      localSummary: `${inventoryAfter.playlistsCount} playlist${inventoryAfter.playlistsCount === 1 ? "" : "s"} (${inventoryAfter.videosCount} videos)`,
    },
    {
      key: "history",
      label: "Watch History",
      enabled: historyEnabled,
      applied: cp?.history?.applied ?? 0,
      processed: cp?.history?.processed ?? 0,
      localSummary: `${inventoryAfter.historyCount} watched video${inventoryAfter.historyCount === 1 ? "" : "s"}`,
    },
    {
      key: "settings",
      label: "Settings & Pinned",
      enabled: settingsEnabled,
      applied: cp?.settings?.applied ?? 0,
      processed: cp?.settings?.processed ?? 0,
      localSummary: `${inventoryAfter.settingsCount} synced preference${inventoryAfter.settingsCount === 1 ? "" : "s"}`,
    },
    {
      key: "devices",
      label: "Connected Devices",
      enabled: true,
      applied: cp?.devices?.applied ?? 0,
      processed: cp?.devices?.processed ?? 0,
      localSummary: `${Math.max(1, knownDevices)} device${knownDevices === 1 ? "" : "s"} in space`,
    },
  ];

  return {
    completedAt: Date.now(),
    durationMs: Math.max(1, durationMs),
    ok: !error && statusSnapshot?.phase !== "error",
    summary,
    error,
    endpointHost,
    pushedCount: statusSnapshot?.pushedCount ?? 0,
    pulledCount: statusSnapshot?.pulledCount ?? 0,
    knownDevices: Math.max(1, knownDevices),
    rows,
  };
}
