import { libraryFixture } from "../test-support/library-fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clearArchivedThumbnails = vi.fn(async () => {});
const restoreThumbnails = vi.fn(async () => {});

vi.mock("./thumbnail-archive", () => ({
  archivedThumbnails: vi.fn(async () => ({})),
  clearArchivedThumbnails,
  restoreThumbnails,
  validThumbnail: () => true,
}));

vi.mock("./db-service.js", () => ({
  dbGetAllMetadata: vi.fn(async () => ({})),
  dbPutMetadataBatch: vi.fn(async () => {}),
  dbClearMetadata: vi.fn(async () => {}),
}));

function fullBackup(data: Record<string, unknown>) {
  return { format: "yph_full_backup", schemaVersion: 2, data: { playlists: [], ...data } };
}

describe("importFullDatabaseBackup thumbnail archive", () => {
  beforeEach(async () => {
    clearArchivedThumbnails.mockClear();
    restoreThumbnails.mockClear();
    vi.resetModules();
    await libraryFixture();
  });

  it("clears the archive when an older backup without thumbnails overwrites the database", async () => {
    const { importFullDatabaseBackup } = await import("./backup-service");

    const result = await importFullDatabaseBackup(fullBackup({}), "overwrite");

    expect(result.success).toBe(true);
    expect(clearArchivedThumbnails).toHaveBeenCalledTimes(1);
    expect(restoreThumbnails).not.toHaveBeenCalled();
  });

  it("restores thumbnails after clearing when the backup carries them", async () => {
    const { importFullDatabaseBackup } = await import("./backup-service");
    const thumbnails = { dQw4w9WgXcQ: "data:image/png;base64,YWJj" };

    const result = await importFullDatabaseBackup(fullBackup({ thumbnails }), "overwrite");

    expect(result.success).toBe(true);
    expect(clearArchivedThumbnails).toHaveBeenCalledTimes(1);
    expect(restoreThumbnails).toHaveBeenCalledWith(thumbnails);
  });

  it("leaves the archive alone when merging", async () => {
    const { importFullDatabaseBackup } = await import("./backup-service");

    await importFullDatabaseBackup(fullBackup({}), "merge");

    expect(clearArchivedThumbnails).not.toHaveBeenCalled();
    expect(restoreThumbnails).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.unstubAllGlobals());
