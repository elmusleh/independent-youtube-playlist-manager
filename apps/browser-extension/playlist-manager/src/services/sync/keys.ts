/**
 * Key derivation for Sync v2.
 *
 * The user's 20-symbol Crockford base32 sync key (100 bits entropy) is the ONLY secret.
 * From it we derive three independent keys via HKDF-SHA256:
 *   - encryption key (AES-256-GCM for record payloads)
 *   - record id key (HMAC for opaque record identifiers)
 *   - auth token key (HMAC for relay write authorization)
 */

import { normalizeSyncKey } from "./sync-key";
import { generateKeyFingerprint, type KeyFingerprint } from "./fingerprint";

/** Public application constant for HKDF info string. */
const HKDF_INFO_ENCRYPTION = "iypm-sync-v2:encryption";
const HKDF_INFO_RECORD_ID = "iypm-sync-v2:record-id";
const HKDF_INFO_AUTH_TOKEN = "iypm-sync-v2:auth-token";

/** Salt is fixed and public; the sync key itself carries 100 bits of entropy. */
const HKDF_SALT = "iypm-sync-v2:salt";

const encoder = new TextEncoder();

/** Lengths for derived keys (bytes). */
export const ENCRYPTION_KEY_BYTES = 32; // AES-256
export const RECORD_ID_KEY_BYTES = 32; // HMAC-SHA256
export const AUTH_TOKEN_KEY_BYTES = 32; // HMAC-SHA256

export type DerivedKeys = {
  encryptionKey: CryptoKey;
  recordIdKey: CryptoKey;
  authTokenKey: CryptoKey;
};

/**
 * Derive the three independent keys from the user's sync key using HKDF-SHA256.
 * Uses the fixed salt + domain-separated info strings for separation.
 */
export async function deriveKeys(
  syncKey: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<DerivedKeys> {
  const normalized = normalizeSyncKey(syncKey);
  const baseKey = await subtle.importKey("raw", encoder.encode(normalized), "HKDF", false, [
    "deriveBits",
  ]);

  const [encBits, idBits, authBits] = await Promise.all([
    subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode(HKDF_SALT),
        info: encoder.encode(HKDF_INFO_ENCRYPTION),
      },
      baseKey,
      ENCRYPTION_KEY_BYTES * 8
    ),
    subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode(HKDF_SALT),
        info: encoder.encode(HKDF_INFO_RECORD_ID),
      },
      baseKey,
      RECORD_ID_KEY_BYTES * 8
    ),
    subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode(HKDF_SALT),
        info: encoder.encode(HKDF_INFO_AUTH_TOKEN),
      },
      baseKey,
      AUTH_TOKEN_KEY_BYTES * 8
    ),
  ]);

  const [encryptionKey, recordIdKey, authTokenKey] = await Promise.all([
    subtle.importKey("raw", encBits, "AES-GCM", false, ["encrypt", "decrypt"]),
    subtle.importKey("raw", idBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]),
    subtle.importKey("raw", authBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]),
  ]);

  return { encryptionKey, recordIdKey, authTokenKey };
}

/** Derive only the encryption key (for backward compatibility with key-derivation.ts). */
export async function deriveEncryptionKeyOnly(
  syncKey: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<CryptoKey> {
  const { encryptionKey } = await deriveKeys(syncKey, subtle);
  return encryptionKey;
}

/** Derive only the record id key (HMAC key for opaque record identifiers). */
export async function deriveRecordIdKey(
  syncKey: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<CryptoKey> {
  const { recordIdKey } = await deriveKeys(syncKey, subtle);
  return recordIdKey;
}

/** Derive only the auth token key (HMAC key for relay authorization). */
export async function deriveAuthTokenKey(
  syncKey: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<CryptoKey> {
  const { authTokenKey } = await deriveKeys(syncKey, subtle);
  return authTokenKey;
}

/**
 * Compute an opaque record identifier from a plaintext collection + user id.
 * Uses HMAC-SHA256 with the record-id key so the server sees no playlist ids.
 */
export async function computeRecordId(
  syncKey: string,
  collection: string,
  plainId: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<string> {
  const recordIdKey = await deriveRecordIdKey(syncKey, subtle);
  const data = encoder.encode(`${collection}|${plainId}`);
  const sig = await subtle.sign("HMAC", recordIdKey, data);
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32); // 128 bits = 32 hex chars
}

/**
 * Compute the auth token for a relay write.
 * The server stores the hash of this token when the space is first claimed.
 */
export async function computeAuthToken(
  syncKey: string,
  space: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<string> {
  const authTokenKey = await deriveAuthTokenKey(syncKey, subtle);
  const data = encoder.encode(`${space}|auth`);
  const sig = await subtle.sign("HMAC", authTokenKey, data);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute the storage address (space identifier) from the sync key.
 * This is a one-way SHA-256 of the normalized key with a domain separator.
 * Two devices with the same key resolve the same address without any account.
 */
export async function computeStorageAddress(
  syncKey: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<string> {
  const normalized = normalizeSyncKey(syncKey);
  const digest = await subtle.digest(
    "SHA-256",
    encoder.encode(`iypm-sync-address-v2:${normalized}`)
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a human-friendly key fingerprint for verification.
 * Re-exported from fingerprint.ts for convenience.
 */
export { generateKeyFingerprint, type KeyFingerprint } from "./fingerprint";
