// packages/sync-crypto/src/record-codec.ts
// Record encryption/decryption with AES-256-GCM and AAD binding
import { RECORD_VERSION } from "./constants.js";
export { RECORD_VERSION } from "./constants.js";
function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
function base64ToBytes(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}
/** Encode a record envelope to Uint8Array (JSON) */
export function encodeRecord(record) {
    const json = JSON.stringify(record);
    return new TextEncoder().encode(json);
}
/** Decode Uint8Array back to record envelope */
export function decodeRecord(bytes) {
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed.v !== RECORD_VERSION) {
        throw new Error(`Unsupported record version: ${parsed.v}`);
    }
    if (!parsed.collection || !parsed.id || typeof parsed.hlc !== "number") {
        throw new Error("Invalid record envelope: missing required fields");
    }
    return parsed;
}
/** Encrypt a record envelope using AES-256-GCM with AAD binding */
export async function encryptRecord(record, keys) {
    const plaintext = encodeRecord(record);
    const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(`${record.collection}|${record.id}`);
    const ciphertext = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, keys.encryptionKey, plaintext);
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
/** Decrypt an encrypted record, verifying AAD integrity */
export async function decryptRecord(encrypted, keys) {
    const ciphertext = base64ToBytes(encrypted.ciphertext);
    const nonce = base64ToBytes(encrypted.nonce);
    const aad = new TextEncoder().encode(`${encrypted.collection}|${encrypted.id}`);
    try {
        const plaintextBuffer = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, keys.encryptionKey, ciphertext);
        return decodeRecord(new Uint8Array(plaintextBuffer));
    }
    catch (e) {
        throw new Error("Record decryption failed: " + e.message);
    }
}
/** Create a new record envelope */
export function createRecord(collection, id, data, hlc) {
    return {
        v: RECORD_VERSION,
        collection,
        id,
        hlc: hlc ?? Date.now(),
        deleted: false,
        data,
    };
}
/** Create a tombstone record (deletion marker) */
export function createTombstone(collection, id, hlc) {
    return {
        v: RECORD_VERSION,
        collection,
        id,
        hlc: hlc ?? Date.now(),
        deleted: true,
        data: null,
    };
}
/** Check if a record is a tombstone */
export function isTombstone(record) {
    return record.deleted === true;
}
