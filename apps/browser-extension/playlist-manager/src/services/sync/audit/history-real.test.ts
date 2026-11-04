// BUG-10 against the REAL f503f5f history adapter (no mirror): a routine pass with an EMPTY remote
// and real local history must not erase local history.
import { it, expect } from "vitest";
import { applyRemoteHistory } from "../adapters/history";
it("BUG-10r real adapter keeps existing local history on an empty remote pass", async () => {
  const local: Record<string, any> = {
    vidAAAAAAAAA: {
      videoId: "vidAAAAAAAAA",
      title: "Kept A",
      lastWatchedAt: 1762250000000,
      watchCount: 3,
      progress: 0.5,
    },
    vidBBBBBBBBB: {
      videoId: "vidBBBBBBBBB",
      title: "Kept B",
      lastWatchedAt: 1762240000000,
      watchCount: 1,
      progress: 1,
    },
  };
  let saved: any = null;
  const ctx: any = {
    syncKey: "ABCDEFGHJKMNPQRSTVWX",
    localDeviceId: "dev-A",
    librarySnapshot: async () => ({ history: local }),
    saveHistory: async (e: any[]) => {
      saved = e;
    },
  };
  const res = await applyRemoteHistory(ctx, []);
  console.log(
    "HIST-REAL failed:",
    JSON.stringify(res.failed),
    "saved:",
    saved === null ? "not-called" : saved.length
  );
  expect(saved === null || saved.length >= 2).toBe(true);
});
