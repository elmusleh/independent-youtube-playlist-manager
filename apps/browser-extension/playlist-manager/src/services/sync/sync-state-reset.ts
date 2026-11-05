/**
 * Resets local sync cursors, runtime status, device list, and IndexedDB shadow state
 * whenever the sync key or remote space changes. Without clearing shadows, records
 * previously pushed to an older key/space appear clean (`isDirty === false`) and
 * never upload to the new space.
 */

import { clearAllShadows, getShadow, getShadowCounts, setShadow } from "./shadow-store.js";
import type { SyncConfig } from "./sync-config.js";

const META_COLLECTION = "__meta__";
const BINDING_ID = "binding";

export type ShadowBinding = {
  space: string;
  relayUrl: string;
};

/**
 * Bind the shadow store to an active `(space, relayUrl)` pair.
 * If non-empty shadows exist from an unbound run or a different space/endpoint,
 * clears all stale shadows so local records are pushed cleanly to the active space.
 * Returns `true` when stale shadows were cleared.
 */
export async function ensureShadowBinding(space: string, relayUrl: string): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const normalizedUrl = relayUrl.replace(/\/$/, "");
  const existing = (await getShadow(META_COLLECTION, BINDING_ID))?.baseCopy as
    ShadowBinding | undefined;
  if (existing?.space === space && existing?.relayUrl?.replace(/\/$/, "") === normalizedUrl) {
    return false;
  }

  const counts = await getShadowCounts();
  const realCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (realCount > 0) {
    await clearAllShadows();
  }
  await setShadow(
    META_COLLECTION,
    BINDING_ID,
    { space, relayUrl: normalizedUrl } satisfies ShadowBinding,
    0,
    "system"
  );
  return realCount > 0;
}

export function resetSyncConfigCursors(config: SyncConfig, summary: string | null = null): void {
  config.lastSeq = 0;
  config.lastSeqByCollection = {};
  config.lastSyncedAt = null;
  config.lastSyncedSpace = null;
  config.lastSyncedRelayUrl = null;
  config.lastError = null;
  config.lastSyncSummary = summary;
  config.knownDevices = [];
  config.categoryTimestamps = { playlists: null, settings: null, history: null };
}

export async function clearLocalSyncRuntimeState(summary: string | null = null): Promise<void> {
  try {
    await clearAllShadows();
  } catch {
    // IndexedDB may be unavailable in non-browser test environments.
  }

  const b = (globalThis as any).browser || (globalThis as any).chrome;
  if (!b?.storage?.local?.set) return;

  try {
    await b.storage.local.set({
      yph_sync_devices: [],
      yph_sync_status: {
        phase: "idle",
        lastRunAt: null,
        lastError: null,
        lastSummary: summary,
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
      },
    });
  } catch {
    // Best-effort cleanup of cached runtime status.
  }
}
