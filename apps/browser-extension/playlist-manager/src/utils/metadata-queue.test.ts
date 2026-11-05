import { describe, expect, it } from "vitest";
import type { NormalizedVideoMeta } from "../types/model";
import {
  clearSelected,
  collectOriginOptions,
  filterUnavailable,
  paginateQueue,
  selectAllVisible,
  unavailableReason,
} from "./metadata-queue";

function meta(overrides: Partial<NormalizedVideoMeta> = {}): NormalizedVideoMeta {
  return { videoId: "aaaaaaaaaaa", title: "", channel: "", ...overrides } as NormalizedVideoMeta;
}

const origins = {
  aaaaaaaaaaa: [{ id: "local-a", title: "Alpha Mix" }],
  bbbbbbbbbbb: [
    { id: "local-b", title: "Beta Mix" },
    { id: "local-a", title: "Alpha Mix" },
  ],
};

describe("metadata queue helpers", () => {
  it("classifies terminal reasons in priority order", () => {
    expect(unavailableReason(meta({ isPrivate: true, isUnavailable: true }))).toBe("private");
    expect(unavailableReason(meta({ isBroken: true }))).toBe("broken");
    expect(unavailableReason(meta({ isUnavailable: true }))).toBe("deleted");
    expect(unavailableReason(meta())).toBe("other");
  });

  it("filters by reason and origin", () => {
    const items = [
      meta({ videoId: "aaaaaaaaaaa", isUnavailable: true }),
      meta({ videoId: "bbbbbbbbbbb", isPrivate: true }),
      meta({ videoId: "ccccccccccc", isBroken: true }),
    ];
    expect(filterUnavailable(items, origins, "deleted", "all").map((i) => i.videoId)).toEqual([
      "aaaaaaaaaaa",
    ]);
    expect(filterUnavailable(items, origins, "all", "local-b").map((i) => i.videoId)).toEqual([
      "bbbbbbbbbbb",
    ]);
    expect(filterUnavailable(items, origins, "all", "local-a")).toHaveLength(2);
  });

  it("dedupes and sorts origin options", () => {
    expect(collectOriginOptions(origins)).toEqual([
      { id: "local-a", title: "Alpha Mix" },
      { id: "local-b", title: "Beta Mix" },
    ]);
  });

  it("paginates and clamps out-of-range pages", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(paginateQueue(items, 1, 3)).toEqual([1, 2, 3]);
    expect(paginateQueue(items, 2, 3)).toEqual([4, 5, 6]);
    expect(paginateQueue(items, 99, 3)).toEqual([7]);
    expect(paginateQueue([], 4, 3)).toEqual([]);
  });

  it("adds visible ids and removes selected ids without mutating input", () => {
    const initial = new Set(["a"]);
    expect([...selectAllVisible(initial, ["b", "a"])]).toEqual(["a", "b"]);
    expect(initial.has("b")).toBe(false);
    expect([...clearSelected(new Set(["a", "b", "c"]), ["b"])]).toEqual(["a", "c"]);
  });
});
