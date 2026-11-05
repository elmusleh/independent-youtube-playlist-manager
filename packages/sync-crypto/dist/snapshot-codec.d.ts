import type { SyncSnapshot, SnapshotInput } from "./types.js";
export { SNAPSHOT_SCHEMA_VERSION } from "./constants.js";
/** Thrown when a stored snapshot cannot be trusted */
export declare class SyncSnapshotError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
export declare function createSnapshot(input: SnapshotInput): SyncSnapshot;
/** Serialize for encryption */
export declare function encodeSnapshot(snapshot: SyncSnapshot): Uint8Array;
/** Parse and validate a decrypted snapshot */
export declare function decodeSnapshot(bytes: Uint8Array): SyncSnapshot;
/** True when `remote` should replace `local` (strictly newer wins; ties keep local) */
export declare function isNewerRevision(remoteRevision: number | null, localRevision: number): boolean;
//# sourceMappingURL=snapshot-codec.d.ts.map