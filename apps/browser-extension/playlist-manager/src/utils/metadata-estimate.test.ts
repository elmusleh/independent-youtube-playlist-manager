import { describe, expect, it } from "vitest";
import type { MetadataGapSummary } from "./metadata-completeness";
import { estimateMetadataUsage } from "./metadata-estimate";

function summary(overrides: Partial<MetadataGapSummary> = {}): MetadataGapSummary {
  return {
    total: 0,
    complete: 0,
    needsAttention: 0,
    missingDuration: 0,
    missingTitle: 0,
    missingChannel: 0,
    durationRecoverable: 0,
    live: 0,
    terminal: 0,
    empty: 0,
    recoverableIds: [],
    ...overrides,
  };
}

describe("estimateMetadataUsage", () => {
  it("returns an empty estimate for a resolved cache", () => {
    const result = estimateMetadataUsage(summary({ total: 206, complete: 206 }));
    expect(result).toMatchObject({
      needsWork: 0,
      apiRequests: 0,
      quotaUnits: 0,
      quotaPercent: 0,
      fitsInFreeDay: true,
    });
  });

  it("batches up to 50 IDs per request", () => {
    expect(estimateMetadataUsage(summary({ needsAttention: 120 })).apiRequests).toBe(3);
    expect(estimateMetadataUsage(summary({ needsAttention: 121 })).apiRequests).toBe(3);
    expect(estimateMetadataUsage(summary({ needsAttention: 150 })).apiRequests).toBe(3);
    expect(estimateMetadataUsage(summary({ needsAttention: 151 })).apiRequests).toBe(4);
  });

  it("separates duration-only from other gaps", () => {
    const result = estimateMetadataUsage(summary({ needsAttention: 10, durationRecoverable: 7 }));
    expect(result.durationOnly).toBe(7);
    expect(result.otherGaps).toBe(3);
  });

  it("flags estimates above the daily free quota", () => {
    const under = estimateMetadataUsage(summary({ needsAttention: 500_000 }));
    expect(under.apiRequests).toBe(10_000);
    expect(under.fitsInFreeDay).toBe(true);

    const over = estimateMetadataUsage(summary({ needsAttention: 500_001 }));
    expect(over.apiRequests).toBe(10_001);
    expect(over.fitsInFreeDay).toBe(false);
  });

  it("supports custom quota/batch sizes for future providers", () => {
    const result = estimateMetadataUsage(summary({ needsAttention: 100 }), {
      batchSize: 10,
      dailyQuota: 50,
    });
    expect(result.apiRequests).toBe(10);
    expect(result.quotaPercent).toBe(20);
    expect(result.refreshesPerDay).toBe(5);
  });
});
