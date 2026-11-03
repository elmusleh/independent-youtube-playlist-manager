/**
 * Sync status store (background).
 *
 * Persists `yph_sync_status` (phase, counts, last run, last 50 runs) and the
 * rolling restore points (last 5 library snapshots) used by "Advanced -> Restore".
 *
 * Storage keys:
 *   yph_sync_status          — current SyncStatus
 *   yph_sync_restore_points  — array of restore points (max 5)
 */

import type { SyncStatus } from "../sync-engine";

const STATUS_KEY = "yph_sync_status";
const RESTORE_KEY = "yph_sync_restore_points";
const MAX_RESTORE_POINTS = 5;
const MAX_RUN_HISTORY = 50;

export type SyncRunRecord = {
  at: number;
  phase: string;
  summary: string | null;
  error: string | null;
  durationMs: number;
  pulled: number;
  pushed: number;
  failed: number;
};

export type RestorePoint = {
  at: number;
  reason: string;
  playlists: unknown[];
  settings: Record<string, unknown>;
  history: Record<string, unknown>;
};

type StorageLike = {
  get: (k: string) => Promise<any>;
  set: (o: Record<string, unknown>) => Promise<void>;
};

function storage(): StorageLike | null {
  const b = (globalThis as any).browser || (globalThis as any).chrome;
  if (!b?.storage?.local) return null;
  return {
    get: (k) => b.storage.local.get(k).then((r: any) => r?.[k]),
    set: (o) => b.storage.local.set(o),
  };
}

export async function loadStatus(): Promise<SyncStatus | null> {
  const s = storage();
  if (!s) return null;
  return (await s.get(STATUS_KEY)) ?? null;
}

export async function saveStatus(status: SyncStatus, run?: SyncRunRecord): Promise<void> {
  const s = storage();
  if (!s) return;
  const runs: SyncRunRecord[] = (await s.get("yph_sync_runs")) ?? [];
  if (run) {
    runs.unshift(run);
    if (runs.length > MAX_RUN_HISTORY) runs.length = MAX_RUN_HISTORY;
    await s.set({ yph_sync_runs: runs });
  }
  await s.set({ [STATUS_KEY]: status });
}

export async function loadRuns(): Promise<SyncRunRecord[]> {
  const s = storage();
  if (!s) return [];
  return (await s.get("yph_sync_runs")) ?? [];
}

export async function saveRestorePoint(point: RestorePoint): Promise<void> {
  const s = storage();
  if (!s) return;
  const points: RestorePoint[] = (await s.get(RESTORE_KEY)) ?? [];
  points.unshift(point);
  if (points.length > MAX_RESTORE_POINTS) points.length = MAX_RESTORE_POINTS;
  await s.set({ [RESTORE_KEY]: points });
}

export async function loadRestorePoints(): Promise<RestorePoint[]> {
  const s = storage();
  if (!s) return [];
  return (await s.get(RESTORE_KEY)) ?? [];
}

export async function restoreFrom(point: RestorePoint): Promise<void> {
  const s = storage();
  if (!s) return;
  // Restore points are consumed by the UI / library-mutations layer; this just
  // records the intent. Actual application happens in the editor page.
  await s.set({ yph_sync_restore_pending: point });
}
