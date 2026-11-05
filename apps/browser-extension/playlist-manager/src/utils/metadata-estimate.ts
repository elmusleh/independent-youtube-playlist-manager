import type { MetadataGapSummary } from "./metadata-completeness";

export const DATA_API_BATCH_SIZE = 50;
export const DATA_API_DAILY_QUOTA = 10_000;

export interface MetadataUsageEstimate {
  needsWork: number;
  durationOnly: number;
  otherGaps: number;
  resolved: number;
  apiRequests: number;
  quotaUnits: number;
  quotaPercent: number;
  refreshesPerDay: number;
  fitsInFreeDay: boolean;
}

/**
 * Estimate the free Data API cost of repairing the current cache.
 *
 * `videos.list` costs 1 unit and accepts up to 50 IDs, so the number of
 * requests equals the number of quota units. Keep this pure so the UI and
 * tests cannot drift apart.
 */
export function estimateMetadataUsage(
  summary: MetadataGapSummary,
  options: { batchSize?: number; dailyQuota?: number } = {}
): MetadataUsageEstimate {
  const batchSize = Math.max(1, options.batchSize ?? DATA_API_BATCH_SIZE);
  const dailyQuota = Math.max(1, options.dailyQuota ?? DATA_API_DAILY_QUOTA);
  const needsWork = Math.max(0, summary.needsAttention);
  const durationOnly = Math.min(needsWork, Math.max(0, summary.durationRecoverable));
  const apiRequests = Math.ceil(needsWork / batchSize);
  const quotaPercent = (apiRequests / dailyQuota) * 100;

  return {
    needsWork,
    durationOnly,
    otherGaps: Math.max(0, needsWork - durationOnly),
    resolved: Math.max(0, summary.complete),
    apiRequests,
    quotaUnits: apiRequests,
    quotaPercent,
    refreshesPerDay: apiRequests > 0 ? Math.floor(dailyQuota / apiRequests) : Infinity,
    fitsInFreeDay: apiRequests <= dailyQuota,
  };
}
