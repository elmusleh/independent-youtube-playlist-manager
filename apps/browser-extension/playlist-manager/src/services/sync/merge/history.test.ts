import { describe, expect, it } from "vitest";
import { mergeHistory } from "./history";

describe("sync v2 history merge", () => {
  it("keeps the newest entry per video", () => {
    const base: any[] = [];
    const local: any[] = [{ videoId: "v1", lastWatchedAt: 10 }];
    const remote: any[] = [{ videoId: "v1", lastWatchedAt: 20 }];
    const { merged } = mergeHistory(local, remote, base);
    expect(merged.find((e: any) => e.videoId === "v1")!.lastWatchedAt).toBe(20);
  });

  it("adds entries present on only one side", () => {
    const base: any[] = [];
    const local: any[] = [{ videoId: "v1", lastWatchedAt: 10 }];
    const remote: any[] = [{ videoId: "v2", lastWatchedAt: 20 }];
    const { merged } = mergeHistory(local, remote, base);
    expect(merged.map((e: any) => e.videoId).sort()).toEqual(["v1", "v2"]);
  });

  it("returns tombstones when deleted on both sides", () => {
    const base: any[] = [{ videoId: "v1", lastWatchedAt: 10 }];
    const local: any[] = [];
    const remote: any[] = [];
    const { tombstones } = mergeHistory(local, remote, base);
    expect(tombstones).toContain("v1");
  });
});
