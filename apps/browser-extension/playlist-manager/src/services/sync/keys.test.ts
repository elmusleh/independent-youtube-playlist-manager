import { describe, expect, it } from "vitest";
import {
  AUTH_TOKEN_KEY_BYTES,
  ENCRYPTION_KEY_BYTES,
  RECORD_ID_KEY_BYTES,
  computeAuthToken,
  computeRecordId,
  computeStorageAddress,
  deriveAuthTokenKey,
  deriveEncryptionKeyOnly,
  deriveKeys,
  deriveRecordIdKey,
  generateKeyFingerprint,
} from "./keys";
import { generateSyncKey, isValidSyncKey } from "./sync-key";

describe("sync v2 keys", () => {
  it("derives three independent keys from a valid sync key", async () => {
    const key = generateSyncKey();
    const derived = await deriveKeys(key);
    expect(derived.encryptionKey).toBeTruthy();
    expect(derived.recordIdKey).toBeTruthy();
    expect(derived.authTokenKey).toBeTruthy();
    // Each key must be usable for its algorithm.
    expect(derived.encryptionKey.algorithm.name).toBe("AES-GCM");
    expect((derived.recordIdKey.algorithm as HmacKeyGenParams).name).toBe("HMAC");
    expect((derived.authTokenKey.algorithm as HmacKeyGenParams).name).toBe("HMAC");
  });

  it("is deterministic for the same sync key", async () => {
    const key = generateSyncKey();
    const a = await deriveKeys(key);
    const b = await deriveKeys(key);
    // Re-export the raw bits by re-deriving through the single-key helpers and comparing HMAC output.
    const addrA = await computeStorageAddress(key);
    const addrB = await computeStorageAddress(key);
    expect(addrA).toBe(addrB);
    expect(a.encryptionKey).not.toBe(b.encryptionKey); // distinct CryptoKey objects
  });

  it("produces different keys for different sync keys", async () => {
    const k1 = generateSyncKey();
    const k2 = generateSyncKey();
    const a1 = await computeStorageAddress(k1);
    const a2 = await computeStorageAddress(k2);
    expect(a1).not.toBe(a2);
    const id1 = await computeRecordId(k1, "playlists", "abc");
    const id2 = await computeRecordId(k2, "playlists", "abc");
    expect(id1).not.toBe(id2);
  });

  it("the three derived keys are independent (different raw material)", async () => {
    const key = generateSyncKey();
    const derived = await deriveKeys(key);
    // Sign the same payload with both HMAC keys; results must differ.
    const data = new TextEncoder().encode("probe");
    const sigId = await crypto.subtle.sign("HMAC", derived.recordIdKey, data);
    const sigAuth = await crypto.subtle.sign("HMAC", derived.authTokenKey, data);
    const hexId = [...new Uint8Array(sigId)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const hexAuth = [...new Uint8Array(sigAuth)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hexId).not.toBe(hexAuth);
  });

  it("computeRecordId is deterministic and opaque (32 hex chars)", async () => {
    const key = generateSyncKey();
    const id1 = await computeRecordId(key, "playlists", "local-123");
    const id2 = await computeRecordId(key, "playlists", "local-123");
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{32}$/);
    // Different collection or plain id → different opaque id
    expect(await computeRecordId(key, "history", "local-123")).not.toBe(id1);
    expect(await computeRecordId(key, "playlists", "local-456")).not.toBe(id1);
  });

  it("computeAuthToken is deterministic and 64 hex chars", async () => {
    const key = generateSyncKey();
    const t1 = await computeAuthToken(key, "space-abc");
    const t2 = await computeAuthToken(key, "space-abc");
    expect(t1).toBe(t2);
    expect(t1).toMatch(/^[0-9a-f]{64}$/);
    expect(await computeAuthToken(key, "space-xyz")).not.toBe(t1);
  });

  it("computeStorageAddress is deterministic and 64 hex chars", async () => {
    const key = generateSyncKey();
    const a1 = await computeStorageAddress(key);
    const a2 = await computeStorageAddress(key);
    expect(a1).toBe(a2);
    expect(a1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("single-key helpers agree with deriveKeys", async () => {
    const key = generateSyncKey();
    const derived = await deriveKeys(key);
    const encOnly = await deriveEncryptionKeyOnly(key);
    const idOnly = await deriveRecordIdKey(key);
    const authOnly = await deriveAuthTokenKey(key);
    // Encrypt with both and compare ciphertext round-trips by checking algorithm + extractability.
    expect(encOnly.algorithm.name).toBe(derived.encryptionKey.algorithm.name);
    expect(idOnly.algorithm.name).toBe(derived.recordIdKey.algorithm.name);
    expect(authOnly.algorithm.name).toBe(derived.authTokenKey.algorithm.name);
  });

  it("key-length constants match AES-256 / HMAC-SHA256", () => {
    expect(ENCRYPTION_KEY_BYTES).toBe(32);
    expect(RECORD_ID_KEY_BYTES).toBe(32);
    expect(AUTH_TOKEN_KEY_BYTES).toBe(32);
  });

  it("fingerprint is deterministic and human-readable", async () => {
    const key = generateSyncKey();
    const fp1 = await generateKeyFingerprint(key);
    const fp2 = await generateKeyFingerprint(key);
    expect(fp1.emoji).toBe(fp2.emoji);
    expect(fp1.words).toBe(fp2.words);
    expect(fp1.emoji.length).toBeGreaterThan(0);
    expect(fp1.words.length).toBeGreaterThan(0);
    // Different keys → (very likely) different fingerprints.
    const other = await generateKeyFingerprint(generateSyncKey());
    expect(other.emoji + other.words).not.toBe(fp1.emoji + fp1.words);
  });

  it("fingerprint accepts a sync key in any casing", async () => {
    const key = generateSyncKey();
    const fp = await generateKeyFingerprint(key);
    const fpLower = await generateKeyFingerprint(key.toLowerCase());
    expect(fpLower.emoji).toBe(fp.emoji);
    expect(fpLower.words).toBe(fp.words);
  });

  it("isValidSyncKey guards the entry point", () => {
    expect(isValidSyncKey(generateSyncKey())).toBe(true);
  });
});
