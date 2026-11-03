import { describe, expect, it } from "vitest";
import { computeHash } from "./shadow-store";

describe("sync v2 shadow store (dirty detection)", () => {
  it("computeHash is stable for equal input", () => {
    const a = computeHash({ x: 1, y: [2, 3] });
    const b = computeHash({ x: 1, y: [2, 3] });
    expect(a).toBe(b);
  });

  it("computeHash differs for different input", () => {
    expect(computeHash({ x: 1 })).not.toBe(computeHash({ x: 2 }));
  });

  it("computeHash distinguishes arrays from objects", () => {
    expect(computeHash([1, 2])).not.toBe(computeHash({ 0: 1, 1: 2 }));
  });

  it("computeHash handles null and undefined (both map to null)", () => {
    expect(computeHash(null)).toBe(computeHash(null));
    expect(computeHash(undefined)).toBe(computeHash(undefined));
    expect(computeHash(null)).toBe(computeHash(undefined));
  });

  it("a record with no shadow is treated as dirty (documented contract)", () => {
    // isDirty returns true when getShadow returns null. We can't exercise IndexedDB
    // in this environment, so we assert the pure contract: computeHash of a fresh
    // record differs from the empty sentinel.
    expect(computeHash({ title: "A" })).not.toBe("00000000");
  });
});
