/// <reference path="../types/services.d.ts" />

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

export interface EnrichmentResult {
  /** videoId -> resolved metadata (only videos the engine actually resolved) */
  metaMap: Map<string, NormalizedVideoMeta>;
  /** videoIds that returned no metadata from any tier in this pass */
  unavailableIds: string[];
}

export interface EnrichmentOptions {
  /** Clear the persistent IndexedDB cache first (full source refetch) */
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

  // Always clear session cache for these IDs so prior individual fetch
  // failures (which may have set null entries) don't block the batch retry.
  if (typeof window.clearMetadataSessionCache === "function") {
    window.clearMetadataSessionCache(videoIds);
  }

  // For a force refetch, also clear the persistent cache so we hit the APIs.
  if (force && window.videoService) {
    await window.videoService.clearCache(videoIds);
  }

  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    if (shouldCancel?.()) break;

    const batch = videoIds.slice(i, i + BATCH_SIZE);
    const batchResults = await window.ytFetchVideoDurations(batch);
    batchResults.forEach((val, key) => {
      metaMap.set(key, val);
    });

    onProgress?.(Math.min(i + BATCH_SIZE, videoIds.length), videoIds.length);
  }

  // IDs not resolved by any tier are flagged as unavailable. These placeholders
  // are NOT persisted: a transient failure shouldn't permanently tag a valid
  // video. The caller tags them in-memory for display.
  const unavailableIds = videoIds.filter((id) => !metaMap.has(id));

  // Persist genuinely resolved metadata to IndexedDB (silent save).
  if (metaMap.size > 0) {
    const metaObj: Record<string, NormalizedVideoMeta> = {};
    metaMap.forEach((val, key) => {
      metaObj[key] = val;
    });
    await dbPutMetadataBatch(metaObj);
  }

  return { metaMap, unavailableIds };
}
