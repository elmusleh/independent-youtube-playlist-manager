import { beforeAll, describe, expect, it } from "vitest";
import { deriveEncryptionKey } from "./key-derivation";
import {
  SyncDecryptionError,
  decryptSnapshot,
  encryptSnapshot,
  isEncryptedSnapshot,
} from "./encryption-service";

const KEY = "ABCDE-FGHJK-MNPQR-STVWX";
const OTHER_KEY = "ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

let key: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  key = await deriveEncryptionKey(KEY, { iterations: 1_000 });
  otherKey = await deriveEncryptionKey(OTHER_KEY, { iterations: 1_000 });
});

describe("snapshot encryption", () => {
  it("round-trips arbitrary JSON payloads", async () => {
    const payload = encoder.encode(JSON.stringify({ playlists: [{ id: "local-1", videos: [] }] }));
    const packed = await encryptSnapshot(key, payload);
    expect(decoder.decode(await decryptSnapshot(key, packed))).toBe(decoder.decode(payload));
  });

  it("round-trips an empty payload", async () => {
    const packed = await encryptSnapshot(key, new Uint8Array(0));
    expect((await decryptSnapshot(key, packed)).length).toBe(0);
  });

  it("stores no plaintext bytes", async () => {
    const plaintext = encoder.encode("VERY-DISTINCTIVE-MARKER-STRING");
    const packed = await encryptSnapshot(key, plaintext);
    const haystack = decoder.decode(packed);
    expect(haystack).not.toContain("VERY-DISTINCTIVE-MARKER-STRING");
  });

  it("is non-deterministic: the same payload encrypts differently each time", async () => {
    const payload = encoder.encode("same");
    const first = await encryptSnapshot(key, payload);
    const second = await encryptSnapshot(key, payload);
    expect(bytesEqual(first, second)).toBe(false);
  });

  it("fails with the wrong key instead of returning garbage", async () => {
    const packed = await encryptSnapshot(key, encoder.encode("secret"));
    await expect(decryptSnapshot(otherKey, packed)).rejects.toThrow(SyncDecryptionError);
    await expect(decryptSnapshot(otherKey, packed)).rejects.toThrow(/sync key/);
  });

  it("detects a single flipped ciphertext byte", async () => {
    const packed = await encryptSnapshot(key, encoder.encode("tamper me"));
    const tampered = packed.slice();
    tampered[tampered.length - 1] ^= 0x01;
    await expect(decryptSnapshot(key, tampered)).rejects.toThrow(/damaged|sync key/);
  });

  it("detects a flipped IV byte", async () => {
    const packed = await encryptSnapshot(key, encoder.encode("tamper me"));
    const tampered = packed.slice();
    tampered[6] ^= 0x01; // first IV byte
    await expect(decryptSnapshot(key, tampered)).rejects.toThrow(SyncDecryptionError);
  });

  it("rejects truncated containers and foreign files", async () => {
    const packed = await encryptSnapshot(key, encoder.encode("short"));
    await expect(decryptSnapshot(key, packed.slice(0, packed.length - 20))).rejects.toThrow(
      SyncDecryptionError
    );
    await expect(decryptSnapshot(key, encoder.encode('{"playlists":[]}'))).rejects.toThrow(
      /Not an IYPM sync snapshot/
    );
  });

  it("advertises its own format", async () => {
    const packed = await encryptSnapshot(key, encoder.encode("x"));
    expect(isEncryptedSnapshot(packed)).toBe(true);
    expect(isEncryptedSnapshot(new Uint8Array([0x49, 0x59]))).toBe(false);
  });

  it("uses a random 12-byte IV per encryption", async () => {
    const ivs = new Set<string>();
    for (let run = 0; run < 10; run += 1) {
      const packed = await encryptSnapshot(key, encoder.encode("x"));
      ivs.add(hex(packed.slice(5, 17)));
    }
    expect(ivs.size).toBe(10);
  });
});
