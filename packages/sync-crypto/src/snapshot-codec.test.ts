// packages/sync-crypto/src/snapshot-codec.test.ts
import { describe, it, expect } from "vitest";
import {
  createSnapshot,
  encodeSnapshot,
  decodeSnapshot,
  isNewerRevision,
  SyncSnapshotError,
  SNAPSHOT_SCHEMA_VERSION,
} from "./snapshot-codec.js";

describe("Snapshot Codec", () => {
  it("should create a valid snapshot", () => {
    const snapshot = createSnapshot({
      revision: 1,
      deviceId: "device-123",
      payload: { playlists: [], settings: {} },
    });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.revision).toBe(1);
    expect(snapshot.deviceId).toBe("device-123");
    expect(snapshot.payload).toEqual({ playlists: [], settings: {} });
    expect(snapshot.updatedAt).toBeDefined();
  });

  it("should serialize and deserialize", () => {
    const snapshot = createSnapshot({
      revision: 42,
      deviceId: "device-456",
      payload: { key: "value" },
    });

    const encoded = encodeSnapshot(snapshot);
    const decoded = decodeSnapshot(encoded);

    expect(decoded).toEqual(snapshot);
  });

  it("should validate schema version", () => {
    const snapshot = createSnapshot({
      revision: 1,
      deviceId: "device-1",
      payload: {},
    });

    // Valid version
    expect(() => decodeSnapshot(encodeSnapshot(snapshot))).not.toThrow();
  });

  it("should reject future schema versions", () => {
    const futureSnapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1,
      revision: 1,
      deviceId: "device-1",
      updatedAt: new Date().toISOString(),
      payload: {},
    };

    expect(() => decodeSnapshot(encodeSnapshot(futureSnapshot as any))).toThrow(SyncSnapshotError);
  });

  it("should reject invalid payloads", () => {
    expect(() =>
      createSnapshot({
        revision: 1,
        deviceId: "device-1",
        payload: "not-an-object" as any,
      })
    ).toThrow(SyncSnapshotError);

    expect(() =>
      createSnapshot({
        revision: 1,
        deviceId: "device-1",
        payload: [] as any,
      })
    ).toThrow(SyncSnapshotError);
  });

  it("should reject negative revisions", () => {
    expect(() =>
      createSnapshot({
        revision: -1,
        deviceId: "device-1",
        payload: {},
      })
    ).toThrow(SyncSnapshotError);
  });

  it("should compare revisions correctly", () => {
    expect(isNewerRevision(5, 3)).toBe(true);
    expect(isNewerRevision(3, 5)).toBe(false);
    expect(isNewerRevision(5, 5)).toBe(false); // Ties keep local
    expect(isNewerRevision(null, 0)).toBe(false);
    expect(isNewerRevision(1, 0)).toBe(true);
  });
});
