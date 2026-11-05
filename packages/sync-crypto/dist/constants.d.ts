/** AES-256 key size in bytes */
export declare const ENCRYPTION_KEY_BYTES = 32;
/** HMAC-SHA256 key size in bytes */
export declare const RECORD_ID_KEY_BYTES = 32;
/** HMAC-SHA256 key size in bytes */
export declare const AUTH_TOKEN_KEY_BYTES = 32;
/** PBKDF2 iterations for legacy key derivation (OWASP 2024 guidance) */
export declare const PBKDF2_ITERATIONS = 600000;
/** Current record format version */
export declare const RECORD_VERSION = 2;
/** Current snapshot schema version */
export declare const SNAPSHOT_SCHEMA_VERSION = 1;
/** Sync key format: 20 Crockford base32 symbols in 4 groups of 5 */
export declare const SYNC_KEY_SYMBOLS = 20;
export declare const SYNC_KEY_GROUPS = 4;
/** HLC counter bit width */
export declare const HLC_COUNTER_BITS = 16;
export declare const HLC_MAX_COUNTER: number;
/** HKDF domain separation strings */
export declare const HKDF_INFO_ENCRYPTION = "iypm-sync-v2:encryption";
export declare const HKDF_INFO_RECORD_ID = "iypm-sync-v2:record-id";
export declare const HKDF_INFO_AUTH_TOKEN = "iypm-sync-v2:auth-token";
export declare const HKDF_SALT = "iypm-sync-v2:salt";
/** Legacy PBKDF2 constants */
export declare const PBKDF2_SALT = "iypm-sync-v1:pbkdf2";
export declare const ADDRESS_DOMAIN = "iypm-sync-address-v1:";
/** Fingerprint domain separator */
export declare const FINGERPRINT_DOMAIN = "iypm-sync-fingerprint:";
/** Storage address domain */
export declare const STORAGE_ADDRESS_DOMAIN = "iypm-sync-address-v2:";
//# sourceMappingURL=constants.d.ts.map