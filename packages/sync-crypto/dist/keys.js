// packages/sync-crypto/src/keys.ts
// Key derivation, sync key management, and identity functions
import { ENCRYPTION_KEY_BYTES, RECORD_ID_KEY_BYTES, AUTH_TOKEN_KEY_BYTES, HKDF_INFO_ENCRYPTION, HKDF_INFO_RECORD_ID, HKDF_INFO_AUTH_TOKEN, HKDF_SALT, SYNC_KEY_SYMBOLS, FINGERPRINT_DOMAIN, STORAGE_ADDRESS_DOMAIN, } from "./constants.js";
import { EMOJI_POOL, WORD_POOL } from "./fingerprint-pools.js";
/** Crockford base32 alphabet (no I, L, O, U) */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUP = 5;
const SYMBOL_COUNT = ALPHABET.length;
const encoder = new TextEncoder();
/** Thrown when a string cannot be a sync key */
export class InvalidSyncKeyError extends Error {
    constructor(reason) {
        super(reason);
        this.name = "InvalidSyncKeyError";
    }
}
function randomByte() {
    const buffer = new Uint8Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0];
}
function randomIndex() {
    return randomByte() % SYMBOL_COUNT;
}
/** Generate a fresh sync key formatted for the user */
export function generateSyncKey() {
    let symbols = "";
    for (let index = 0; index < SYNC_KEY_SYMBOLS; index += 1)
        symbols += ALPHABET[randomIndex()];
    return formatSyncKey(symbols);
}
/** Canonicalize user input: uppercase, drop separators, apply Crockford glyph map */
export function normalizeSyncKey(input) {
    return String(input ?? "")
        .toUpperCase()
        .replace(/O/g, "0")
        .replace(/[IL]/g, "1")
        .replace(/[^0-9A-Z]/g, "");
}
/** Format as `ABCDE-FGHJK-MNPQR-STVWX` */
export function formatSyncKey(input) {
    const normalized = normalizeSyncKey(input);
    const groups = [];
    for (let index = 0; index < normalized.length; index += GROUP) {
        groups.push(normalized.slice(index, index + GROUP));
    }
    return groups.join("-");
}
/** Validate a sync key (separators and case ignored) */
export function isValidSyncKey(input) {
    const normalized = normalizeSyncKey(input);
    if (normalized.length !== SYNC_KEY_SYMBOLS)
        return false;
    return [...normalized].every((symbol) => ALPHABET.includes(symbol));
}
/** Throw unless input is a usable key */
export function assertValidSyncKey(input) {
    if (!isValidSyncKey(input)) {
        throw new InvalidSyncKeyError(`A sync key is ${SYNC_KEY_SYMBOLS} characters, for example ${formatSyncKey("0".repeat(SYNC_KEY_SYMBOLS))}`);
    }
    return normalizeSyncKey(input);
}
/** Derive the three independent keys from the sync key using HKDF-SHA256 */
export async function deriveKeys(syncKey, subtle = globalThis.crypto.subtle) {
    const normalized = assertValidSyncKey(syncKey);
    const baseKey = await subtle.importKey("raw", encoder.encode(normalized), "HKDF", false, [
        "deriveBits",
    ]);
    const [encBits, idBits, authBits] = await Promise.all([
        subtle.deriveBits({
            name: "HKDF",
            hash: "SHA-256",
            salt: encoder.encode(HKDF_SALT),
            info: encoder.encode(HKDF_INFO_ENCRYPTION),
        }, baseKey, ENCRYPTION_KEY_BYTES * 8),
        subtle.deriveBits({
            name: "HKDF",
            hash: "SHA-256",
            salt: encoder.encode(HKDF_SALT),
            info: encoder.encode(HKDF_INFO_RECORD_ID),
        }, baseKey, RECORD_ID_KEY_BYTES * 8),
        subtle.deriveBits({
            name: "HKDF",
            hash: "SHA-256",
            salt: encoder.encode(HKDF_SALT),
            info: encoder.encode(HKDF_INFO_AUTH_TOKEN),
        }, baseKey, AUTH_TOKEN_KEY_BYTES * 8),
    ]);
    const [encryptionKey, recordIdKey, authTokenKey] = await Promise.all([
        subtle.importKey("raw", encBits, "AES-GCM", false, ["encrypt", "decrypt"]),
        subtle.importKey("raw", idBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]),
        subtle.importKey("raw", authBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]),
    ]);
    return { encryptionKey, recordIdKey, authTokenKey };
}
/** Derive only the encryption key */
export async function deriveEncryptionKeyOnly(syncKey, subtle = globalThis.crypto.subtle) {
    const { encryptionKey } = await deriveKeys(syncKey, subtle);
    return encryptionKey;
}
/** Derive only the record id key */
export async function deriveRecordIdKey(syncKey, subtle = globalThis.crypto.subtle) {
    const { recordIdKey } = await deriveKeys(syncKey, subtle);
    return recordIdKey;
}
/** Derive only the auth token key */
export async function deriveAuthTokenKey(syncKey, subtle = globalThis.crypto.subtle) {
    const { authTokenKey } = await deriveKeys(syncKey, subtle);
    return authTokenKey;
}
/** Compute an opaque record identifier from collection + plain id */
export async function computeRecordId(syncKey, collection, plainId, subtle = globalThis.crypto.subtle) {
    const recordIdKey = await deriveRecordIdKey(syncKey, subtle);
    const data = encoder.encode(`${collection}|${plainId}`);
    const sig = await subtle.sign("HMAC", recordIdKey, data);
    return [...new Uint8Array(sig)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
}
/** Compute the auth token for a relay write */
export async function computeAuthToken(syncKey, space, subtle = globalThis.crypto.subtle) {
    const authTokenKey = await deriveAuthTokenKey(syncKey, subtle);
    const data = encoder.encode(`${space}|auth`);
    const sig = await subtle.sign("HMAC", authTokenKey, data);
    const hmac = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const digest = await subtle.digest("SHA-256", encoder.encode(hmac));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Compute the storage address (space identifier) from the sync key */
export async function computeStorageAddress(syncKey, subtle = globalThis.crypto.subtle) {
    const normalized = assertValidSyncKey(syncKey);
    const digest = await subtle.digest("SHA-256", encoder.encode(`${STORAGE_ADDRESS_DOMAIN}${normalized}`));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Generate a human-friendly key fingerprint (4 emoji + 4 words) */
export async function generateKeyFingerprint(syncKey, subtle = globalThis.crypto.subtle) {
    const normalized = normalizeSyncKey(syncKey);
    const digest = await subtle.digest("SHA-256", encoder.encode(`${FINGERPRINT_DOMAIN}${normalized}`));
    const bytes = new Uint8Array(digest);
    const emoji = Array.from(bytes.slice(0, 4))
        .map((b) => EMOJI_POOL[b % EMOJI_POOL.length])
        .join("");
    const words = Array.from(bytes.slice(4, 8))
        .map((b) => WORD_POOL[b % WORD_POOL.length])
        .join("-");
    return { emoji, words };
}
/** Generate a fingerprint from pre-derived keys (for backward compatibility) */
export async function generateKeyFingerprintFromKeys(keys, subtle = globalThis.crypto.subtle) {
    // This is a convenience function; normally we'd hash the sync key directly
    // but if we only have derived keys, we can use the auth token key
    const data = encoder.encode("fingerprint");
    const sig = await subtle.sign("HMAC", keys.authTokenKey, data);
    const bytes = new Uint8Array(sig);
    const emoji = Array.from(bytes.slice(0, 4))
        .map((b) => EMOJI_POOL[b % EMOJI_POOL.length])
        .join("");
    const words = Array.from(bytes.slice(4, 8))
        .map((b) => WORD_POOL[b % WORD_POOL.length])
        .join("-");
    return { emoji, words };
}
