import type { DerivedKeys, KeyFingerprint } from "./types.js";
/** Thrown when a string cannot be a sync key */
export declare class InvalidSyncKeyError extends Error {
    constructor(reason: string);
}
/** Generate a fresh sync key formatted for the user */
export declare function generateSyncKey(): string;
/** Canonicalize user input: uppercase, drop separators, apply Crockford glyph map */
export declare function normalizeSyncKey(input: string): string;
/** Format as `ABCDE-FGHJK-MNPQR-STVWX` */
export declare function formatSyncKey(input: string): string;
/** Validate a sync key (separators and case ignored) */
export declare function isValidSyncKey(input: string): boolean;
/** Throw unless input is a usable key */
export declare function assertValidSyncKey(input: string): string;
/** Derive the three independent keys from the sync key using HKDF-SHA256 */
export declare function deriveKeys(syncKey: string, subtle?: SubtleCrypto): Promise<DerivedKeys>;
/** Derive only the encryption key */
export declare function deriveEncryptionKeyOnly(syncKey: string, subtle?: SubtleCrypto): Promise<CryptoKey>;
/** Derive only the record id key */
export declare function deriveRecordIdKey(syncKey: string, subtle?: SubtleCrypto): Promise<CryptoKey>;
/** Derive only the auth token key */
export declare function deriveAuthTokenKey(syncKey: string, subtle?: SubtleCrypto): Promise<CryptoKey>;
/** Compute an opaque record identifier from collection + plain id */
export declare function computeRecordId(syncKey: string, collection: string, plainId: string, subtle?: SubtleCrypto): Promise<string>;
/** Compute the auth token for a relay write */
export declare function computeAuthToken(syncKey: string, space: string, subtle?: SubtleCrypto): Promise<string>;
/** Compute the storage address (space identifier) from the sync key */
export declare function computeStorageAddress(syncKey: string, subtle?: SubtleCrypto): Promise<string>;
/** Generate a human-friendly key fingerprint (4 emoji + 4 words) */
export declare function generateKeyFingerprint(syncKey: string, subtle?: SubtleCrypto): Promise<KeyFingerprint>;
/** Generate a fingerprint from pre-derived keys (for backward compatibility) */
export declare function generateKeyFingerprintFromKeys(keys: DerivedKeys, subtle?: SubtleCrypto): Promise<KeyFingerprint>;
//# sourceMappingURL=keys.d.ts.map