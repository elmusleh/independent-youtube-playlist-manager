import { describe, expect, it } from "vitest";
import { PBKDF2_ITERATIONS, deriveEncryptionKey, deriveStorageAddress } from "./key-derivation";

// PBKDF2 at the production iteration count is deliberately slow; most tests use a fast
// override and one test pins the production default.
const fast = { iterations: 1_000 };
const KEY_A = "ABCDE-FGHJK-MNPQR-STVWX";
const KEY_B = "ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ";

describe("key derivation", () => {
  it("derives the same address for the same key, ignoring formatting", async () => {
    const first = await deriveStorageAddress(KEY_A, fast);
    const second = await deriveStorageAddress("abcde fghjk mnpqr stvwx", fast);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("derives different addresses for different keys", async () => {
    expect(await deriveStorageAddress(KEY_A, fast)).not.toBe(
      await deriveStorageAddress(KEY_B, fast)
    );
  });

  it("derives different encryption keys for different sync keys", async () => {
    const keyA = await deriveEncryptionKey(KEY_A, fast);
    const keyB = await deriveEncryptionKey(KEY_B, fast);

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode("secret");
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      keyA,
      plaintext
    );

    await expect(
      globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyB, ciphertext)
    ).rejects.toThrow();
  });

  it("produces a non-extractable AES-GCM key of 256 bits", async () => {
    const key = await deriveEncryptionKey(KEY_A, fast);
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    expect(key.usages.sort()).toEqual(["decrypt", "encrypt"]);
  });

  it("rejects a malformed sync key before doing any work", async () => {
    await expect(deriveStorageAddress("too-short")).rejects.toThrow(/20 characters/);
    await expect(deriveEncryptionKey("too-short")).rejects.toThrow(/20 characters/);
  });

  it("keeps the production iteration count at OWASP guidance", () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it("is deterministic across calls at the production iteration count", async () => {
    const [first, second] = await Promise.all([
      deriveStorageAddress(KEY_A, { iterations: 2_000 }),
      deriveStorageAddress(KEY_A, { iterations: 2_000 }),
    ]);
    expect(first).toBe(second);
  });
});
