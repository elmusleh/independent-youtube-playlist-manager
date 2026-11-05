import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SYNC_CONFIG } from "./sync-config";
import { buildSyncRunReport, loadLastSyncReport, saveLastSyncReport } from "./sync-report";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildSyncRunReport", () => {
  it("summarizes category rows, counts, and relay host cleanly", () => {
    const report = buildSyncRunReport({
      config: {
        ...DEFAULT_SYNC_CONFIG,
        syncKey: "ABCDE-FGHJK-MNPQR-STVWX",
        backends: ["relay"],
        content: {
          ...DEFAULT_SYNC_CONFIG.content,
          playlists: true,
          history: true,
          settings: true,
        },
      },
      statusSnapshot: {
        phase: "idle",
        lastError: null,
        lastSummary: "Synced 29 records (↓0 applied, ↑29 uploaded)",
        pushedCount: 29,
        pulledCount: 0,
        bytesSent: 4096,
        bytesReceived: 1024,
        categoryProgress: {
          playlists: { processed: 27, applied: 0, total: 27 },
          history: { processed: 1, applied: 0, total: 1 },
          settings: { processed: 1, applied: 0, total: 1 },
          devices: { processed: 1, applied: 1, total: 1 },
        },
      },
      inventoryAfter: {
        playlistsCount: 27,
        videosCount: 142,
        historyCount: 18,
        settingsCount: 9,
      },
      knownDevices: 2,
      durationMs: 540,
    });

    expect(report.ok).toBe(true);
    expect(report.endpointHost).toBe("pfydngsbcmuhsqqjbcte.supabase.co");
    expect(report.pushedCount).toBe(29);
    expect(report.bytesSent).toBe(4096);
    expect(report.bytesReceived).toBe(1024);
    expect(report.knownDevices).toBe(2);
    expect(report.rows).toHaveLength(4);
    expect(report.rows[0]?.localSummary).toBe("27 playlists (142 videos)");
    expect(report.rows[1]?.localSummary).toBe("18 watched videos");
    expect(report.rows[2]?.localSummary).toBe("9 synced preferences");
  });

  it("persists and reloads the latest SyncRunReport across tab reloads (#18)", async () => {
    const bag: Record<string, unknown> = {};
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async (k: string) => ({ [k]: bag[k] }),
          set: async (obj: Record<string, unknown>) => Object.assign(bag, obj),
        },
      },
    });
    const report = buildSyncRunReport({
      config: { ...DEFAULT_SYNC_CONFIG, syncKey: "ABCDEFGHIJKLMNOPQRST", backends: ["relay"] },
      statusSnapshot: {
        phase: "idle",
        lastSummary: "Sync complete",
        pushedCount: 3,
        pulledCount: 1,
      },
      inventoryAfter: { playlistsCount: 3, videosCount: 12, historyCount: 2, settingsCount: 4 },
      knownDevices: 2,
      durationMs: 220,
    });

    await saveLastSyncReport(report);
    const loaded = await loadLastSyncReport();
    expect(loaded).toEqual(report);
  });
});
