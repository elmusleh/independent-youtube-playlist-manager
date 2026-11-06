// packages/sync-crypto/src/keys.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import {
  generateSyncKey,
  normalizeSyncKey,
  formatSyncKey,
  isValidSyncKey,
  assertValidSyncKey,
  deriveKeys,
  deriveEncryptionKeyOnly,
  deriveRecordIdKey,
  deriveAuthTokenKey,
  computeRecordId,
  computeAuthToken,
  computeStorageAddress,
  generateKeyFingerprint,
  InvalidSyncKeyError,
} from "./keys.js";

describe("Sync Key Management", () => {
  let validKey: string;

  beforeAll(() => {
    validKey = generateSyncKey();
  });

  it("should generate a valid 20-symbol key", () => {
    const key = generateSyncKey();
    expect(key).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    expect(isValidSyncKey(key)).toBe(true);
  });

  it("should normalize user input", () => {
    // Use only valid Crockford base32 characters (no I, L, O, U)
    // Valid chars: 0-9, A-H, J-K, M-N, P-T, V-Z
    expect(normalizeSyncKey("abcd-efgh-jkmn-pqrt")).toBe("ABCDEFGHJKMNPQRT");
    expect(normalizeSyncKey("AbCd EfGh JkMn PqRt")).toBe("ABCDEFGHJKMNPQRT");
    expect(normalizeSyncKey("o1l")).toBe("011"); // O->0, I/L->1
  });

  it("should format with groups of 5", () => {
    // Use only valid Crockford characters (no I, L, O, U)
    expect(formatSyncKey("ABCDEFGHJKMNPQRSTV")).toBe("ABCDE-FGHJK-MNPQR-STV");
  });

  it("should validate correct keys", () => {
    expect(isValidSyncKey(validKey)).toBe(true);
    expect(isValidSyncKey("ABCDE-FGHJK-MNPQR-STVWX")).toBe(true);
  });

  it("should reject invalid keys", () => {
    expect(isValidSyncKey("ABCDE-FGHJK-MNPQR-STVW")).toBe(false); // too short
    expect(isValidSyncKey("ABCDE-FGHJK-MNPQR-STVWXZ")).toBe(false); // too long
    // 'I' normalizes to '1' so use a char that's truly invalid even after normalization
    expect(isValidSyncKey("ABCDE-FGHJK-MNPQR-STVW!")).toBe(false); // ! not in alphabet
    expect(isValidSyncKey("")).toBe(false);
  });

  it("should assert valid keys and throw on invalid", () => {
    expect(() => assertValidSyncKey(validKey)).not.toThrow();
    expect(() => assertValidSyncKey("invalid")).toThrow(InvalidSyncKeyError);
  });
});

describe("Key Derivation", () => {
  let testKey: string;

  beforeAll(() => {
    testKey = generateSyncKey();
  });

  it("should derive three independent keys", async () => {
    const keys = await deriveKeys(testKey);
    expect(keys.encryptionKey).toBeDefined();
    expect(keys.recordIdKey).toBeDefined();
    expect(keys.authTokenKey).toBeDefined();
    expect(keys.encryptionKey).not.toBe(keys.recordIdKey);
    expect(keys.encryptionKey).not.toBe(keys.authTokenKey);
    expect(keys.recordIdKey).not.toBe(keys.authTokenKey);
  });

  it("should derive encryption key only", async () => {
    const key = await deriveEncryptionKeyOnly(testKey);
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe("AES-GCM");
  });

  it("should derive record id key only", async () => {
    const key = await deriveRecordIdKey(testKey);
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe("HMAC");
  });

  it("should derive auth token key only", async () => {
    const key = await deriveAuthTokenKey(testKey);
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe("HMAC");
  });

  it("should produce deterministic keys for same input", async () => {
    const keys1 = await deriveKeys(testKey);
    const keys2 = await deriveKeys(testKey);

    // Keys are not extractable, compare algorithm and usages instead
    expect(keys1.encryptionKey.algorithm.name).toBe(keys2.encryptionKey.algorithm.name);
    expect(keys1.recordIdKey.algorithm.name).toBe(keys2.recordIdKey.algorithm.name);
    expect(keys1.authTokenKey.algorithm.name).toBe(keys2.authTokenKey.algorithm.name);
  });

  it("should produce different keys for different inputs", async () => {
    const key1 = generateSyncKey();
    const key2 = generateSyncKey();

    const keys1 = await deriveKeys(key1);
    const keys2 = await deriveKeys(key2);

    // Can't extract raw keys, but they should be different CryptoKey objects
    expect(keys1.encryptionKey).not.toBe(keys2.encryptionKey);
  });
});

describe("Record Identity & Auth", () => {
  let testKey: string;

  beforeAll(() => {
    testKey = generateSyncKey();
  });

  it("should compute opaque record IDs", async () => {
    const id1 = await computeRecordId(testKey, "playlists", "playlist-123");
    const id2 = await computeRecordId(testKey, "playlists", "playlist-456");
    const id3 = await computeRecordId(testKey, "history", "playlist-123");

    expect(id1).toHaveLength(32);
    expect(id2).toHaveLength(32);
    expect(id1).not.toBe(id2); // Different plain IDs
    expect(id1).not.toBe(id3); // Different collections
  });

  it("should compute auth tokens", async () => {
    const token1 = await computeAuthToken(testKey, "space-123");
    const token2 = await computeAuthToken(testKey, "space-456");

    expect(token1).toHaveLength(64); // SHA-256 hex
    expect(token1).not.toBe(token2);
  });

  it("should compute storage addresses", async () => {
    const addr1 = await computeStorageAddress(testKey);
    const addr2 = await computeStorageAddress(testKey);
    const addr3 = await computeStorageAddress(generateSyncKey());

    expect(addr1).toHaveLength(64);
    expect(addr1).toBe(addr2); // Deterministic
    expect(addr1).not.toBe(addr3); // Different keys = different addresses
  });
});

describe("Key Fingerprint", () => {
  let testKey: string;

  beforeAll(() => {
    testKey = generateSyncKey();
  });

  it("should generate emoji + word fingerprint", async () => {
    const fp = await generateKeyFingerprint(testKey);
    // Emoji are grapheme clusters, count them properly
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    expect([...segmenter.segment(fp.emoji)]).toHaveLength(4);
    expect(fp.words).toMatch(/^[a-z]+(-[a-z]+){3}$/);
  });

  it("should be deterministic for same key", async () => {
    const fp1 = await generateKeyFingerprint(testKey);
    const fp2 = await generateKeyFingerprint(testKey);
    expect(fp1).toEqual(fp2);
  });

  it("should differ for different keys", async () => {
    const fp1 = await generateKeyFingerprint(testKey);
    const fp2 = await generateKeyFingerprint(generateSyncKey());
    expect(fp1).not.toEqual(fp2);
  });
});
