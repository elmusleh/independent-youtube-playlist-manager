import { describe, expect, it } from "vitest";
import { DEFAULT_SYNC_CONFIG } from "./sync-config";
import { buildSyncRunReport } from "./sync-report";

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
    expect(report.knownDevices).toBe(2);
    expect(report.rows).toHaveLength(4);
    expect(report.rows[0]?.localSummary).toBe("27 playlists (142 videos)");
    expect(report.rows[1]?.localSummary).toBe("18 watched videos");
    expect(report.rows[2]?.localSummary).toBe("9 synced preferences");
  });
});
