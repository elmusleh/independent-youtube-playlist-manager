// packages/sync-crypto/src/constants.ts
// Public constants for the sync protocol

/** AES-256 key size in bytes */
export const ENCRYPTION_KEY_BYTES = 32;

/** HMAC-SHA256 key size in bytes */
export const RECORD_ID_KEY_BYTES = 32;

/** HMAC-SHA256 key size in bytes */
export const AUTH_TOKEN_KEY_BYTES = 32;

/** PBKDF2 iterations for legacy key derivation (OWASP 2024 guidance) */
export const PBKDF2_ITERATIONS = 600_000;

/** Current record format version */
export const RECORD_VERSION = 2;

/** Current snapshot schema version */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Sync key format: 20 Crockford base32 symbols in 4 groups of 5 */
export const SYNC_KEY_SYMBOLS = 20;
export const SYNC_KEY_GROUPS = 4;

/** HLC counter bit width */
export const HLC_COUNTER_BITS = 16;
export const HLC_MAX_COUNTER = (1 << HLC_COUNTER_BITS) - 1;

/** HKDF domain separation strings */
export const HKDF_INFO_ENCRYPTION = "iypm-sync-v2:encryption";
export const HKDF_INFO_RECORD_ID = "iypm-sync-v2:record-id";
export const HKDF_INFO_AUTH_TOKEN = "iypm-sync-v2:auth-token";
export const HKDF_SALT = "iypm-sync-v2:salt";

/** Legacy PBKDF2 constants */
export const PBKDF2_SALT = "iypm-sync-v1:pbkdf2";
export const ADDRESS_DOMAIN = "iypm-sync-address-v1:";

/** Fingerprint domain separator */
export const FINGERPRINT_DOMAIN = "iypm-sync-fingerprint:";

/** Storage address domain */
export const STORAGE_ADDRESS_DOMAIN = "iypm-sync-address-v2:";
