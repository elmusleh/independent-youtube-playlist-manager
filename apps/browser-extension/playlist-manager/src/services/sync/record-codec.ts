/**
 * Record codec for Sync v2.
 *
 * Each sync record is an encrypted envelope:
 *   {
 *     v: 2,                    // format version
 *     collection: "playlists", // collection name
 *     id: "abcd1234",          // opaque HMAC record id
 *     hlc: 1234567890123,      // hybrid logical clock timestamp
 *     deleted: false,          // tombstone flag
 *     data: { ... }            // plaintext payload (encrypted in transport)
 *   }
 *
 * The envelope itself is NOT encrypted; encryption happens at the transport layer.
 * The AAD (Additional Authenticated Data) for AES-GCM is: `${collection}|${id}`
 * This binds ciphertext to its collection and record id, preventing slot confusion.
 */

import type { DerivedKeys } from "./keys";

/** TypeScript 5.7 narrows `Uint8Array` over `ArrayBufferLike`; WebCrypto expects `BufferSource`. */
function asBufferSource(bytes: Uint8Array<ArrayBufferLike>): BufferSource {
  return bytes as unknown as BufferSource;
}

export type RecordEnvelope<T = unknown> = {
  v: 2;
  collection: string;
  id: string;
  hlc: number; // HLC timestamp
  deleted: boolean;
  data: T;
};

export type EncryptedRecord = {
  v: 2;
  collection: string;
  id: string;
  hlc: number;
  deleted: boolean;
  ciphertext: string; // base64
  nonce: string; // base64
};

/** Current record format version. */
export const RECORD_VERSION = 2;

/**
 * Encode a record envelope to a Uint8Array (JSON + CBOR-like compact form).
 * We use JSON for simplicity and cross-platform compatibility.
 */
export function encodeRecord<T>(record: RecordEnvelope<T>): Uint8Array {
  const json = JSON.stringify(record);
  return new TextEncoder().encode(json);
}

/**
 * Decode a Uint8Array back to a record envelope.
 */
export function decodeRecord<T>(bytes: Uint8Array): RecordEnvelope<T> {
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json);

  // Validate version
  if (parsed.v !== RECORD_VERSION) {
    throw new Error(`Unsupported record version: ${parsed.v}`);
  }

  // Validate required fields
  if (!parsed.collection || !parsed.id || typeof parsed.hlc !== "number") {
    throw new Error("Invalid record envelope: missing required fields");
  }

  return parsed as RecordEnvelope<T>;
}

/**
 * Encrypt a record envelope using AES-256-GCM with AAD binding.
 * AAD = `${collection}|${id}` prevents ciphertext from being moved between records.
 */
export async function encryptRecord(
  record: RecordEnvelope,
  keys: DerivedKeys
): Promise<EncryptedRecord> {
  const plaintext = encodeRecord(record);

  // Generate a fresh 96-bit nonce for each encryption
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));

  // AAD binds the ciphertext to collection + record id
  const aad = new TextEncoder().encode(`${record.collection}|${record.id}`);

  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad },
    keys.encryptionKey,
    plaintext.buffer as ArrayBuffer
  );

  return {
    v: RECORD_VERSION,
    collection: record.collection,
    id: record.id,
    hlc: record.hlc,
    deleted: record.deleted,
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    nonce: bytesToBase64(nonce),
  };
}

/**
 * Decrypt an encrypted record, verifying AAD integrity.
 * Throws if decryption fails (wrong key, tampered data, or AAD mismatch).
 */
export async function decryptRecord(
  encrypted: EncryptedRecord,
  keys: DerivedKeys
): Promise<RecordEnvelope> {
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  const nonce = base64ToBytes(encrypted.nonce);
  const aad = new TextEncoder().encode(`${encrypted.collection}|${encrypted.id}`);

  try {
    const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad },
      keys.encryptionKey,
      ciphertext.buffer as ArrayBuffer
    );
    return decodeRecord(new Uint8Array(plaintextBuffer));
  } catch (e) {
    throw new Error("Record decryption failed: " + (e as Error).message);
  }
}

/**
 * Create a new record envelope with a generated HLC timestamp.
 */
export function createRecord<T>(
  collection: string,
  id: string,
  data: T,
  hlc?: number
): RecordEnvelope<T> {
  return {
    v: RECORD_VERSION,
    collection,
    id,
    hlc: hlc ?? Date.now(), // Will be replaced by HLC in practice
    deleted: false,
    data,
  };
}

/**
 * Create a tombstone record (deletion marker).
 */
export function createTombstone(
  collection: string,
  id: string,
  hlc?: number
): RecordEnvelope<null> {
  return {
    v: RECORD_VERSION,
    collection,
    id,
    hlc: hlc ?? Date.now(),
    deleted: true,
    data: null,
  };
}

/**
 * Check if a record is a tombstone.
 */
export function isTombstone(record: RecordEnvelope): boolean {
  return record.deleted === true;
}

/* -------------------------------------------------------------------------- */
/* Base64 helpers (Uint8Array compatible, no Node Buffer)                     */
/* -------------------------------------------------------------------------- */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
