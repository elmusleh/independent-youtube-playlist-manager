import { describe, expect, it } from "vitest";
import {
  CURRENT_BACKUP_SCHEMA_VERSION,
  migrateBackupForImport,
  validateBackupSchema,
} from "./backup-format";

describe("backup format migrations", () => {
  it("migrates schema v1 to the current version without dropping payload fields", () => {
    const legacy = {
      format: "yph_full_backup",
      schemaVersion: 1,
      data: { playlists: [{ id: "p1", videos: ["dQw4w9WgXcQ"] }], customFutureSafeField: true },
    };

    const migrated = migrateBackupForImport(legacy);

    expect(migrated.schemaVersion).toBe(CURRENT_BACKUP_SCHEMA_VERSION);
    expect(migrated.data.playlists).toEqual(legacy.data.playlists);
    expect(migrated.data.customFutureSafeField).toBe(true);
    expect(migrated.data.videoMetadata).toEqual({});
    expect(migrated.data.history).toEqual({});
    expect(migrated.data.settings).toEqual({});
    expect(migrated.data.thumbnails).toEqual({});
    expect(legacy.schemaVersion).toBe(1);
  });

  it("keeps the legacy playlist-array import shape intact", () => {
    const legacy = [{ id: "p1", videos: ["dQw4w9WgXcQ"] }];

    expect(validateBackupSchema(legacy).valid).toBe(true);
    expect(migrateBackupForImport(legacy)).toEqual(legacy);
  });

  it("keeps the current v2 backup intact during import migration", () => {
    const current = {
      format: "yph_full_backup",
      schemaVersion: 2,
      data: {
        playlists: [{ id: "p2", videos: ["dQw4w9WgXcQ"] }],
        settings: { themeChoice: "dark" },
        videoMetadata: { dQw4w9WgXcQ: { title: "Example" } },
      },
    };
    const before = structuredClone(current);

    expect(migrateBackupForImport(current)).toEqual(before);
    expect(current).toEqual(before);
  });

  it("accepts only versions with a migration path and rejects future versions", () => {
    expect(
      validateBackupSchema({ format: "yph_full_backup", schemaVersion: 1, data: { playlists: [] } })
        .valid
    ).toBe(true);
    expect(
      validateBackupSchema({ format: "yph_full_backup", schemaVersion: 2, data: { playlists: [] } })
        .valid
    ).toBe(true);
    expect(
      validateBackupSchema({
        format: "yph_full_backup",
        schemaVersion: 99,
        data: { playlists: [] },
      }).valid
    ).toBe(false);
    expect(
      validateBackupSchema({
        format: "yph_full_backup",
        schemaVersion: 1.5,
        data: { playlists: [] },
      }).valid
    ).toBe(false);
    expect(() =>
      migrateBackupForImport({
        format: "yph_full_backup",
        schemaVersion: 99,
        data: { playlists: [] },
      })
    ).toThrow(/newer than supported/);
  });
});
