// packages/sync-crypto/src/hlc.test.ts
import { describe, it, expect } from "vitest";
import { getHlc, compareHlc, isNewer, receiveHlc, hlcToString, parseHlc } from "./hlc.js";

describe("Hybrid Logical Clock", () => {
  const testKey = "ABCDE-FGHJK-MNPQR-STVWX";

  it("should generate increasing HLC values", async () => {
    const hlc1 = await getHlc(testKey);
    const hlc2 = await getHlc(testKey, hlc1);
    const hlc3 = await getHlc(testKey, hlc2);

    expect(isNewer(hlc2, hlc1)).toBe(true);
    expect(isNewer(hlc3, hlc2)).toBe(true);
  });

  it("should handle same-millisecond calls with counter", async () => {
    const hlc1 = await getHlc(testKey);
    const hlc2 = await getHlc(testKey, hlc1);

    // Counter should increment for same wall time
    expect(hlc2.counter).toBeGreaterThan(hlc1.counter);
    expect(hlc2.wall).toBe(hlc1.wall);
  });

  it("should compare HLCs correctly", () => {
    const a = { value: 1000, wall: 1000, counter: 0, deviceHash: 1 };
    const b = { value: 2000, wall: 2000, counter: 0, deviceHash: 1 };
    const c = { value: 1000, wall: 1000, counter: 1, deviceHash: 1 };

    expect(compareHlc(a, b)).toBe(-1);
    expect(compareHlc(b, a)).toBe(1);
    expect(compareHlc(a, c)).toBe(-1); // Same wall, higher counter wins
    expect(compareHlc(a, a)).toBe(0);
  });

  it("should compare with numbers (numbers treated as wall time with counter=0, deviceHash=0)", () => {
    const hlc = { value: 1000, wall: 1000, counter: 0, deviceHash: 1 };
    // Number 1000 becomes {wall: 1000, counter: 0, deviceHash: 0}
    // HLC has deviceHash=1, so it's "newer" than plain timestamp
    expect(compareHlc(hlc, 1000)).toBe(1);
    expect(compareHlc(hlc, 999)).toBe(1);
    expect(compareHlc(hlc, 1001)).toBe(-1);
  });

  it("should receive remote HLC and advance", async () => {
    const local = await getHlc(testKey);
    const remote = { value: local.wall + 1000, wall: local.wall + 1000, counter: 0, deviceHash: 2 };

    const received = await receiveHlc(testKey, remote, local);
    expect(isNewer(received, local)).toBe(true);
    expect(isNewer(received, remote)).toBe(true);
  });

  it("should handle clock regression", async () => {
    const local = await getHlc(testKey);
    const remote = { value: local.wall - 1000, wall: local.wall - 1000, counter: 0, deviceHash: 2 };

    const received = await receiveHlc(testKey, remote, local);
    expect(isNewer(received, local)).toBe(true);
  });

  it("should convert to/from string", async () => {
    const hlc = await getHlc(testKey);
    const str = hlcToString(hlc);
    expect(str).toMatch(/^HLC\(.*c=\d+, d=[0-9a-f]{4}\)$/);
  });

  it("should parse numeric HLC", () => {
    const parsed = parseHlc(1234567890);
    expect(parsed.value).toBe(1234567890);
    expect(parsed.wall).toBe(1234567890);
    expect(parsed.counter).toBe(0);
    expect(parsed.deviceHash).toBe(0);
  });
});
