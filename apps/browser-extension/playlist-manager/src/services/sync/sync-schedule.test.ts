import { describe, expect, it } from "vitest";
import {
  clampSyncIntervalMinutes,
  decomposeIntervalMinutes,
  formatNextScheduledCheck,
  formatSyncInterval,
  MAX_SYNC_INTERVAL_MINUTES,
  SYNC_INTERVAL_PRESETS,
  toIntervalMinutes,
} from "./sync-schedule";

describe("sync-schedule helpers", () => {
  it("includes the default 5-minute interval in quick presets", () => {
    expect(SYNC_INTERVAL_PRESETS.map((p) => p.minutes)).toContain(5);
    expect(SYNC_INTERVAL_PRESETS[0]).toEqual({ minutes: 0, label: "Manual only" });
  });

  it("clamps manual and custom minute values safely", () => {
    expect(clampSyncIntervalMinutes(0)).toBe(0);
    expect(clampSyncIntervalMinutes(-10)).toBe(0);
    expect(clampSyncIntervalMinutes(0.4)).toBe(1);
    expect(clampSyncIntervalMinutes(12.6)).toBe(13);
    expect(clampSyncIntervalMinutes(99_999)).toBe(MAX_SYNC_INTERVAL_MINUTES);
    expect(clampSyncIntervalMinutes(undefined, 5)).toBe(5);
  });

  it("converts and decomposes custom durations across minutes and hours", () => {
    expect(toIntervalMinutes(10, "minutes")).toBe(10);
    expect(toIntervalMinutes(2, "hours")).toBe(120);
    expect(toIntervalMinutes(500, "hours")).toBe(MAX_SYNC_INTERVAL_MINUTES);
    expect(decomposeIntervalMinutes(0)).toEqual({ amount: 15, unit: "minutes" });
    expect(decomposeIntervalMinutes(45)).toEqual({ amount: 45, unit: "minutes" });
    expect(decomposeIntervalMinutes(120)).toEqual({ amount: 2, unit: "hours" });
    expect(decomposeIntervalMinutes(90)).toEqual({ amount: 90, unit: "minutes" });
  });

  it("formats manual, preset, and custom intervals clearly", () => {
    expect(formatSyncInterval(0)).toBe("Manual only");
    expect(formatSyncInterval(1)).toBe("Every 1 min");
    expect(formatSyncInterval(5)).toBe("Every 5 min");
    expect(formatSyncInterval(60)).toBe("Every 1 hour");
    expect(formatSyncInterval(120)).toBe("Every 2 hours");
    expect(formatSyncInterval(90)).toBe("Every 1 hr 30 min");
    expect(formatSyncInterval(1440)).toBe("Every 24 hours");
    expect(formatSyncInterval(2880)).toBe("Every 2 days");
  });

  it("formats upcoming alarm timestamps relative to now", () => {
    const now = 1_700_000_000_000;
    expect(formatNextScheduledCheck(null, now)).toBeNull();
    expect(formatNextScheduledCheck(now + 10_000, now)).toMatch(/^in < 1 min \(/);
    expect(formatNextScheduledCheck(now + 5 * 60_000, now)).toMatch(/^in 5 min \(/);
    expect(formatNextScheduledCheck(now + 135 * 60_000, now)).toMatch(/^in 2 hr 15 min \(/);
  });
});
