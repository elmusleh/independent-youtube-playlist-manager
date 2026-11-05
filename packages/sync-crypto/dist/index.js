// packages/sync-crypto/src/index.ts
// Barrel export for the shared sync crypto package
// Key derivation & management
export { deriveKeys, deriveEncryptionKeyOnly, deriveRecordIdKey, deriveAuthTokenKey, computeRecordId, computeAuthToken, computeStorageAddress, generateKeyFingerprint, generateSyncKey, normalizeSyncKey, formatSyncKey, isValidSyncKey, assertValidSyncKey, InvalidSyncKeyError, } from "./keys.js";
// Encryption (record-level)
export { encodeRecord, decodeRecord, encryptRecord, decryptRecord, createRecord, createTombstone, isTombstone, RECORD_VERSION, } from "./record-codec.js";
// Snapshot codec
export { createSnapshot, encodeSnapshot, decodeSnapshot, isNewerRevision, SyncSnapshotError, SNAPSHOT_SCHEMA_VERSION, } from "./snapshot-codec.js";
// Hybrid Logical Clock
export { getHlc, compareHlc, isNewer, receiveHlc, hlcToString, parseHlc } from "./hlc.js";
// Constants
export { ENCRYPTION_KEY_BYTES, RECORD_ID_KEY_BYTES, AUTH_TOKEN_KEY_BYTES, PBKDF2_ITERATIONS, } from "./constants.js";
// Fingerprint pools
export { EMOJI_POOL, WORD_POOL } from "./fingerprint-pools.js";
