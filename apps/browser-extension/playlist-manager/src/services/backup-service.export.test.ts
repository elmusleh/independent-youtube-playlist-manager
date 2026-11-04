import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAllMetadata = vi.fn(async () => ({}));
const archivedThumbnails = vi.fn(async () => ({}));
const syncSet = vi.fn(async () => {});

vi.mock("./db-service.js", () => ({
  dbGetAllMetadata: getAllMetadata,
  dbPutMetadataBatch: vi.fn(),
  dbClearMetadata: vi.fn(),
}));

vi.mock("./thumbnail-archive", () => ({
  archivedThumbnails,
  clearArchivedThumbnails: vi.fn(),
  restoreThumbnails: vi.fn(),
  validThumbnail: () => true,
}));

vi.mock("../../../shared/storage-client.js", () => ({
  librarySnapshot: vi.fn(async () => ({ playlists: [], revision: 0 })),
  mutateLibrary: vi.fn(),
}));

describe("exportFullDatabaseBackup settings privacy", () => {
  beforeEach(() => {
    vi.resetModules();
    getAllMetadata.mockReset().mockResolvedValue({});
    archivedThumbnails.mockReset().mockResolvedValue({});
    syncSet.mockReset();
    window.browser = {
      runtime: { getManifest: () => ({ version: "1.2.1" }) },
      storage: {
        local: {
          get: vi.fn(async () => ({ local_yt_history: {} })),
          set: vi.fn(async () => {}),
        },
        sync: { set: syncSet },
      },
    } as any;
    window.chrome = undefined as any;
    window.getSettings = vi.fn(async () => ({
      themeChoice: "dark",
      closeAddedTabs: false,
      yph_sync_config: { syncKey: "durable-secret", supabaseKey: "endpoint-secret" },
      yph_sync_status: { lastError: "private status" },
      apiToken: "token-secret",
      unknownStorageKey: "must-not-export",
    })) as any;
    window.getPlaylists = vi.fn(async () => []) as any;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.browser = undefined as any;
    window.getSettings = undefined as any;
    window.getPlaylists = undefined as any;
  });

  it("exports only allowlisted user preferences, never sync credentials or internal state", async () => {
    const { exportFullDatabaseBackup } = await import("./backup-service");

    const backup = await exportFullDatabaseBackup();

    expect(backup.data.settings).toEqual({ themeChoice: "dark", closeAddedTabs: false });
    const serialized = JSON.stringify(backup);
    expect(serialized).not.toContain("durable-secret");
    expect(serialized).not.toContain("endpoint-secret");
    expect(serialized).not.toContain("token-secret");
    expect(serialized).not.toContain("private status");
    expect(serialized).not.toContain("must-not-export");
  });

  it("does not import credentials or internal storage keys from crafted settings", async () => {
    const { importFullDatabaseBackup } = await import("./backup-service");

    await importFullDatabaseBackup(
      {
        format: "yph_full_backup",
        schemaVersion: 2,
        data: {
          playlists: [],
          settings: {
            themeChoice: "light",
            yph_sync_config: { syncKey: "attacker-key" },
            yph_sync_status: { lastError: "internal" },
            apiToken: "attacker-token",
          },
        },
      },
      "merge"
    );

    expect(syncSet).toHaveBeenCalledWith({ themeChoice: "light", closeAddedTabs: false });
    expect(JSON.stringify(syncSet.mock.calls)).not.toContain("attacker-key");
    expect(JSON.stringify(syncSet.mock.calls)).not.toContain("attacker-token");
  });
});
