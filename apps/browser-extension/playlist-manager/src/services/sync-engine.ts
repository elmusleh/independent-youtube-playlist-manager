/**
 * Sync engine (background, single authority).
 *
 * State machine: idle -> pulling -> merging -> pushing -> idle | error | offline | paused.
 * Single-flight via a simple in-memory lock. Backoff on failure.
 * The UI reads status from `yph_sync_status` via storage.onChanged.
 */

import { isRelayConfigured, getOrCreateDeviceId, loadSyncConfig } from "./sync/sync-config";
import {
  LEGACY_SYNC_RECOVERY_NOTICE,
  needsV2RelayAcknowledgement,
} from "./sync/sync-config-compatibility";
import { runAdapterPass } from "./sync-engine-adapters";
import { pushCandidatesWithConflictResolution } from "./sync-engine-push";
import { registerSyncEngine } from "./sync-engine-registration";
import { computeStorageAddress, computeAuthToken } from "./sync/keys";
import { claimSpace, pullAll } from "./sync/relay-transport";

export type SyncPhase = "idle" | "pulling" | "merging" | "pushing" | "error" | "offline" | "paused";

export type SyncStatus = {
  phase: SyncPhase;
  lastRunAt: number | null;
  lastError: string | null;
  lastSummary: string | null;
  pendingCount: number;
  incomingCount: number;
  pushedCount: number;
  pulledCount: number;
  failedCount: number;
  /** When the current sync run started (epoch ms). Null when idle. */
  startedAt: number | null;
  /** Estimated total duration in ms based on previous runs. Null on first run. */
  estimatedMs: number | null;
  /** Per-category counts: { processed, applied, total } for the current run. */
  categoryProgress: {
    playlists: { processed: number; applied: number; total: number };
    settings: { processed: number; applied: number; total: number };
    history: { processed: number; applied: number; total: number };
    devices: { processed: number; applied: number; total: number };
  };
};

const STATUS_KEY = "yph_sync_status";
const BACKOFF_STEPS = [30_000, 60_000, 300_000, 900_000];

let phase: SyncPhase = "idle";
let isRunning = false;
let backoffIndex = 0;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let lastRunDurationMs = 5000; // default estimate for first run
let status: SyncStatus = {
  phase: "idle",
  lastRunAt: null,
  lastError: null,
  lastSummary: null,
  pendingCount: 0,
  incomingCount: 0,
  pushedCount: 0,
  pulledCount: 0,
  failedCount: 0,
  startedAt: null,
  estimatedMs: null,
  categoryProgress: {
    playlists: { processed: 0, applied: 0, total: 0 },
    settings: { processed: 0, applied: 0, total: 0 },
    history: { processed: 0, applied: 0, total: 0 },
    devices: { processed: 0, applied: 0, total: 0 },
  },
};

function getStorage(): { get: (k: string) => Promise<any>; set: (o: any) => Promise<void> } | null {
  const b = (globalThis as any).browser || (globalThis as any).chrome;
  if (!b?.storage?.local) return null;
  return {
    get: (k) => b.storage.local.get(k).then((r: any) => r?.[k]),
    set: (o) => b.storage.local.set(o),
  };
}

async function persistStatus(): Promise<void> {
  const s = getStorage();
  if (!s) return;
  status.phase = phase;
  try {
    await s.set({ [STATUS_KEY]: status });
  } catch {
    /* ignore */
  }
}

export function getStatus(): SyncStatus {
  return { ...status };
}

export async function runOnce(): Promise<SyncStatus> {
  if (isRunning) return getStatus();
  isRunning = true;
  phase = "pulling";
  const startedAt = Date.now();
  status.startedAt = startedAt;
  status.estimatedMs = lastRunDurationMs;
  await persistStatus();

  try {
    const storage =
      (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
    if (!storage) throw new Error("storage unavailable");

    const cfg = await loadSyncConfig();
    const syncKey = cfg.syncKey;
    const backends = cfg.backends;

    if (!syncKey || backends.length === 0) {
      phase = "idle";
      status.lastError = null;
      status.lastSummary =
        backends.length === 0 ? "Offline mode (sync disabled)" : "No sync key configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    if (needsV2RelayAcknowledgement(cfg)) {
      phase = "paused";
      status.lastError = LEGACY_SYNC_RECOVERY_NOTICE;
      status.lastSummary = "Sync paused until the previous setup is reviewed";
      status.lastRunAt = Date.now();
      status.pendingCount = 0;
      status.failedCount = 0;
      await persistStatus();
      return getStatus();
    }

    if (!isRelayConfigured() && backends.includes("relay") && backends.length === 1) {
      phase = "idle";
      status.lastSummary = "No backend configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    if (!isRelayConfigured() && !backends.includes("relay")) {
      // non-relay backends handled elsewhere; nothing to do here
      phase = "idle";
      status.lastSummary = "No backend configured";
      status.lastRunAt = Date.now();
      await persistStatus();
      return getStatus();
    }

    const space = await computeStorageAddress(syncKey);
    const authHash = await computeAuthToken(syncKey, space);

    const relayConfig = {
      url:
        (backends.includes("supabase-byo") && cfg?.supabaseUrl) ||
        cfg?.relayUrl ||
        "https://qvwitlpnetwthyhrobca.supabase.co",
      anonKey:
        (backends.includes("supabase-byo") && cfg?.supabaseKey) ||
        cfg?.relayAnonKey ||
        "sb_publishable_HV50FQtJrkoNcKLsFk5BHQ_KUU2GeKb",
    };

    const claimed = await claimSpace(relayConfig, space, authHash);
    if (!claimed)
      throw new Error("Relay space claim was rejected; check the sync key or pairing setup.");

    const localDeviceId = await getOrCreateDeviceId();

    phase = "pulling";
    await persistStatus();
    const lastSeqByCollection = cfg?.lastSeqByCollection ?? {};
    const sinceSeq = Object.keys(lastSeqByCollection).length > 0
      ? Math.min(...Object.values(lastSeqByCollection))
      : (cfg?.lastSeq ?? 0);
    const incoming = await pullAll(relayConfig, space, authHash, sinceSeq);

    phase = "merging";
    await persistStatus();

    const result = await runAdapterPass({
      syncKey,
      localDeviceId,
      relayConfig,
      space,
      authHash,
      incoming,
      sinceSeq,
      storage,
      cfg,
    });

    phase = "pushing";
    await persistStatus();

    let additionalIncomingCount = 0;
    let didPushSuccessfully = false;
    let pushedCount = 0;
    if (result.allDirty.length > 0) {
      const pushOutcome = await pushCandidatesWithConflictResolution(
        {
          syncKey,
          localDeviceId,
          relayConfig,
          space,
          authHash,
          incoming: [],
          sinceSeq,
          storage,
          cfg,
        },
        result
      );
      result.failed.push(...pushOutcome.failed);
      result.appliedCount += pushOutcome.appliedCount;
      result.maxSeq = Math.max(result.maxSeq, pushOutcome.maxSeq);
      result.cursorBlocked ||= pushOutcome.cursorBlocked;
      additionalIncomingCount = pushOutcome.pulledCount;
      didPushSuccessfully = pushOutcome.didPushSuccessfully;
      pushedCount = pushOutcome.pushedCount;
      // Notify peers via Realtime broadcast (best-effort, no data).
      if (didPushSuccessfully) {
        try {
          const { broadcastSyncNudge } = await import("./sync/realtime-nudge");
          await broadcastSyncNudge(syncKey, { url: relayConfig.url, anonKey: relayConfig.anonKey });
        } catch {
          /* best-effort */
        }
      }
    }

    if (
      (incoming.length > 0 || additionalIncomingCount > 0) &&
      result.failed.length === 0 &&
      !result.cursorBlocked
    ) {
      const maxSeqByCollection: Record<string, number> = { ...lastSeqByCollection };
      // Advance cursor for each collection that had incoming records
      const collectionsSeen = new Set(incoming.map((r: any) => r.collection));
      for (const coll of collectionsSeen) {
        const collMax = Math.max(...incoming.filter((r: any) => r.collection === coll).map((r: any) => r.seq));
        if (!maxSeqByCollection[coll] || collMax > maxSeqByCollection[coll]) {
          maxSeqByCollection[coll] = collMax;
        }
      }
      cfg.lastSeqByCollection = maxSeqByCollection;
      cfg.lastSeq = result.maxSeq; // keep legacy in sync
    } else if ((incoming.length > 0 || additionalIncomingCount > 0) && result.failed.length > 0) {
      // Keep lastSeq unchanged so failed records are re-pulled next run.
      status.lastError = result.failed.join("; ");
    }

    if (result.failed.length === 0 && !result.cursorBlocked) {
      cfg.syncConfigVersion = 2;
      cfg.syncProtocolVersion = 2;
      await storage.set({ yph_sync_config: cfg });
    }

    phase = "idle";
    const totalSynced = result.appliedCount + pushedCount;
    status.lastError = result.failed.length ? result.failed.join("; ") : null;
    status.lastSummary = result.failed.length
      ? `Partial: ${result.failed.join("; ")}`
      : result.cursorBlocked
        ? `Synced ${totalSynced} records; cursor held while a collection is disabled`
        : totalSynced > 0
          ? `Synced ${totalSynced} records`
          : "Sync complete (no changes)";
    status.lastRunAt = Date.now();
    status.pendingCount = 0;
    status.pushedCount = pushedCount;
    status.pulledCount = incoming.length + additionalIncomingCount;
    status.failedCount = result.failed.length;
    backoffIndex = 0;
  } catch (err) {
    phase = "error";
    status.lastError = err instanceof Error ? err.message : String(err);
    status.lastSummary = `Sync failed: ${status.lastError}`;
    status.lastRunAt = Date.now();
    backoffIndex = Math.min(backoffIndex + 1, BACKOFF_STEPS.length - 1);
  } finally {
    lastRunDurationMs = Date.now() - startedAt;
    isRunning = false;
    status.startedAt = null;
    status.estimatedMs = null;
    await persistStatus();
  }
  return getStatus();
}

export function scheduleRun(delayMs?: number): void {
  if (backoffTimer) return;
  const delay = delayMs ?? (phase === "error" ? BACKOFF_STEPS[backoffIndex] : 5_000);
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    runOnce().catch(() => {});
  }, delay);
}

export function pause(): void {
  phase = "paused";
  persistStatus();
}

export function resume(): void {
  if (phase === "paused") phase = "idle";
  scheduleRun(0);
}

registerSyncEngine({
  runOnce,
  scheduleRun,
  pause,
  resume,
  getStatus,
  isRunning: () => isRunning,
});
