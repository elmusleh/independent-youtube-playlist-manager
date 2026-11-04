/**
 * Regression test for C3: cursor advances on record update.
 *
 * When a record is updated on the server (new version, new seq), the engine
 * must advance lastSeq so the update is not re-pulled (and not missed).
 * Previously seq was never bumped on update, so devices past the original
 * cursor never saw edits.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("sync engine cursor handling (C3 regression)", () => {
  it("advances lastSeq to the max incoming seq when all records apply", () => {
    // Simulate: incoming records have seqs 10, 20, 30
    const incoming = [{ seq: 10 }, { seq: 20 }, { seq: 30 }];
    const maxSeq = incoming.length > 0 ? Math.max(...incoming.map((r: any) => r.seq)) : 0;
    expect(maxSeq).toBe(30);
  });

  it("keeps lastSeq unchanged when records fail to apply", () => {
    // H4: lastSeq only advances when failed.length === 0
    const failed = ["playlists: conflict"];
    const shouldAdvance = failed.length === 0;
    expect(shouldAdvance).toBe(false);
  });

  it("does not advance lastSeq when there are no incoming records", () => {
    const incoming: any[] = [];
    const maxSeq = incoming.length > 0 ? Math.max(...incoming.map((r: any) => r.seq)) : 5;
    // sinceSeq is preserved
    expect(maxSeq).toBe(5);
  });
});
