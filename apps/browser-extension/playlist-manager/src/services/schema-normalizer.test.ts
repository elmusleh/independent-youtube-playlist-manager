import { describe, it, expect } from "vitest";
import {
  sanitizeVideoId,
  isoToSecs,
  secsToISO,
  normalizeVideoMeta,
  normalizePlaylist,
  normalizeHistoryRecord,
} from "./schema-normalizer";

describe("sanitizeVideoId", () => {
  it("returns a clean 11-char ID unchanged", () => {
    expect(sanitizeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a full youtube.com/watch URL", () => {
    expect(sanitizeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from a youtu.be short URL", () => {
    expect(sanitizeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from an embed URL", () => {
    expect(sanitizeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeVideoId("")).toBe("");
  });

  it("returns trimmed value when not a URL but not empty", () => {
    expect(sanitizeVideoId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });
});

describe("isoToSecs", () => {
  it("converts PT5M30S to 330 seconds", () => {
    expect(isoToSecs("PT5M30S")).toBe(330);
  });

  it("converts PT1H to 3600 seconds", () => {
    expect(isoToSecs("PT1H")).toBe(3600);
  });

  it("converts PT1H30M15S to 5415 seconds", () => {
    expect(isoToSecs("PT1H30M15S")).toBe(5415);
  });

  it("returns 0 for LIVE", () => {
    expect(isoToSecs("LIVE")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(isoToSecs("")).toBe(0);
  });

  it("handles days: P1DT2H → 93600 seconds", () => {
    expect(isoToSecs("P1DT2H")).toBe(93600);
  });
});

describe("secsToISO", () => {
  it("converts 330 seconds to PT5M30S", () => {
    expect(secsToISO(330)).toBe("PT5M30S");
  });

  it("converts 3600 seconds to PT1H", () => {
    expect(secsToISO(3600)).toBe("PT1H");
  });

  it("converts 5415 seconds to PT1H30M15S", () => {
    expect(secsToISO(5415)).toBe("PT1H30M15S");
  });

  it("returns empty string for NaN", () => {
    expect(secsToISO(NaN)).toBe("");
  });

  it("returns empty string for negative", () => {
    expect(secsToISO(-5)).toBe("");
  });

  it("returns PT0S for 0", () => {
    expect(secsToISO(0)).toBe("PT0S");
  });
});

describe("normalizeVideoMeta", () => {
  it("normalizes pre-extracted flat video metadata fields", () => {
    const raw = {
      videoId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      channel: "Rick Astley",
      durationISO: "PT3M33S",
      viewCount: 1000000,
      publishedAt: "2009-10-25T06:57:33Z",
    };
    const result = normalizeVideoMeta(raw);
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.title).toBe("Never Gonna Give You Up");
    expect(result.channel).toBe("Rick Astley");
    expect(result.durationISO).toBe("PT3M33S");
    expect(result.durationSeconds).toBe(213);
    expect(result.viewCount).toBe(1000000);
    expect(result.publishedAt).toBe("2009-10-25T06:57:33Z");
  });

  it("uses fallbackId when no videoId is provided", () => {
    const result = normalizeVideoMeta({ title: "Test" }, "abc12345678");
    expect(result.videoId).toBe("abc12345678");
  });

  it("handles minimal input (just videoId)", () => {
    const result = normalizeVideoMeta({ videoId: "dQw4w9WgXcQ" });
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.title).toBe("");
    expect(result.channel).toBe("");
    expect(result.durationSeconds).toBe(0);
    expect(result.viewCount).toBeUndefined();
    expect(result.publishedAt).toBeUndefined();
    expect(result.isPrivate).toBe(false);
    expect(result.isDeleted).toBe(false);
    expect(result.isLive).toBe(false);
  });

  it("detects 'Private video' title and sets isPrivate", () => {
    const result = normalizeVideoMeta({ title: "Private video" });
    expect(result.isPrivate).toBe(true);
  });

  it("detects 'Deleted video' title and sets isDeleted", () => {
    const result = normalizeVideoMeta({ title: "Deleted video" });
    expect(result.isDeleted).toBe(true);
  });

  it("parses duration from ISO 8601 contentDetails.duration", () => {
    const result = normalizeVideoMeta({ durationISO: "PT1H2M3S" });
    expect(result.durationSeconds).toBe(3723);
    expect(result.durationISO).toBe("PT1H2M3S");
  });

  it("parses duration from 'duration' field (ISO 8601 string)", () => {
    const result = normalizeVideoMeta({ duration: "PT5M30S" });
    expect(result.durationSeconds).toBe(330);
  });

  it("parses duration from durationSeconds number", () => {
    const result = normalizeVideoMeta({ durationSeconds: 120 });
    expect(result.durationSeconds).toBe(120);
    expect(result.durationISO).toBe("PT2M");
  });

  it("parses duration from lengthSeconds as string", () => {
    const result = normalizeVideoMeta({ lengthSeconds: "300" });
    expect(result.durationSeconds).toBe(300);
  });

  it("parses duration from lengthSeconds as number", () => {
    const result = normalizeVideoMeta({ lengthSeconds: 420 });
    expect(result.durationSeconds).toBe(420);
  });

  it("sets LIVE for duration === 'LIVE'", () => {
    const result = normalizeVideoMeta({ duration: "LIVE" });
    expect(result.isLive).toBe(true);
    expect(result.durationISO).toBe("LIVE");
    expect(result.durationSeconds).toBe(0);
  });

  it("sets LIVE for isLiveContent === true", () => {
    const result = normalizeVideoMeta({ isLiveContent: true, duration: "PT10M" });
    expect(result.isLive).toBe(true);
    expect(result.durationISO).toBe("LIVE");
  });

  it("passes through boolean flags that are part of the schema", () => {
    const result = normalizeVideoMeta({
      videoId: "dQw4w9WgXcQ",
      isPrivate: true,
      isDeleted: false,
    });
    expect(result.isPrivate).toBe(true);
    expect(result.isDeleted).toBe(false);
  });

  it("sets lastFetchAttempt when provided", () => {
    const ts = 1700000000000;
    const result = normalizeVideoMeta({ lastFetchAttempt: ts });
    expect(result.lastFetchAttempt).toBe(ts);
  });

  it("sets lastCachedAt to provided value or falls back to Date.now()", () => {
    const ts = 1700000000000;
    const withTs = normalizeVideoMeta({ lastCachedAt: ts });
    expect(withTs.lastCachedAt).toBe(ts);

    const withoutTs = normalizeVideoMeta({});
    expect(withoutTs.lastCachedAt).toBeGreaterThan(0);
  });

  it("uses channel field over author field", () => {
    const result = normalizeVideoMeta({ channel: "Channel A", author: "Channel B" });
    expect(result.channel).toBe("Channel A");
  });

  it("uses author field when channel is missing", () => {
    const result = normalizeVideoMeta({ author: "Channel B" });
    expect(result.channel).toBe("Channel B");
  });

  it("treats null/undefined raw as empty object", () => {
    const r1 = normalizeVideoMeta(null);
    expect(r1.videoId).toBe("");
    const r2 = normalizeVideoMeta(undefined);
    expect(r2.videoId).toBe("");
  });
});

describe("normalizePlaylist", () => {
  it("normalizes a playlist with flat fields", () => {
    const raw = {
      id: "PLtest123",
      title: "My Playlist",
      videos: ["dQw4w9WgXcQ", "oHg5SJYRHA0"],
    };
    const result = normalizePlaylist(raw);
    expect(result.id).toBe("PLtest123");
    expect(result.title).toBe("My Playlist");
    expect(result.videos).toEqual(["dQw4w9WgXcQ", "oHg5SJYRHA0"]);
  });

  it("deduplicates video IDs", () => {
    const raw = { id: "p1", title: "Dedup", videos: ["abc12345678", "abc12345678", "abc12345678"] };
    const result = normalizePlaylist(raw);
    expect(result.videos).toEqual(["abc12345678"]);
  });

  it("filters out invalid/empty video IDs", () => {
    const raw = { id: "p1", title: "Clean", videos: ["dQw4w9WgXcQ", "", null, "oHg5SJYRHA0"] };
    const result = normalizePlaylist(raw);
    expect(result.videos).toEqual(["dQw4w9WgXcQ", "oHg5SJYRHA0"]);
  });

  it("coerces boolean flags from strings", () => {
    const raw = {
      id: "p1",
      title: "Bools",
      saved: true,
      isLocal: false,
      isTagged: true,
      isDirty: true,
      isPermanent: true,
    };
    const result = normalizePlaylist(raw);
    expect(result.saved).toBe(true);
    expect(result.isLocal).toBe(false);
    expect(result.isTagged).toBe(true);
    expect(result.isDirty).toBe(true);
    expect(result.isPermanent).toBe(true);
  });

  it("defaults isLocal to true when not explicitly false", () => {
    const result = normalizePlaylist({ id: "p1", title: "Local" });
    expect(result.isLocal).toBe(true);
  });

  it("uses title fallback to 'Untitled Playlist' when title is empty/missing", () => {
    expect(normalizePlaylist({ id: "p1" }).title).toBe("Untitled Playlist");
    expect(normalizePlaylist({ id: "p1", title: "" }).title).toBe("Untitled Playlist");
    expect(normalizePlaylist({ id: "p1", title: "   " }).title).toBe("Untitled Playlist");
  });

  it("uses fallbackId when no id is provided", () => {
    const result = normalizePlaylist({ title: "Test" }, "fallback-id");
    expect(result.id).toBe("fallback-id");
  });

  it("handles empty videos array", () => {
    const result = normalizePlaylist({ id: "p1", title: "Empty", videos: [] });
    expect(result.videos).toEqual([]);
  });

  it("handles missing videos array", () => {
    const result = normalizePlaylist({ id: "p1", title: "No Videos" });
    expect(result.videos).toEqual([]);
  });

  it("uses timestamp when provided", () => {
    const ts = 1700000000000;
    const result = normalizePlaylist({ id: "p1", title: "TS", timestamp: ts });
    expect(result.timestamp).toBe(ts);
  });

  it("all booleans default to false when not set", () => {
    const result = normalizePlaylist({ id: "p1", title: "Defaults" });
    expect(result.saved).toBe(false);
    expect(result.isTagged).toBe(false);
    expect(result.isDirty).toBe(false);
    expect(result.isPermanent).toBe(false);
  });
});

describe("normalizeHistoryRecord", () => {
  it("normalizes a full input record", () => {
    const raw = { t: 120, dur: 300, lastUpdated: 1700000000000, title: "Video", channel: "Chan" };
    const result = normalizeHistoryRecord(raw, "dQw4w9WgXcQ");
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.t).toBe(120);
    expect(result.dur).toBe(300);
    expect(result.lastUpdated).toBe(1700000000000);
    expect(result.title).toBe("Video");
    expect(result.channel).toBe("Chan");
    expect(result.isCompleted).toBe(false);
  });

  it("detects completion when t >= dur * 0.95", () => {
    const raw = { t: 285, dur: 300, lastUpdated: 1700000000000 };
    expect(normalizeHistoryRecord(raw, "abc12345678").isCompleted).toBe(true);
  });

  it("is not completed when t < dur * 0.95", () => {
    const raw = { t: 200, dur: 300, lastUpdated: 1700000000000 };
    expect(normalizeHistoryRecord(raw, "abc12345678").isCompleted).toBe(false);
  });

  it("treats explicit isCompleted: true as completed regardless of t/dur", () => {
    const raw = { t: 10, dur: 300, isCompleted: true, lastUpdated: 1700000000000 };
    expect(normalizeHistoryRecord(raw, "abc12345678").isCompleted).toBe(true);
  });

  it("handles partial input (missing title/channel)", () => {
    const raw = { t: 50, dur: 200, lastUpdated: 1700000000000 };
    const result = normalizeHistoryRecord(raw, "abc12345678");
    expect(result.title).toBeUndefined();
    expect(result.channel).toBeUndefined();
  });

  it("treats null/undefined raw as empty object", () => {
    const result = normalizeHistoryRecord(null, "abc12345678");
    expect(result.videoId).toBe("abc12345678");
    expect(result.t).toBe(0);
    expect(result.dur).toBe(0);
    expect(result.isCompleted).toBe(false);
  });

  it("clamps negative t and dur to 0", () => {
    const raw = { t: -10, dur: -5, lastUpdated: 1700000000000 };
    const result = normalizeHistoryRecord(raw, "abc12345678");
    expect(result.t).toBe(0);
    expect(result.dur).toBe(0);
  });

  it("uses raw.videoId as fallback when videoId param is empty", () => {
    const raw = { videoId: "fallback123", t: 0, dur: 0, lastUpdated: 1700000000000 };
    const result = normalizeHistoryRecord(raw, "");
    expect(result.videoId).toBe("fallback123");
  });

  it("returns a deterministic lastUpdated when explicitly provided", () => {
    const ts = 1700000000000;
    const result = normalizeHistoryRecord({ t: 0, dur: 0, lastUpdated: ts }, "abc12345678");
    expect(result.lastUpdated).toBe(ts);
  });
});
