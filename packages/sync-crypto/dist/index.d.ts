export type { DerivedKeys, RecordEnvelope, EncryptedRecord, SyncSnapshot, SnapshotInput, HlcTimestamp, KeyFingerprint, } from "./types.js";
export { deriveKeys, deriveEncryptionKeyOnly, deriveRecordIdKey, deriveAuthTokenKey, computeRecordId, computeAuthToken, computeStorageAddress, generateKeyFingerprint, generateSyncKey, normalizeSyncKey, formatSyncKey, isValidSyncKey, assertValidSyncKey, InvalidSyncKeyError, } from "./keys.js";
export { encodeRecord, decodeRecord, encryptRecord, decryptRecord, createRecord, createTombstone, isTombstone, RECORD_VERSION, } from "./record-codec.js";
export { createSnapshot, encodeSnapshot, decodeSnapshot, isNewerRevision, SyncSnapshotError, SNAPSHOT_SCHEMA_VERSION, } from "./snapshot-codec.js";
export { getHlc, compareHlc, isNewer, receiveHlc, hlcToString, parseHlc } from "./hlc.js";
export { ENCRYPTION_KEY_BYTES, RECORD_ID_KEY_BYTES, AUTH_TOKEN_KEY_BYTES, PBKDF2_ITERATIONS, } from "./constants.js";
export { EMOJI_POOL, WORD_POOL } from "./fingerprint-pools.js";
export { countGraphemes, splitGraphemes } from "./utils.js";
//# sourceMappingURL=index.d.ts.map