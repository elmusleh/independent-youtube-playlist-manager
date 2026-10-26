import { afterEach, describe, expect, it, vi } from "vitest";

const putBatch = vi.fn(async (_payload: Record<string, any>) => undefined);

vi.mock("./db-service.js", () => ({
  dbPutMetadataBatch: (payload: Record<string, any>) => putBatch(payload),
}));

import {
  clearForcedRefetch,
  forcedRefetchCount,
  isForcedRefetch,
  markForcedRefetch,
} from "./refresh-registry";
import { enrichVideoMetadata } from "./enrichment-service";

const meta = (videoId: string) => ({
  videoId,
  title: "Title",
  channel: "Channel",
  durationISO: "PT1M",
  durationSeconds: 60,
});

function stubWindow(fetchImpl: (ids: string[]) => Promise<Map<string, any>>) {
  const clearCache = vi.fn(async () => undefined);
  (window as any).videoService = { clearCache };
  (window as any).clearMetadataSessionCache = vi.fn();
  (window as any).ytFetchVideoDurations = vi.fn(fetchImpl);
  return { clearCache };
}

afterEach(() => {
  putBatch.mockClear();
  delete (window as any).videoService;
  delete (window as any).clearMetadataSessionCache;
  delete (window as any).ytFetchVideoDurations;
});

describe("refresh registry", () => {
  it("tracks and clears forced ids", () => {
    markForcedRefetch(["a", "b"]);
    expect(isForcedRefetch("a")).toBe(true);
    expect(forcedRefetchCount()).toBe(2);

    clearForcedRefetch(["a"]);
    expect(isForcedRefetch("a")).toBe(false);
    expect(isForcedRefetch("b")).toBe(true);

    clearForcedRefetch(["b"]);
    expect(forcedRefetchCount()).toBe(0);
  });

  it("ignores empty ids", () => {
    markForcedRefetch(["", "a"]);
    expect(forcedRefetchCount()).toBe(1);
    clearForcedRefetch(["a"]);
  });
});

describe("enrichVideoMetadata", () => {
  it("never deletes cached rows when force is set", async () => {
    // Regression: a forced refresh used to call videoService.clearCache() first,
    // which hard-deleted the IndexedDB rows, so a failed refetch destroyed the
    // title and channel of an entry that was only missing its duration.
    const { clearCache } = stubWindow(async (ids) => new Map(ids.map((id) => [id, meta(id)])));

    const result = await enrichVideoMetadata(["a", "b"], { force: true });

    expect(clearCache).not.toHaveBeenCalled();
    expect(result.metaMap.size).toBe(2);
    expect(result.unavailableIds).toEqual([]);
    expect(putBatch).toHaveBeenCalledTimes(1);
  });

  it("marks ids as forced only for the duration of the pass", async () => {
    stubWindow(async (ids) => {
      // While the fetch is in flight the ids must bypass the persistent cache.
      expect(isForcedRefetch("a")).toBe(true);
      return new Map(ids.map((id) => [id, meta(id)]));
    });

    await enrichVideoMetadata(["a"], { force: true });

    expect(isForcedRefetch("a")).toBe(false);
  });

  it("leaves the cache alone and reports unavailable ids when nothing resolves", async () => {
    const { clearCache } = stubWindow(async () => new Map());

    const result = await enrichVideoMetadata(["a", "b"], { force: true });

    expect(clearCache).not.toHaveBeenCalled();
    expect(result.metaMap.size).toBe(0);
    expect(result.unavailableIds).toEqual(["a", "b"]);
    expect(putBatch).not.toHaveBeenCalled();
  });

  it("does not mark ids as forced for a normal (non-forced) pass", async () => {
    stubWindow(async (ids) => {
      expect(isForcedRefetch("a")).toBe(false);
      return new Map(ids.map((id) => [id, meta(id)]));
    });

    await enrichVideoMetadata(["a"]);

    expect(isForcedRefetch("a")).toBe(false);
  });

  it("clears the registry even when the fetch throws", async () => {
    stubWindow(async () => {
      throw new Error("network down");
    });

    await expect(enrichVideoMetadata(["a"], { force: true })).rejects.toThrow("network down");
    expect(isForcedRefetch("a")).toBe(false);
  });
});
