import { describe, expect, it } from "vitest";
import { DEFAULT_SYNC_CONFIG, migrateSyncConfig } from "./sync-config";
import { needsV2RelayAcknowledgement } from "./sync-config-compatibility";

const SYNC_KEY = "ABCDEFGHIJKLMNOPQRST";

describe("sync config compatibility migration", () => {
  it("treats an empty new config as current and not configured for a remote", () => {
    expect(DEFAULT_SYNC_CONFIG.syncConfigVersion).toBe(2);
    expect(needsV2RelayAcknowledgement(DEFAULT_SYNC_CONFIG)).toBe(false);
  });

  it("migrates the old single-backend config without losing its key or timestamps", () => {
    const migrated = migrateSyncConfig({
      syncKey: SYNC_KEY,
      backend: "relay",
      lastSyncedAt: 1234,
      syncRevision: 7,
    });

    expect(migrated).toMatchObject({
      syncConfigVersion: 2,
      syncProtocolVersion: null,
      legacyV2AcknowledgedAt: null,
      syncKey: SYNC_KEY,
      backends: ["relay"],
      lastSyncedAt: 1234,
      syncRevision: 7,
    });
    expect(needsV2RelayAcknowledgement(migrated)).toBe(true);
  });

  it("does not gate partial configs or local-only backends", () => {
    expect(needsV2RelayAcknowledgement({ syncKey: null, backends: ["relay"] })).toBe(false);
    expect(needsV2RelayAcknowledgement({ syncKey: SYNC_KEY, backends: [] })).toBe(false);
    expect(needsV2RelayAcknowledgement({ syncKey: SYNC_KEY, backends: ["file"] })).toBe(false);
  });

  it("does not gate a config explicitly marked as relay protocol v2", () => {
    expect(
      needsV2RelayAcknowledgement({
        syncKey: SYNC_KEY,
        backends: ["relay"],
        syncConfigVersion: 2,
        syncProtocolVersion: 2,
      })
    ).toBe(false);
  });

  it("honors a durable acknowledgement even if the next relay run has not succeeded", () => {
    expect(
      needsV2RelayAcknowledgement({
        syncKey: SYNC_KEY,
        backends: ["supabase-byo"],
        syncProtocolVersion: null,
        legacyV2AcknowledgedAt: 1234,
      })
    ).toBe(false);
  });

  it("purges stale foreign *.supabase.co relay overrides while keeping test mock URLs", () => {
    const staleFirefoxConfig = migrateSyncConfig({
      syncKey: SYNC_KEY,
      backends: ["relay"],
      relayUrl: "https://qvwitlpnetwthyhrobca.supabase.co",
      relayAnonKey: "sb_publishable_stale_key",
      syncConfigVersion: 2,
      syncProtocolVersion: 2,
    });
    expect(staleFirefoxConfig.relayUrl).toBeUndefined();
    expect(staleFirefoxConfig.relayAnonKey).toBeUndefined();

    const testMockConfig = migrateSyncConfig({
      syncKey: SYNC_KEY,
      backends: ["relay"],
      relayUrl: "https://relay.test",
      relayAnonKey: "test-anon-key",
      syncConfigVersion: 2,
      syncProtocolVersion: 2,
    });
    expect(testMockConfig.relayUrl).toBe("https://relay.test");
    expect(testMockConfig.relayAnonKey).toBe("test-anon-key");
  });

  it("clamps out-of-range syncIntervalMinutes on write inside saveSyncConfig (#38)", async () => {
    const saved: Record<string, any> = {};
    const origBrowser = (globalThis as any).browser;
    (globalThis as any).browser = {
      storage: {
        local: {
          get: async (k: string) => ({ [k]: saved[k] }),
          set: async (obj: Record<string, any>) => Object.assign(saved, obj),
        },
      },
    };
    try {
      const { DEFAULT_SYNC_CONFIG, saveSyncConfig } = await import("./sync-config");
      await saveSyncConfig({
        ...DEFAULT_SYNC_CONFIG,
        syncIntervalMinutes: 999_999,
      });
      expect(saved.yph_sync_config.syncIntervalMinutes).toBe(10_080);

      await saveSyncConfig({
        ...DEFAULT_SYNC_CONFIG,
        syncIntervalMinutes: Number.NaN,
      });
      expect(saved.yph_sync_config.syncIntervalMinutes).toBe(5);
    } finally {
      (globalThis as any).browser = origBrowser;
    }
  });
});
