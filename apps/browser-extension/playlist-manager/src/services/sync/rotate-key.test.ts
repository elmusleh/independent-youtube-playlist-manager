import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadSyncConfig: vi.fn(),
  saveSyncConfig: vi.fn(),
  generateSyncKey: vi.fn(),
}));

vi.mock("./sync-config.js", () => ({
  loadSyncConfig: mocks.loadSyncConfig,
  saveSyncConfig: mocks.saveSyncConfig,
}));
vi.mock("./sync-key.js", () => ({ generateSyncKey: mocks.generateSyncKey }));

describe("rotateSyncKey safety", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.loadSyncConfig.mockReset();
    mocks.saveSyncConfig.mockReset().mockResolvedValue(undefined);
    mocks.generateSyncKey.mockReset().mockReturnValue("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ");
  });

  it("refuses to rotate an unverified legacy remote before changing configuration", async () => {
    const config = {
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      backends: ["relay"],
      syncProtocolVersion: null,
      legacyV2AcknowledgedAt: null,
    };
    mocks.loadSyncConfig.mockResolvedValue(config);
    const { rotateSyncKey } = await import("./rotate-key");

    await expect(rotateSyncKey()).rejects.toThrow(/legacy|backup/i);

    expect(config.syncKey).toBe("ABCDEFGHIJKLMNOPQRST");
    expect(mocks.saveSyncConfig).not.toHaveBeenCalled();
  });

  it("retains the old remote space and marks the fresh key as v2", async () => {
    const config = {
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      backends: ["relay"],
      syncProtocolVersion: null,
      legacyV2AcknowledgedAt: 1234,
      lastSeq: 15,
    };
    mocks.loadSyncConfig.mockResolvedValue(config);
    const { rotateSyncKey } = await import("./rotate-key");

    await expect(rotateSyncKey()).resolves.toBe("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ");

    expect(mocks.saveSyncConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        syncKey: "ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ",
        lastSeq: 0,
        syncConfigVersion: 2,
        syncProtocolVersion: 2,
        legacyV2AcknowledgedAt: null,
      })
    );
  });
});
