import { describe, expect, it } from "vitest";
import { deriveKeys } from "./keys";
import {
  RECORD_VERSION,
  createRecord,
  createTombstone,
  decodeRecord,
  decryptRecord,
  encodeRecord,
  encryptRecord,
  isTombstone,
} from "./record-codec";
import { generateSyncKey } from "./sync-key";

describe("sync v2 record codec", () => {
  it("round-trips a record through encode/decode", () => {
    const record = createRecord("playlists", "id-1", { title: "Mix", videos: ["a", "b"] }, 42);
    const bytes = encodeRecord(record);
    const decoded = decodeRecord(bytes);
    expect(decoded).toEqual(record);
  });

  it("rejects an unsupported version on decode", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 99, collection: "x", id: "y", hlc: 1, deleted: false, data: null })
    );
    expect(() => decodeRecord(bytes)).toThrow(/Unsupported record version/);
  });

  it("rejects a record missing required fields", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ v: RECORD_VERSION }));
    expect(() => decodeRecord(bytes)).toThrow(/missing required fields/);
  });

  it("encrypts and decrypts with the matching key", async () => {
    const syncKey = generateSyncKey();
    const keys = await deriveKeys(syncKey);
    const record = createRecord("playlists", "id-1", { title: "Mix" }, 7);
    const encrypted = await encryptRecord(record, keys);
    expect(encrypted.v).toBe(RECORD_VERSION);
    expect(encrypted.collection).toBe("playlists");
    expect(encrypted.id).toBe("id-1");
    // Ciphertext must not contain the plaintext title in clear.
    expect(atob(encrypted.ciphertext)).not.toContain("Mix");
    const decrypted = await decryptRecord(encrypted, keys);
    expect(decrypted).toEqual(record);
  });

  it("fails to decrypt with a different key", async () => {
    const keysA = await deriveKeys(generateSyncKey());
    const keysB = await deriveKeys(generateSyncKey());
    const record = createRecord("playlists", "id-1", { title: "Mix" }, 7);
    const encrypted = await encryptRecord(record, keysA);
    await expect(decryptRecord(encrypted, keysB)).rejects.toThrow(/decryption failed/i);
  });

  it("fails to decrypt when ciphertext is tampered (GCM auth)", async () => {
    const keys = await deriveKeys(generateSyncKey());
    const record = createRecord("playlists", "id-1", { title: "Mix" }, 7);
    const encrypted = await encryptRecord(record, keys);
    // Flip a byte in the ciphertext.
    const raw = atob(encrypted.ciphertext);
    const bytes = raw.split("").map((c) => c.charCodeAt(0));
    bytes[0] ^= 0xff;
    const tampered = { ...encrypted, ciphertext: btoa(String.fromCharCode(...bytes)) };
    await expect(decryptRecord(tampered, keys)).rejects.toThrow();
  });

  it("fails to decrypt when the collection is moved (AAD mismatch)", async () => {
    const keys = await deriveKeys(generateSyncKey());
    const record = createRecord("playlists", "id-1", { title: "Mix" }, 7);
    const encrypted = await encryptRecord(record, keys);
    // Attacker tries to relabel the record as a settings entry.
    const moved = { ...encrypted, collection: "settings" };
    await expect(decryptRecord(moved, keys)).rejects.toThrow();
  });

  it("fails to decrypt when the id is moved (AAD mismatch)", async () => {
    const keys = await deriveKeys(generateSyncKey());
    const record = createRecord("playlists", "id-1", { title: "Mix" }, 7);
    const encrypted = await encryptRecord(record, keys);
    const moved = { ...encrypted, id: "id-2" };
    await expect(decryptRecord(moved, keys)).rejects.toThrow();
  });

  it("createTombstone marks the record deleted", () => {
    const t = createTombstone("history", "v-1", 99);
    expect(t.deleted).toBe(true);
    expect(t.data).toBeNull();
    expect(isTombstone(t)).toBe(true);
    const r = createRecord("history", "v-2", { x: 1 });
    expect(isTombstone(r)).toBe(false);
  });

  it("uses a fresh nonce for each encryption (no nonce reuse)", async () => {
    const keys = await deriveKeys(generateSyncKey());
    const record = createRecord("playlists", "id-1", { title: "Mix" }, 7);
    const a = await encryptRecord(record, keys);
    const b = await encryptRecord(record, keys);
    expect(a.nonce).not.toBe(b.nonce);
  });
});
