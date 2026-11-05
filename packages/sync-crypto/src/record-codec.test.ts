// packages/sync-crypto/src/record-codec.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import {
  encodeRecord,
  decodeRecord,
  encryptRecord,
  decryptRecord,
  createRecord,
  createTombstone,
  isTombstone,
  RECORD_VERSION,
} from "./record-codec.js";
import { deriveKeys, generateSyncKey } from "./keys.js";

describe("Record Codec", () => {
  let keys: Awaited<ReturnType<typeof deriveKeys>>;

  beforeAll(async () => {
    keys = await deriveKeys(generateSyncKey());
  });

  it("should encode and decode records", () => {
    const record = createRecord("playlists", "test-id", { title: "Test", videos: ["v1", "v2"] });
    const encoded = encodeRecord(record);
    const decoded = decodeRecord(encoded);

    expect(decoded.collection).toBe("playlists");
    expect(decoded.id).toBe("test-id");
    expect(decoded.data).toEqual({ title: "Test", videos: ["v1", "v2"] });
    expect(decoded.deleted).toBe(false);
  });

  it("should create tombstones", () => {
    const tombstone = createTombstone("playlists", "test-id");
    expect(isTombstone(tombstone)).toBe(true);
    expect(tombstone.deleted).toBe(true);
    expect(tombstone.data).toBeNull();
  });

  it("should encrypt and decrypt records", async () => {
    const record = createRecord("playlists", "test-id", { title: "Test", count: 42 });
    const encrypted = await encryptRecord(record, keys);

    expect(encrypted.v).toBe(RECORD_VERSION);
    expect(encrypted.collection).toBe("playlists");
    expect(encrypted.id).toBe("test-id");
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    expect(encrypted.deleted).toBe(false);

    const decrypted = await decryptRecord(encrypted, keys);
    expect(decrypted.collection).toBe("playlists");
    expect(decrypted.id).toBe("test-id");
    expect(decrypted.data).toEqual({ title: "Test", count: 42 });
  });

  it("should fail decryption with wrong key", async () => {
    const record = createRecord("playlists", "test-id", { title: "Test" });
    const encrypted = await encryptRecord(record, keys);

    const otherKeys = await deriveKeys(generateSyncKey());

    await expect(decryptRecord(encrypted, otherKeys)).rejects.toThrow();
  });

  it("should produce different ciphertext each time (nonce)", async () => {
    const record = createRecord("playlists", "test-id", { title: "Test" });

    const encrypted1 = await encryptRecord(record, keys);
    const encrypted2 = await encryptRecord(record, keys);

    expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });
});
