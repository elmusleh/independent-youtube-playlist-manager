/**
 * Key derivation for encrypted sync: one secret in, two independent values out.
 *
 * - **Encryption key** — `PBKDF2-SHA256(sync key)` stretched into an AES-256-GCM key.
 * - **Storage address** — a domain-separated `SHA-256` of the sync key, used as the object
 *   path/name on every backend. It is one-way, so a backend learns nothing but the path,
 *   and two devices with the same key resolve the same location without any account.
 *
 * The PBKDF2 salt is a fixed, public application constant. That is deliberate: there is
 * nowhere to store a per-user salt without an account, and the sync key already carries
 * 100 bits of entropy, so the salt is not what protects the data — the key is. Iteration
 * count is the knob that raises the cost of guessing a *mistyped or weak* key.
 */

import { assertValidSyncKey } from "./sync-key";

/** OWASP 2024 guidance for PBKDF2-SHA256. */
export const PBKDF2_ITERATIONS = 600_000;

const PBKDF2_SALT = "iypm-sync-v1:pbkdf2";
const ADDRESS_DOMAIN = "iypm-sync-address-v1:";

const encoder = new TextEncoder();

export type DerivationOptions = {
  subtle?: SubtleCrypto;
  /** Override for tests; production callers use the default. */
  iterations?: number;
};

function resolve(options: DerivationOptions) {
  return {
    subtle: options.subtle ?? globalThis.crypto.subtle,
    iterations: options.iterations ?? PBKDF2_ITERATIONS,
  };
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Derive the AES-256-GCM key the encryption service consumes. */
export async function deriveEncryptionKey(
  syncKey: string,
  options: DerivationOptions = {}
): Promise<CryptoKey> {
  const normalized = assertValidSyncKey(syncKey);
  const { subtle, iterations } = resolve(options);

  const material = await subtle.importKey("raw", encoder.encode(normalized), "PBKDF2", false, [
    "deriveKey",
  ]);

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(PBKDF2_SALT),
      iterations,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Derive the backend-visible storage address (64 lowercase hex characters). */
export async function deriveStorageAddress(
  syncKey: string,
  options: DerivationOptions = {}
): Promise<string> {
  const normalized = assertValidSyncKey(syncKey);
  const { subtle } = resolve(options);
  const digest = await subtle.digest("SHA-256", encoder.encode(ADDRESS_DOMAIN + normalized));
  return toHex(new Uint8Array(digest));
}
