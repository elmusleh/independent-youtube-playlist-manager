// packages/sync-crypto/src/types.ts
// Shared type definitions for the sync crypto package

/** Three independent keys derived from the sync key via HKDF-SHA256 */
export type DerivedKeys = {
  /** AES-256-GCM key for record payload encryption */
  encryptionKey: CryptoKey;
  /** HMAC-SHA256 key for opaque record identifiers */
  recordIdKey: CryptoKey;
  /** HMAC-SHA256 key for relay write authorization */
  authTokenKey: CryptoKey;
};

/** A sync record envelope (plaintext, before transport encryption) */
export type RecordEnvelope<T = unknown> = {
  /** Format version (currently 2) */
  v: 2;
  /** Collection name: "playlists" | "history" | "settings" | "devices" */
  collection: string;
  /** Opaque HMAC-based record identifier */
  id: string;
  /** Hybrid Logical Clock timestamp */
  hlc: number;
  /** Tombstone flag for soft deletes */
  deleted: boolean;
  /** Plaintext payload */
  data: T;
};

/** An encrypted record for transport/storage */
export type EncryptedRecord = {
  /** Format version */
  v: 2;
  /** Collection name */
  collection: string;
  /** Opaque record identifier */
  id: string;
  /** HLC timestamp */
  hlc: number;
  /** Tombstone flag */
  deleted: boolean;
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded 96-bit nonce */
  nonce: string;
};

/** A decoded sync snapshot (what gets encrypted and stored) */
export type SyncSnapshot = {
  /** Schema version of the snapshot envelope */
  schemaVersion: number;
  /** Monotonic per storage address; the only conflict signal */
  revision: number;
  /** Pseudonymous writer id */
  deviceId: string;
  /** ISO-8601 timestamp, informational only */
  updatedAt: string;
  /** Arbitrary payload object */
  payload: Record<string, unknown>;
};

/** Input for creating a new snapshot */
export type SnapshotInput = {
  /** Monotonic revision number */
  revision: number;
  /** Pseudonymous device identifier */
  deviceId: string;
  /** Payload object to sync */
  payload: Record<string, unknown>;
  /** Optional timestamp (defaults to now) */
  updatedAt?: string;
};

/** Hybrid Logical Clock timestamp */
export type HlcTimestamp = {
  /** Combined value for easy comparison */
  value: number;
  /** Wall clock time */
  wall: number;
  /** Counter for same-millisecond ordering */
  counter: number;
  /** Device hash for total ordering */
  deviceHash: number;
};

/** Human-friendly key fingerprint for verification */
export type KeyFingerprint = {
  /** 4 emoji characters */
  emoji: string;
  /** 4 words separated by hyphens */
  words: string;
};
