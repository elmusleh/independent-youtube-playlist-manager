import { describe, expect, it } from "vitest";
import {
  collectMetadataGaps,
  durationStringToSeconds,
  getMetadataGaps,
  hasChannel,
  hasCompleteMetadata,
  hasDuration,
  hasTitle,
  isLiveStream,
  isTerminalEntry,
  needsAttention,
  needsDurationRefresh,
} from "./metadata-completeness";

const full = {
  videoId: "abc12345678",
  title: "A real title",
  channel: "A real channel",
  durationISO: "PT4M13S",
  durationSeconds: 253,
};

describe("durationStringToSeconds", () => {
  it("decodes ISO-8601 durations", () => {
    expect(durationStringToSeconds("PT4M13S")).toBe(253);
    expect(durationStringToSeconds("PT1H2M3S")).toBe(3723);
    expect(durationStringToSeconds("PT45S")).toBe(45);
    expect(durationStringToSeconds("P1DT1S")).toBe(86401);
  });

  it("decodes clock notation", () => {
    expect(durationStringToSeconds("4:13")).toBe(253);
    expect(durationStringToSeconds("1:02:03")).toBe(3723);
  });

  it("treats zero-length and unparseable values as missing, not as zero", () => {
    // Regression: secsToISO(0) produced the truthy string "PT0S", which used to
    // satisfy the duration requirement and permanently hid the gap.
    expect(durationStringToSeconds("PT0S")).toBe(0);
    expect(durationStringToSeconds("PT0H0M0S")).toBe(0);
    expect(durationStringToSeconds("0:00")).toBe(0);
    expect(durationStringToSeconds("00:00:00")).toBe(0);
    expect(durationStringToSeconds(0)).toBe(0);
    expect(durationStringToSeconds("")).toBe(0);
    expect(durationStringToSeconds("   ")).toBe(0);
    expect(durationStringToSeconds(null)).toBe(0);
    expect(durationStringToSeconds(undefined)).toBe(0);
    expect(durationStringToSeconds("not a duration")).toBe(0);
    expect(durationStringToSeconds("P")).toBe(0);
  });

  it("accepts a plain number of seconds", () => {
    expect(durationStringToSeconds(253)).toBe(253);
    expect(durationStringToSeconds("253")).toBe(253);
  });
});

describe("hasDuration", () => {
  it("accepts any non-zero duration representation", () => {
    expect(hasDuration({ durationISO: "PT4M13S" })).toBe(true);
    expect(hasDuration({ durationSeconds: 253 })).toBe(true);
    expect(hasDuration({ duration: "4:13" })).toBe(true);
  });

  it("rejects a zero-length duration that is not live", () => {
    expect(hasDuration({ durationISO: "PT0S" })).toBe(false);
    expect(hasDuration({ durationSeconds: 0 })).toBe(false);
    expect(hasDuration({ duration: "0:00" })).toBe(false);
    expect(hasDuration({})).toBe(false);
    expect(hasDuration(null)).toBe(false);
  });

  it("accepts anything the source explicitly marked live", () => {
    expect(hasDuration({ isLive: true })).toBe(true);
    expect(hasDuration({ isLive: true, durationSeconds: 0 })).toBe(true);
  });
});

describe("placeholders", () => {
  it("rejects placeholder titles", () => {
    expect(hasTitle({ title: "Private video" })).toBe(false);
    expect(hasTitle({ title: "[Deleted video]" })).toBe(false);
    expect(hasTitle({ title: "null" })).toBe(false);
    expect(hasTitle({ title: "  " })).toBe(false);
    expect(hasTitle({ title: "Real" })).toBe(true);
  });

  it("rejects placeholder channels", () => {
    expect(hasChannel({ channel: "deleted channel" })).toBe(false);
    expect(hasChannel({ channel: "" })).toBe(false);
    expect(hasChannel({ channel: "Real Channel" })).toBe(true);
  });
});

describe("getMetadataGaps", () => {
  it("reports nothing missing for a fully populated entry", () => {
    const gaps = getMetadataGaps(full);
    expect(gaps.complete).toBe(true);
    expect(gaps.reasons).toEqual([]);
  });

  it("reports a missing duration for a title+channel entry", () => {
    const gaps = getMetadataGaps({ title: "t", channel: "c" });
    expect(gaps.missingDuration).toBe(true);
    expect(gaps.complete).toBe(false);
    expect(gaps.reasons).toEqual(["missing_duration"]);
  });

  it("lists reasons in a stable order", () => {
    expect(getMetadataGaps({}).reasons).toEqual([
      "missing_title",
      "missing_channel",
      "missing_duration",
      "empty",
    ]);
  });
});

describe("terminal entries", () => {
  it("detects private/deleted/broken entries", () => {
    expect(isTerminalEntry({ isPrivate: true })).toBe(true);
    expect(isTerminalEntry({ isDeleted: true })).toBe(true);
    expect(isTerminalEntry({ isBroken: true })).toBe(true);
    expect(isTerminalEntry({ isUnavailable: true })).toBe(true);
    expect(isTerminalEntry({})).toBe(false);
    expect(isTerminalEntry(null)).toBe(false);
  });

  it("treats a terminal entry as resolved even when fields are empty", () => {
    expect(hasCompleteMetadata({ isPrivate: true })).toBe(true);
    expect(hasCompleteMetadata({ isUnavailable: true })).toBe(true);
    expect(needsAttention({ isUnavailable: true })).toBe(false);
    // …but it is still not "complete" field-by-field:
    expect(getMetadataGaps({ isPrivate: true }).complete).toBe(false);
  });

  it("never asks for a duration refresh on a terminal entry", () => {
    expect(needsDurationRefresh({ title: "t", channel: "c", isDeleted: true })).toBe(false);
    expect(needsDurationRefresh({ title: "t", channel: "c", isUnavailable: true })).toBe(false);
  });
});

describe("needsDurationRefresh", () => {
  it("targets title+channel entries that lost their duration", () => {
    expect(needsDurationRefresh({ title: "t", channel: "c" })).toBe(true);
    expect(needsDurationRefresh({ title: "t", channel: "c", durationISO: "PT0S" })).toBe(true);
  });

  it("ignores live streams, complete entries and entries missing more than duration", () => {
    expect(needsDurationRefresh({ title: "t", channel: "c", isLive: true })).toBe(false);
    expect(needsDurationRefresh(full)).toBe(false);
    expect(needsDurationRefresh({ title: "t" })).toBe(false);
    expect(needsDurationRefresh(null)).toBe(false);
  });
});

describe("collectMetadataGaps", () => {
  it("keeps complete + needsAttention === total for every input shape", () => {
    const record = {
      a: full,
      b: { title: "t", channel: "c" },
      c: { isPrivate: true },
      d: {},
      e: null,
    };

    const fromRecord = collectMetadataGaps(record);
    expect(fromRecord.total).toBe(5);
    expect(fromRecord.complete + fromRecord.needsAttention).toBe(fromRecord.total);

    const fromIterable = collectMetadataGaps([full, { title: "t", channel: "c" }, {}]);
    expect(fromIterable.complete + fromIterable.needsAttention).toBe(fromIterable.total);
  });

  it("counts terminal entries as resolved, matching the gaps list", () => {
    const summary = collectMetadataGaps({ a: { isPrivate: true }, b: full });
    expect(summary.complete).toBe(2);
    expect(summary.needsAttention).toBe(0);
    expect(summary.terminal).toBe(1);
  });

  it("collects duration-only recovery candidates", () => {
    const summary = collectMetadataGaps({
      a: { title: "t", channel: "c" },
      b: full,
      c: { title: "t", channel: "c", durationISO: "PT0S" },
      d: { title: "t", channel: "c", isPrivate: true },
    });
    expect(summary.durationRecoverable).toBe(2);
    expect(summary.recoverableIds.sort()).toEqual(["a", "c"]);
  });

  it("handles empty and missing input", () => {
    for (const input of [null, undefined, {}, [] as any[]]) {
      const summary = collectMetadataGaps(input as any);
      expect(summary.total).toBe(0);
      expect(summary.needsAttention).toBe(0);
      expect(summary.complete).toBe(0);
    }
  });

  it("counts a null entry as needing attention", () => {
    const summary = collectMetadataGaps({ a: null });
    expect(summary.total).toBe(1);
    expect(summary.needsAttention).toBe(1);
    expect(summary.empty).toBe(1);
    expect(summary.recoverableIds).toEqual([]);
  });
});

describe("isLiveStream", () => {
  it("only trusts an explicit live flag", () => {
    expect(isLiveStream({ isLive: true })).toBe(true);
    expect(isLiveStream({ isLive: false })).toBe(false);
    expect(isLiveStream({ durationSeconds: 0 })).toBe(false);
    expect(isLiveStream(null)).toBe(false);
  });
});
