import { describe, it, expect } from "vitest";
import type { SortRule, Video } from "../types/model";
import {
  compareVideos,
  sortByRules,
  sortByTitle,
  sortByChannel,
  sortByDuration,
  sortByViewCount,
  sortByReleaseDate,
  reversePlaylist,
  describeSortRule,
  describeSortRules,
} from "./playlist-utils";

function video(partial: Partial<Video> & Pick<Video, "videoId">): Video {
  return {
    id: partial.videoId,
    url: `https://www.youtube.com/watch?v=${partial.videoId}`,
    title: "",
    channel: "",
    ...partial,
  } as Video;
}

const V = {
  alpha: video({
    videoId: "a",
    title: "Alpha",
    channel: "Zebra",
    durationSeconds: 300,
    viewCount: 1000,
    publishedAt: "2024-01-01T00:00:00Z",
  }),
  beta: video({
    videoId: "b",
    title: "beta",
    channel: "Alpha",
    durationSeconds: 60,
    viewCount: 5000,
    publishedAt: "2023-06-15T00:00:00Z",
  }),
  gamma: video({
    videoId: "c",
    title: "Gamma 2",
    channel: "Alpha",
    durationSeconds: 120,
    viewCount: 200,
    publishedAt: "2025-03-10T00:00:00Z",
  }),
  delta: video({
    videoId: "d",
    title: "delta 10",
    channel: "Beta",
    durationSeconds: 90,
    viewCount: 900,
    publishedAt: "2022-11-30T00:00:00Z",
  }),
};

describe("sortByTitle", () => {
  it("sorts titles A-Z with numeric and case-insensitive collation", () => {
    const titles = [V.beta, V.alpha, V.delta, V.gamma];
    const sorted = sortByTitle(titles).map((v) => v.title);
    expect(sorted).toEqual(["Alpha", "beta", "delta 10", "Gamma 2"]);
  });

  it("does not mutate the input array", () => {
    const input = [V.beta, V.alpha];
    const inputCopy = [...input];
    sortByTitle(input);
    expect(input).toEqual(inputCopy);
  });
});

describe("sortByChannel", () => {
  it("groups by channel name A-Z", () => {
    const sorted = sortByChannel([V.alpha, V.beta, V.delta]).map((v) => v.channel);
    expect(sorted).toEqual(["Alpha", "Beta", "Zebra"]);
  });
});

describe("sortByDuration", () => {
  it("sorts shortest first", () => {
    const sorted = sortByDuration([V.alpha, V.beta, V.gamma]).map((v) => v.videoId);
    expect(sorted).toEqual(["b", "c", "a"]);
  });
});

describe("sortByViewCount", () => {
  it("sorts most viewed first", () => {
    const sorted = sortByViewCount([V.alpha, V.beta, V.gamma]).map((v) => v.videoId);
    expect(sorted).toEqual(["b", "a", "c"]);
  });

  it("pushes videos without viewCount to the bottom", () => {
    const noViews = video({ videoId: "x", title: "No views" });
    const sorted = sortByViewCount([noViews, V.beta, V.alpha]).map((v) => v.videoId);
    expect(sorted).toEqual(["b", "a", "x"]);
  });
});

describe("sortByReleaseDate", () => {
  it("sorts newest first", () => {
    const sorted = sortByReleaseDate([V.alpha, V.beta, V.gamma, V.delta]).map((v) => v.videoId);
    expect(sorted).toEqual(["c", "a", "b", "d"]);
  });

  it("pushes videos without publishedAt to the bottom", () => {
    const noDate = video({ videoId: "x", title: "No date" });
    const sorted = sortByReleaseDate([noDate, V.gamma, V.beta]).map((v) => v.videoId);
    expect(sorted).toEqual(["c", "b", "x"]);
  });
});

describe("compareVideos", () => {
  it("returns first non-zero rule result and falls through on ties", () => {
    const a = V.beta; // channel Alpha, title beta, duration 60
    const b = V.gamma; // channel Alpha, title Gamma 2, duration 120
    const rules: SortRule[] = [
      { field: "channel", direction: "asc" },
      { field: "duration", direction: "asc" },
    ];
    // Same channel -> tie on rule 1, falls through to duration
    expect(compareVideos(a, b, rules)).toBeLessThan(0);
  });

  it("returns 0 when all rules tie", () => {
    const a = video({ videoId: "x", title: "Same", channel: "Same", durationSeconds: 10 });
    const b = video({ videoId: "y", title: "Same", channel: "Same", durationSeconds: 10 });
    const rules: SortRule[] = [
      { field: "channel", direction: "asc" },
      { field: "title", direction: "asc" },
      { field: "duration", direction: "asc" },
    ];
    expect(compareVideos(a, b, rules)).toBe(0);
  });

  it("is stable on full ties regardless of direction", () => {
    const a = video({ videoId: "x", title: "Same", channel: "Same" });
    const b = video({ videoId: "y", title: "Same", channel: "Same" });
    const desc: SortRule[] = [{ field: "title", direction: "desc" }];
    expect(compareVideos(a, b, desc)).toBe(0);
  });
});

describe("sortByRules (multi-level)", () => {
  it("sorts by Channel then Duration within each channel (asc)", () => {
    // alpha = Zebra/300, beta = Alpha/60, gamma = Alpha/120, delta = Beta/90
    const sorted = sortByRules(
      [V.alpha, V.gamma, V.beta, V.delta],
      [
        { field: "channel", direction: "asc" },
        { field: "duration", direction: "asc" },
      ]
    ).map((v) => v.videoId);
    // Alpha group: beta(60), gamma(120); then Beta: delta(90); then Zebra: alpha(300)
    expect(sorted).toEqual(["b", "c", "d", "a"]);
  });

  it("sorts by Channel then Release Date (newest first) within each channel", () => {
    const sorted = sortByRules(
      [V.beta, V.gamma, V.alpha, V.delta],
      [
        { field: "channel", direction: "asc" },
        { field: "publishedAt", direction: "desc" },
      ]
    ).map((v) => v.videoId);
    // Alpha group newest first: gamma(2025), beta(2023); then Beta: delta; then Zebra: alpha
    expect(sorted).toEqual(["c", "b", "d", "a"]);
  });

  it("pushes missing values to the bottom even for descending sorts", () => {
    const noDuration = video({ videoId: "x", title: "No duration", channel: "Alpha" });
    const sorted = sortByRules(
      [noDuration, V.gamma, V.beta],
      [
        { field: "channel", direction: "asc" },
        { field: "duration", direction: "desc" },
      ]
    ).map((v) => v.videoId);
    // Alpha group duration desc: gamma(120), beta(60), then no-duration x at bottom
    expect(sorted).toEqual(["c", "b", "x"]);
  });

  it("pushes missing viewCount to the bottom for descending view sort", () => {
    const noViews = video({ videoId: "x", title: "No views", channel: "Alpha" });
    const sorted = sortByRules(
      [noViews, V.beta, V.gamma],
      [{ field: "viewCount", direction: "desc" }]
    ).map((v) => v.videoId);
    expect(sorted).toEqual(["b", "c", "x"]);
  });

  it("returns a shallow copy in original order for an empty rules array", () => {
    const input = [V.alpha, V.beta, V.gamma];
    const sorted = sortByRules(input, []);
    expect(sorted.map((v) => v.videoId)).toEqual(["a", "b", "c"]);
    expect(sorted).not.toBe(input);
  });
});

describe("reversePlaylist", () => {
  it("reverses order without mutating the input", () => {
    const input = [V.alpha, V.beta, V.gamma];
    const inputCopy = [...input];
    const reversed = reversePlaylist(input);
    expect(reversed.map((v) => v.videoId)).toEqual(["c", "b", "a"]);
    expect(input).toEqual(inputCopy);
  });
});

describe("describeSortRule / describeSortRules", () => {
  it("describes a single rule", () => {
    expect(describeSortRule({ field: "channel", direction: "asc" })).toBe(
      "Channel (A-Z / Ascending)"
    );
    expect(describeSortRule({ field: "publishedAt", direction: "desc" })).toBe(
      "Release Date (Newest first)"
    );
  });

  it("describes a chain joined with arrows", () => {
    expect(
      describeSortRules([
        { field: "channel", direction: "asc" },
        { field: "duration", direction: "asc" },
      ])
    ).toBe("Channel → Duration");
  });
});
