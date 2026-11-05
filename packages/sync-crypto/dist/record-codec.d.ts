import type { DerivedKeys, RecordEnvelope, EncryptedRecord } from "./types.js";
export { RECORD_VERSION } from "./constants.js";
/** Encode a record envelope to Uint8Array (JSON) */
export declare function encodeRecord<T>(record: RecordEnvelope<T>): Uint8Array;
/** Decode Uint8Array back to record envelope */
export declare function decodeRecord<T>(bytes: Uint8Array): RecordEnvelope<T>;
/** Encrypt a record envelope using AES-256-GCM with AAD binding */
export declare function encryptRecord(record: RecordEnvelope, keys: DerivedKeys): Promise<EncryptedRecord>;
/** Decrypt an encrypted record, verifying AAD integrity */
export declare function decryptRecord(encrypted: EncryptedRecord, keys: DerivedKeys): Promise<RecordEnvelope>;
/** Create a new record envelope */
export declare function createRecord<T>(collection: string, id: string, data: T, hlc?: number): RecordEnvelope<T>;
/** Create a tombstone record (deletion marker) */
export declare function createTombstone(collection: string, id: string, hlc?: number): RecordEnvelope<null>;
/** Check if a record is a tombstone */
export declare function isTombstone(record: RecordEnvelope): boolean;
//# sourceMappingURL=record-codec.d.ts.map