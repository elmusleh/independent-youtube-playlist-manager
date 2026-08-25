import type { SortDirection, SortField, SortRule, Video } from "../types/model";
import { isoToSecs } from "../services/schema-normalizer.js";

export type { SortRule, SortField, SortDirection };

/**
 * Returns true when the video has no usable value for the given field.
 * Missing values are always pushed to the BOTTOM of the sorted list,
 * regardless of sort direction.
 */
function isMissing(video: Video, field: SortField): boolean {
  switch (field) {
    case "title": {
      const title = (video.title || "").trim();
      return !title || title === "undefined";
    }
    case "channel": {
      const channel = (video.channel || "").trim();
      return !channel || channel === "undefined";
    }
    case "duration":
      return video.durationSeconds === undefined && !video.durationISO && !video.duration;
    case "publishedAt": {
      if (!video.publishedAt) return true;
      return isNaN(new Date(video.publishedAt).getTime());
    }
    case "viewCount":
      return video.viewCount === undefined;
  }
}

/**
 * Compares two videos on a single field/direction.
 * Missing values are always pushed to the bottom (return 1 for `a` missing,
 * -1 for `b` missing) independent of the requested direction.
 */
function compareField(a: Video, b: Video, field: SortField, direction: SortDirection): number {
  const aMissing = isMissing(a, field);
  const bMissing = isMissing(b, field);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  const multiplier = direction === "desc" ? -1 : 1;
  let cmp = 0;

  switch (field) {
    case "title":
      cmp = (a.title || "").localeCompare(b.title || "", undefined, {
        numeric: true,
        sensitivity: "base",
      });
      break;
    case "channel":
      cmp = (a.channel || "").localeCompare(b.channel || "", undefined, {
        numeric: true,
        sensitivity: "base",
      });
      break;
    case "duration": {
      const durA =
        a.durationSeconds !== undefined
          ? a.durationSeconds
          : isoToSecs(a.durationISO || a.duration || "");
      const durB =
        b.durationSeconds !== undefined
          ? b.durationSeconds
          : isoToSecs(b.durationISO || b.duration || "");
      cmp = durA - durB;
      break;
    }
    case "publishedAt":
      cmp = new Date(a.publishedAt!).getTime() - new Date(b.publishedAt!).getTime();
      break;
    case "viewCount":
      cmp = (a.viewCount ?? 0) - (b.viewCount ?? 0);
      break;
  }

  return cmp * multiplier;
}

/**
 * Chained comparator: evaluates the ordered rule chain and returns the first
 * non-zero comparison result. If all rules tie, returns 0.
 */
export function compareVideos(a: Video, b: Video, rules: SortRule[]): number {
  for (const rule of rules) {
    const result = compareField(a, b, rule.field, rule.direction);
    if (result !== 0) return result;
  }
  return 0;
}

/**
 * Returns a NEW array sorted by the given rule chain (original array untouched).
 * An empty rules array returns a shallow copy in the original order.
 */
export function sortByRules(videos: Video[], rules: SortRule[]): Video[] {
  if (!rules || rules.length === 0) return [...videos];
  return [...videos].sort((a, b) => compareVideos(a, b, rules));
}

// --- Single-field sorters (kept for backward compatibility) -----------------

export const sortByTitle = (videos: Video[]) =>
  sortByRules(videos, [{ field: "title", direction: "asc" }]);

export const sortByChannel = (videos: Video[]) =>
  sortByRules(videos, [{ field: "channel", direction: "asc" }]);

export const sortByDuration = (videos: Video[]) =>
  sortByRules(videos, [{ field: "duration", direction: "asc" }]);

export const sortByViewCount = (videos: Video[]) =>
  sortByRules(videos, [{ field: "viewCount", direction: "desc" }]);

export const sortByReleaseDate = (videos: Video[]) =>
  sortByRules(videos, [{ field: "publishedAt", direction: "desc" }]);

export const reversePlaylist = (videos: Video[]) => [...videos].reverse();

// --- Presets & labels -------------------------------------------------------

export interface SortPreset {
  id: string;
  label: string;
  rules: SortRule[];
  /** Compound presets group multiple criteria (rendered in their own section). */
  compound?: boolean;
}

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  title: "Title",
  channel: "Channel",
  duration: "Duration",
  publishedAt: "Release Date",
  viewCount: "View Count",
};

export const SORT_PRESETS: SortPreset[] = [
  // Single-field presets
  { id: "title-az", label: "Title (A-Z)", rules: [{ field: "title", direction: "asc" }] },
  { id: "title-za", label: "Title (Z-A)", rules: [{ field: "title", direction: "desc" }] },
  { id: "channel-az", label: "Channel (A-Z)", rules: [{ field: "channel", direction: "asc" }] },
  { id: "channel-za", label: "Channel (Z-A)", rules: [{ field: "channel", direction: "desc" }] },
  {
    id: "duration-asc",
    label: "Duration (Shortest first)",
    rules: [{ field: "duration", direction: "asc" }],
  },
  {
    id: "duration-desc",
    label: "Duration (Longest first)",
    rules: [{ field: "duration", direction: "desc" }],
  },
  {
    id: "published-desc",
    label: "Release Date (Newest first)",
    rules: [{ field: "publishedAt", direction: "desc" }],
  },
  {
    id: "published-asc",
    label: "Release Date (Oldest first)",
    rules: [{ field: "publishedAt", direction: "asc" }],
  },
  {
    id: "views-desc",
    label: "View Count (Most viewed)",
    rules: [{ field: "viewCount", direction: "desc" }],
  },
  {
    id: "views-asc",
    label: "View Count (Least viewed)",
    rules: [{ field: "viewCount", direction: "asc" }],
  },
  // Compound presets
  {
    id: "channel-title",
    label: "Channel → Title (A-Z)",
    rules: [
      { field: "channel", direction: "asc" },
      { field: "title", direction: "asc" },
    ],
    compound: true,
  },
  {
    id: "channel-duration",
    label: "Channel → Duration (Short to Long)",
    rules: [
      { field: "channel", direction: "asc" },
      { field: "duration", direction: "asc" },
    ],
    compound: true,
  },
  {
    id: "channel-published",
    label: "Channel → Release Date (Newest first)",
    rules: [
      { field: "channel", direction: "asc" },
      { field: "publishedAt", direction: "desc" },
    ],
    compound: true,
  },
];

/** Human-readable label for a single rule, e.g. "Channel (A-Z / Ascending)". */
export function describeSortRule(rule: SortRule): string {
  const directionLabel =
    rule.direction === "asc"
      ? rule.field === "duration"
        ? "Shortest first"
        : rule.field === "publishedAt"
          ? "Oldest first"
          : rule.field === "viewCount"
            ? "Least viewed"
            : "A-Z / Ascending"
      : rule.field === "duration"
        ? "Longest first"
        : rule.field === "publishedAt"
          ? "Newest first"
          : rule.field === "viewCount"
            ? "Most viewed"
            : "Z-A / Descending";
  return `${SORT_FIELD_LABELS[rule.field]} (${directionLabel})`;
}

/** Human-readable label for a rule chain, e.g. "Channel → Release Date". */
export function describeSortRules(rules: SortRule[]): string {
  if (!rules || rules.length === 0) return "";
  return rules.map((r) => SORT_FIELD_LABELS[r.field]).join(" → ");
}
