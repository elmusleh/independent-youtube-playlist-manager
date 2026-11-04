import { describe, expect, it } from "vitest";
import { generateKeyFingerprint } from "./fingerprint";
import { generateSyncKey } from "./sync-key";

describe("sync v2 fingerprint", () => {
  it("is deterministic for the same key", async () => {
    const key = generateSyncKey();
    const a = await generateKeyFingerprint(key);
    const b = await generateKeyFingerprint(key);
    expect(a).toEqual(b);
  });

  it("differs for different keys", async () => {
    const a = await generateKeyFingerprint(generateSyncKey());
    const b = await generateKeyFingerprint(generateSyncKey());
    expect(a.emoji + a.words).not.toBe(b.emoji + b.words);
  });

  it("returns both emoji and words", async () => {
    const fp = await generateKeyFingerprint(generateSyncKey());
    expect(typeof fp.emoji).toBe("string");
    expect(typeof fp.words).toBe("string");
    expect(fp.emoji.length).toBeGreaterThan(0);
    expect(fp.words.length).toBeGreaterThan(0);
  });
});
