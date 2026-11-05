import { describe, expect, it } from "vitest";
import { compareHlc, getHlc, hlcToString, isNewer, parseHlc, receiveHlc } from "./hlc";
import { generateSyncKey } from "./sync-key";

describe("sync v2 HLC", () => {
  it("generates a timestamp with the expected shape", async () => {
    const key = generateSyncKey();
    const h = await getHlc(key);
    expect(typeof h.value).toBe("number");
    expect(typeof h.wall).toBe("number");
    expect(typeof h.counter).toBe("number");
    expect(typeof h.deviceHash).toBe("number");
    expect(h.value).toBeGreaterThan(0);
  });

  it("is monotonic across rapid calls", async () => {
    const key = generateSyncKey();
    const a = await getHlc(key);
    const b = await getHlc(key, a);
    expect(compareHlc(b, a)).toBeGreaterThan(0);
  });

  it("compareHlc returns 0 for equal values", () => {
    const h = { value: 5, wall: 5, counter: 0, deviceHash: 0 };
    expect(compareHlc(h, h)).toBe(0);
  });

  it("isNewer reflects compareHlc", () => {
    const a = { value: 1, wall: 1, counter: 0, deviceHash: 0 };
    const b = { value: 2, wall: 2, counter: 0, deviceHash: 0 };
    expect(isNewer(b, a)).toBe(true);
    expect(isNewer(a, b)).toBe(false);
  });

  it("receiveHlc never goes backwards", async () => {
    const key = generateSyncKey();
    const local = await getHlc(key);
    const remote = { ...local, wall: local.wall + 1000, value: local.wall + 1000 };
    const received = await receiveHlc(key, remote, local);
    expect(compareHlc(received, local)).toBeGreaterThanOrEqual(0);
  });

  it("hlcToString / parseHlc round-trip the numeric value", () => {
    const h = { value: 12345, wall: 1, counter: 2, deviceHash: 3 };
    const s = hlcToString(h);
    expect(typeof s).toBe("string");
    const parsed = parseHlc(h.value);
    expect(parsed.value).toBe(h.value);
  });

  it("accepts a numeric HLC in compareHlc", () => {
    expect(compareHlc(10, 5)).toBeGreaterThan(0);
    expect(compareHlc(5, 10)).toBeLessThan(0);
  });
});
