// packages/sync-crypto/src/snapshot-codec.ts
// Snapshot envelope: what a synced state *is*, independent of how it is stored

import type { SyncSnapshot, SnapshotInput } from "./types.js";
import { SNAPSHOT_SCHEMA_VERSION } from "./constants.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Thrown when a stored snapshot cannot be trusted */
export class SyncSnapshotError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SyncSnapshotError";
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export function createSnapshot(input: SnapshotInput): SyncSnapshot {
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new SyncSnapshotError("A snapshot revision must be a non-negative integer.");
  }
  if (!input.deviceId) throw new SyncSnapshotError("A snapshot needs a device id.");
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new SyncSnapshotError("A snapshot payload must be an object.");
  }
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    revision: input.revision,
    deviceId: input.deviceId,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    payload: input.payload,
  };
}

/** Serialize for encryption */
export function encodeSnapshot(snapshot: SyncSnapshot): Uint8Array {
  return encoder.encode(JSON.stringify(snapshot));
}

/** Parse and validate a decrypted snapshot */
export function decodeSnapshot(bytes: Uint8Array): SyncSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(bytes));
  } catch (error) {
    throw new SyncSnapshotError("The sync snapshot is not valid JSON.", { cause: error });
  }
  return validateSnapshot(parsed);
}

function migrateSnapshot(candidate: SyncSnapshot, fromVersion: number): SyncSnapshot {
  let current: SyncSnapshot = { ...candidate };
  // Future migrations go here when SNAPSHOT_SCHEMA_VERSION is bumped
  current.schemaVersion = SNAPSHOT_SCHEMA_VERSION;
  return current;
}

function validateSnapshot(value: unknown): SyncSnapshot {
  if (!value || typeof value !== "object") {
    throw new SyncSnapshotError("The sync snapshot is empty.");
  }
  const candidate = value as Partial<SyncSnapshot>;

  if (typeof candidate.schemaVersion !== "number" || !Number.isInteger(candidate.schemaVersion)) {
    throw new SyncSnapshotError("The sync snapshot has no valid schema version.");
  }
  if (candidate.schemaVersion > SNAPSHOT_SCHEMA_VERSION) {
    throw new SyncSnapshotError(
      `Sync snapshot version ${candidate.schemaVersion} is newer than supported (${SNAPSHOT_SCHEMA_VERSION}). Please upgrade the app.`
    );
  }
  if (candidate.schemaVersion < 1) {
    throw new SyncSnapshotError("The sync snapshot has an invalid schema version.");
  }

  if (!Number.isInteger(candidate.revision) || (candidate.revision as number) < 0) {
    throw new SyncSnapshotError("The sync snapshot has no valid revision.");
  }
  if (typeof candidate.deviceId !== "string" || !candidate.deviceId) {
    throw new SyncSnapshotError("The sync snapshot has no device id.");
  }
  if (typeof candidate.updatedAt !== "string" || Number.isNaN(Date.parse(candidate.updatedAt))) {
    throw new SyncSnapshotError("The sync snapshot has no valid timestamp.");
  }
  if (
    !candidate.payload ||
    typeof candidate.payload !== "object" ||
    Array.isArray(candidate.payload)
  ) {
    throw new SyncSnapshotError("The sync snapshot has no payload object.");
  }

  const base: SyncSnapshot = {
    schemaVersion: candidate.schemaVersion,
    revision: candidate.revision as number,
    deviceId: candidate.deviceId,
    updatedAt: candidate.updatedAt,
    payload: candidate.payload as Record<string, unknown>,
  };

  if (base.schemaVersion < SNAPSHOT_SCHEMA_VERSION) {
    return migrateSnapshot(base, base.schemaVersion);
  }
  return base;
}

/** True when `remote` should replace `local` (strictly newer wins; ties keep local) */
export function isNewerRevision(remoteRevision: number | null, localRevision: number): boolean {
  return typeof remoteRevision === "number" && remoteRevision > localRevision;
}
