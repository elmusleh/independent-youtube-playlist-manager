import { libraryFixture } from "../test-support/library-fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clearArchivedThumbnails = vi.fn(async () => {});
const restoreThumbnails = vi.fn(async () => {});
const dbGetAllMetadata = vi.fn(async () => ({}));
const dbPutMetadataBatch = vi.fn(async () => {});
const dbClearMetadata = vi.fn(async () => {});
let testBrowser: any;

vi.mock("./thumbnail-archive", () => ({
  archivedThumbnails: vi.fn(async () => ({})),
  clearArchivedThumbnails,
  restoreThumbnails,
  validThumbnail: () => true,
}));

vi.mock("./db-service.js", () => ({
  dbGetAllMetadata,
  dbPutMetadataBatch,
  dbClearMetadata,
}));

function fullBackup(data: Record<string, unknown>) {
  return { format: "yph_full_backup", schemaVersion: 2, data: { playlists: [], ...data } };
}

describe("importFullDatabaseBackup thumbnail archive", () => {
  beforeEach(async () => {
    clearArchivedThumbnails.mockClear();
    restoreThumbnails.mockClear();
    dbGetAllMetadata.mockReset().mockResolvedValue({});
    dbPutMetadataBatch.mockReset();
    dbClearMetadata.mockReset();
    vi.resetModules();
    testBrowser = (await libraryFixture()).api;
    testBrowser.storage.sync = { set: vi.fn(), remove: vi.fn() };
    testBrowser.storage.local.set.mockClear();
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

  it("rejects unsupported backup versions before touching any local store", async () => {
    const { importFullDatabaseBackup } = await import("./backup-service");

    const result = await importFullDatabaseBackup(
      { format: "yph_full_backup", schemaVersion: 99, data: { playlists: [] } },
      "overwrite"
    );

    expect(result.success).toBe(false);
    expect(dbClearMetadata).not.toHaveBeenCalled();
    expect(dbPutMetadataBatch).not.toHaveBeenCalled();
    expect(clearArchivedThumbnails).not.toHaveBeenCalled();
    expect(restoreThumbnails).not.toHaveBeenCalled();
    expect(testBrowser.storage.local.set).not.toHaveBeenCalled();
    expect(testBrowser.storage.sync.set).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.unstubAllGlobals());
