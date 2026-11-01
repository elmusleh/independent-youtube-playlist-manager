import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_SCHEMA_VERSION,
  SyncSnapshotError,
  createSnapshot,
  decodeSnapshot,
  encodeSnapshot,
  isNewerRevision,
} from "./snapshot-codec";

const payload = { playlists: [{ id: "local-1", videos: ["dQw4w9WgXcQ"] }] };
const valid = () =>
  createSnapshot({
    revision: 3,
    deviceId: "device-a",
    payload,
    updatedAt: "2026-11-01T10:00:00.000Z",
  });

describe("snapshot codec", () => {
  it("round-trips a snapshot", () => {
    const snapshot = valid();
    expect(decodeSnapshot(encodeSnapshot(snapshot))).toEqual(snapshot);
  });

  it("stamps the current schema version and a timestamp by default", () => {
    const snapshot = createSnapshot({ revision: 0, deviceId: "device-b", payload: {} });
    expect(snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(Number.isNaN(Date.parse(snapshot.updatedAt))).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(() =>
      createSnapshot({
        revision: 1,
        deviceId: "d",
        payload: [] as unknown as Record<string, unknown>,
      })
    ).toThrow(/payload must be an object/);
  });

  it("rejects negative or fractional revisions", () => {
    expect(() => createSnapshot({ revision: -1, deviceId: "d", payload })).toThrow(/non-negative/);
    expect(() => createSnapshot({ revision: 1.5, deviceId: "d", payload })).toThrow(/non-negative/);
  });

  it("rejects a snapshot without a device id", () => {
    expect(() => createSnapshot({ revision: 1, deviceId: "", payload })).toThrow(/device id/);
  });

  it("rejects non-JSON bytes", () => {
    expect(() => decodeSnapshot(new TextEncoder().encode("not json"))).toThrow(/not valid JSON/);
  });

  it("rejects an unknown schema version", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...valid(), schemaVersion: 99 }));
    expect(() => decodeSnapshot(bytes)).toThrow(/Unsupported sync snapshot version 99/);
  });

  it("rejects a missing revision, device id, timestamp or payload", () => {
    const cases: Record<string, unknown>[] = [
      { ...valid(), revision: undefined },
      { ...valid(), deviceId: undefined },
      { ...valid(), updatedAt: "not-a-date" },
      { ...valid(), payload: null },
    ];
    for (const candidate of cases) {
      expect(() => decodeSnapshot(new TextEncoder().encode(JSON.stringify(candidate)))).toThrow(
        SyncSnapshotError
      );
    }
  });

  it("treats only a strictly newer remote revision as an update", () => {
    expect(isNewerRevision(4, 3)).toBe(true);
    expect(isNewerRevision(3, 3)).toBe(false);
    expect(isNewerRevision(2, 3)).toBe(false);
    expect(isNewerRevision(null, 0)).toBe(false);
  });
});
