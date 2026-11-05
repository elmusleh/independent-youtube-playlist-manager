/**
 * Snapshot envelope: what a synced state *is*, independent of how it is stored.
 *
 * Every snapshot carries its own schema version, a monotonic revision, the writing device
 * and a timestamp. Conflicts are resolved by comparing `revision` alone — that is only
 * sound if the field is validated on the way in, so decoding is strict: a payload that
 * does not match the envelope is rejected before it can reach local data.
 *
 * Versioning policy (forward-compatible, backward-migrating):
 *   - Accept any version <= SNAPSHOT_SCHEMA_VERSION and migrate in-memory.
 *   - Reject only versions *newer* than current ("upgrade your app first").
 *   - Migration must be purely additive — never drop fields.
 */

export const SNAPSHOT_SCHEMA_VERSION = 1;

export type SyncSnapshot = {
  schemaVersion: number;
  /** Monotonic per storage address; the only conflict signal. */
  revision: number;
  /** Pseudonymous writer id, so a device can recognise its own writes. */
  deviceId: string;
  /** ISO-8601, informational only — never used for conflict resolution. */
  updatedAt: string;
  payload: Record<string, unknown>;
};

export type SnapshotInput = {
  revision: number;
  deviceId: string;
  payload: Record<string, unknown>;
  updatedAt?: string;
};

/** Thrown when a stored snapshot cannot be trusted. */
export class SyncSnapshotError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SyncSnapshotError";
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

/** Serialise for encryption. */
export function encodeSnapshot(snapshot: SyncSnapshot): Uint8Array {
  return encoder.encode(JSON.stringify(snapshot));
}

/** Parse and validate a decrypted snapshot. */
export function decodeSnapshot(bytes: Uint8Array): SyncSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(bytes));
  } catch (error) {
    throw new SyncSnapshotError("The sync snapshot is not valid JSON.", { cause: error });
  }
  return validateSnapshot(parsed);
}

/**
 * Migrate an older snapshot envelope to the current schema version.
 * Add a case here whenever SNAPSHOT_SCHEMA_VERSION is bumped.
 * Migration must be purely additive — never drop fields.
 */
function migrateSnapshot(candidate: SyncSnapshot, fromVersion: number): SyncSnapshot {
  let current: SyncSnapshot = { ...candidate };
  // Example for a future bump from 1 -> 2:
  // if (fromVersion < 2) {
  //   current = { ...current, schemaVersion: 2, payload: { ...current.payload, newField: defaultValue } };
  //   fromVersion = 2;
  // }
  current.schemaVersion = SNAPSHOT_SCHEMA_VERSION;
  return current;
}

function validateSnapshot(value: unknown): SyncSnapshot {
  if (!value || typeof value !== "object") {
    throw new SyncSnapshotError("The sync snapshot is empty.");
  }
  const candidate = value as Partial<SyncSnapshot>;

  // --- Schema version handling (forward-compatible, backward-migrating) ---
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

  // Migrate older envelopes to the current version in-memory.
  if (base.schemaVersion < SNAPSHOT_SCHEMA_VERSION) {
    return migrateSnapshot(base, base.schemaVersion);
  }
  return base;
}

/** True when `remote` should replace `local` (strictly newer wins; ties keep local). */
export function isNewerRevision(remoteRevision: number | null, localRevision: number): boolean {
  return typeof remoteRevision === "number" && remoteRevision > localRevision;
}
