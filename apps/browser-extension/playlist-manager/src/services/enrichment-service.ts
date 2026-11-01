/// <reference path="../types/services.ts" />

/**
 * Background metadata enrichment coordinator.
 *
 * Fetches video metadata in the background using the existing multi-tier
 * engine (youtube-api.ts), chunking into batches of 50, and persists resolved
 * metadata to IndexedDB. UI state (progress modal, video array mapping) stays
 * in the caller.
 */
import { dbPutMetadataBatch } from "./db-service.js";
import type { NormalizedVideoMeta } from "../types/model.js";
import { clearForcedRefetch, markForcedRefetch } from "./refresh-registry.js";

export interface EnrichmentResult {
  /** videoId -> resolved metadata (only videos the engine actually resolved) */
  metaMap: Map<string, NormalizedVideoMeta>;
  /** videoIds that returned no metadata from any tier in this pass */
  unavailableIds: string[];
}

export interface EnrichmentOptions {
  /**
   * Re-fetch even when a cached row exists.
   *
   * This does NOT delete cached rows. Ids are marked in the refresh registry so
   * the fetch path bypasses the persistent cache, results overwrite the old rows
   * on success, and a failed fetch leaves the previous entry intact.
   */
  force?: boolean;
  /** Called after each batch: (fetchedCount, totalCount) */
  onProgress?: (fetched: number, total: number) => void;
  /** Called between batches; return true to stop fetching early */
  shouldCancel?: () => boolean;
}

const BATCH_SIZE = 50;

export async function enrichVideoMetadata(
  videoIds: string[],
  options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  const { force = false, onProgress, shouldCancel } = options;
  const metaMap = new Map<string, NormalizedVideoMeta>();

  if (videoIds.length === 0) {
    return { metaMap, unavailableIds: [] };
  }

  let fetchIds = videoIds;

  // Respect already-resolved rows (including terminal tombstones) unless the
  // caller explicitly asked for a forced refresh. This is what stops deleted
  // videos from being re-fetched by silent background enrichment.
  if (!force && typeof window.videoService?.getVideoMetadataBatch === "function") {
    try {
      const cached = await window.videoService.getVideoMetadataBatch(videoIds);
      for (const [id, meta] of Object.entries(cached)) {
        if (meta) metaMap.set(id, meta as unknown as NormalizedVideoMeta);
      }
      fetchIds = videoIds.filter((id) => !cached[id]);
      if (fetchIds.length === 0) return { metaMap, unavailableIds: [] };
    } catch {
      /* Cache read is best-effort; fall through to the network path. */
    }
  }

  // Always clear session cache for these IDs so prior individual fetch
  // failures (which may have set null entries) don't block the batch retry.
  if (typeof window.clearMetadataSessionCache === "function") {
    window.clearMetadataSessionCache(fetchIds);
  }

  // A forced refetch bypasses the cache without deleting it.
  if (force) markForcedRefetch(videoIds);

  try {
    for (let i = 0; i < fetchIds.length; i += BATCH_SIZE) {
      if (shouldCancel?.()) break;

      const batch = fetchIds.slice(i, i + BATCH_SIZE);
      const batchResults = await window.ytFetchVideoDurations(batch);
      batchResults.forEach((val, key) => {
        metaMap.set(key, val);
      });

      // Persist each batch as soon as it resolves so an interruption (navigating
      // away or closing the tab mid-fetch) can't lose the metadata already
      // fetched. On resume, the persistent cache short-circuits these IDs.
      if (batchResults.size > 0) {
        const batchObj: Record<string, NormalizedVideoMeta> = {};
        batchResults.forEach((val, key) => {
          batchObj[key] = val;
        });
        await dbPutMetadataBatch(batchObj);
      }

      onProgress?.(Math.min(i + BATCH_SIZE, fetchIds.length), fetchIds.length);
    }
  } finally {
    if (force) clearForcedRefetch(videoIds);
  }

  // IDs not resolved by any tier are flagged as unavailable. These placeholders
  // are NOT persisted: a transient failure shouldn't permanently tag a valid
  // video. The caller tags them in-memory for display.
  const unavailableIds = fetchIds.filter((id) => !metaMap.has(id));

  return { metaMap, unavailableIds };
}
