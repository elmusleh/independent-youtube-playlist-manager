import { describe, expect, it, vi } from "vitest";
import {
  InvalidSyncKeyError,
  SYNC_KEY_GROUPS,
  assertValidSyncKey,
  formatSyncKey,
  generateSyncKey,
  isValidSyncKey,
  normalizeSyncKey,
} from "./sync-key";

describe("sync key", () => {
  it("generates a formatted key that validates", () => {
    for (let run = 0; run < 25; run += 1) {
      const key = generateSyncKey();
      expect(key.split("-")).toHaveLength(SYNC_KEY_GROUPS);
      expect(isValidSyncKey(key)).toBe(true);
    }
  });

  it("generates a different key each time", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateSyncKey()));
    expect(keys.size).toBe(50);
  });

  it("never emits the ambiguous glyphs I, L, O or U", () => {
    const joined = Array.from({ length: 50 }, () => generateSyncKey()).join("");
    expect(joined).not.toMatch(/[ILOU]/);
  });

  it("normalises separators, case and handwritten glyphs", () => {
    expect(normalizeSyncKey(" abcde fghjk-mnpqr stvwx ")).toBe("ABCDEFGHJKMNPQRSTVWX");
    expect(normalizeSyncKey("OIL0")).toBe("0110");
  });

  it("round-trips through formatting", () => {
    const key = generateSyncKey();
    expect(formatSyncKey(normalizeSyncKey(key))).toBe(key);
  });

  it("rejects keys of the wrong length", () => {
    expect(isValidSyncKey("ABCDE-FGHJK")).toBe(false);
    expect(isValidSyncKey("")).toBe(false);
    expect(isValidSyncKey(`${generateSyncKey()}-X`)).toBe(false);
  });

  it("rejects symbols outside the alphabet", () => {
    expect(isValidSyncKey("ABCDE-FGHJK-MNPQR-STVWU")).toBe(false);
  });

  it("throws a UI-ready error from assertValidSyncKey", () => {
    expect(() => assertValidSyncKey("nope")).toThrow(InvalidSyncKeyError);
    expect(() => assertValidSyncKey("nope")).toThrow(/20 characters/);
  });

  it("returns the canonical form from assertValidSyncKey", () => {
    expect(assertValidSyncKey("abcde fghjk mnpqr stvwx")).toBe("ABCDEFGHJKMNPQRSTVWX");
  });

  it("maps bytes to symbols uniformly (256 is an exact multiple of 32)", () => {
    const getRandomValues = vi.fn((buffer: Uint8Array) => {
      buffer[0] = 255; // must map to the last symbol, not be discarded
      return buffer;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    // 255 % 32 === 31, the last symbol of the alphabet.
    expect(generateSyncKey()).toBe("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ");
    expect(getRandomValues).toHaveBeenCalledTimes(20);
    vi.unstubAllGlobals();
  });
});
