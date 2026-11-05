/**
 * Metadata completeness helpers.
 *
 * A metadata entry is only "complete" when it carries a real title, channel and
 * duration. Two historical bugs made entries look complete when they were not:
 *
 * 1. `lengthSeconds === 0` was used to *infer* a live stream, and `isLive`
 *    satisfied the duration requirement — so a video whose duration was simply
 *    missing was permanently marked live and never re-fetched by another tier.
 * 2. `secsToISO(0)` produced the truthy string `"PT0S"`, which also satisfied the
 *    duration requirement.
 *
 * Both are fixed here: live-ness is only accepted when it was explicitly reported
 * by a source, and a zero-length, non-live entry is treated as missing duration.
 *
 * ## Terminal entries
 *
 * A private, deleted, broken or confirmed-unavailable video can never gain more
 * data without external change. Such an entry is
 * considered *resolved* even though it is not complete field-by-field. Keep the
 * two ideas apart:
 *
 * - `getMetadataGaps(meta).complete` — field level: title && channel && duration
 * - `hasCompleteMetadata(meta)`      — resolved: field level complete OR terminal
 *
 * `collectMetadataGaps()` counts against the *resolved* definition so that
 * `complete + needsAttention === total` always holds, and every consumer (nav
 * badge, stat cards, gaps list) reports the same number.
 */

export type MetadataGapReason = "missing_title" | "missing_channel" | "missing_duration" | "empty";

export interface MetadataGap {
  /** Title is missing or a placeholder */
  missingTitle: boolean;
  /** Channel is missing or a placeholder */
  missingChannel: boolean;
  /** Duration is missing and the entry is not a live/upcoming stream */
  missingDuration: boolean;
  /** No usable data at all (nothing worth persisting) */
  empty: boolean;
  /** The entry can never gain more data (private/deleted/broken/unavailable) */
  terminal: boolean;
  /** Nothing is missing at field level (title + channel + duration) */
  complete: boolean;
  /** Machine-readable list of reasons, in a stable order */
  reasons: MetadataGapReason[];
}

const PLACEHOLDER_TITLES = new Set([
  "",
  "undefined",
  "null",
  "private video",
  "deleted video",
  "[private video]",
  "[deleted video]",
]);

const PLACEHOLDER_CHANNELS = new Set([
  "",
  "undefined",
  "null",
  "private channel",
  "deleted channel",
]);

/**
 * Decode a duration into whole seconds. Accepts ISO-8601 (`PT1H2M3S`), clock
 * notation (`1:02:03`, `2:03`) and a plain number of seconds. Returns 0 for
 * anything unparseable — callers treat that as "missing", never as "zero length".
 */
export function durationStringToSeconds(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  if (typeof value !== "string") return 0;

  const raw = value.trim();
  if (!raw) return 0;

  if (/^P/i.test(raw)) {
    const m = raw.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
    if (!m) return 0;
    const [, d, h, min, sec] = m;
    const total =
      Number(d || 0) * 86400 +
      Number(h || 0) * 3600 +
      Number(min || 0) * 60 +
      Math.floor(Number(sec || 0));
    return total > 0 ? total : 0;
  }

  if (/^\d+(:\d{1,2}){1,2}$/.test(raw)) {
    const total = raw
      .split(":")
      .map(Number)
      .reduce((acc, part) => acc * 60 + part, 0);
    return total > 0 ? total : 0;
  }

  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

/** True only when the source explicitly reported a live/upcoming stream. */
export function isLiveStream(meta: any): boolean {
  return Boolean(meta && meta.isLive === true);
}

/** True when no further tier could ever add data for this entry. */
export function isTerminalEntry(meta: any): boolean {
  return Boolean(meta && (meta.isUnavailable || meta.isPrivate || meta.isDeleted || meta.isBroken));
}

/** True when the entry carries a usable (non-zero) duration. */
export function hasDuration(meta: any): boolean {
  if (!meta) return false;
  if (isLiveStream(meta)) return true;
  if (durationStringToSeconds(meta.durationISO) > 0) return true;
  if (durationStringToSeconds(meta.durationSeconds) > 0) return true;
  return durationStringToSeconds(meta.duration) > 0;
}

/** True when the entry carries a usable title. */
export function hasTitle(meta: any): boolean {
  const title = typeof meta?.title === "string" ? meta.title.trim() : "";
  return title !== "" && !PLACEHOLDER_TITLES.has(title.toLowerCase());
}

/** True when the entry carries a usable channel. */
export function hasChannel(meta: any): boolean {
  const channel = typeof meta?.channel === "string" ? meta.channel.trim() : "";
  return channel !== "" && !PLACEHOLDER_CHANNELS.has(channel.toLowerCase());
}

/**
 * Compute exactly which fields are missing from a metadata entry.
 */
export function getMetadataGaps(meta: any): MetadataGap {
  const missingTitle = !hasTitle(meta);
  const missingChannel = !hasChannel(meta);
  const missingDuration = !hasDuration(meta);
  const terminal = isTerminalEntry(meta);
  const empty = Boolean(meta) && !hasTitle(meta) && !hasChannel(meta) && !hasDuration(meta);

  const reasons: MetadataGapReason[] = [];
  if (missingTitle) reasons.push("missing_title");
  if (missingChannel) reasons.push("missing_channel");
  if (missingDuration) reasons.push("missing_duration");
  if (empty) reasons.push("empty");

  return {
    missingTitle,
    missingChannel,
    missingDuration,
    empty,
    terminal,
    complete: !missingTitle && !missingChannel && !missingDuration,
    reasons,
  };
}

/**
 * True when the entry has enough data to be considered resolved.
 * Private/deleted/broken entries are treated as resolved — they are known states.
 */
export function hasCompleteMetadata(meta: any): boolean {
  if (!meta) return false;
  if (isTerminalEntry(meta)) return true;
  return getMetadataGaps(meta).complete;
}

/**
 * True when the entry still needs work. Single definition shared by the nav
 * badge, the summary counters and the gaps list.
 */
export function needsAttention(meta: any): boolean {
  return !hasCompleteMetadata(meta);
}

/**
 * True when an entry has a title and channel but no duration, and is not a live
 * stream — i.e. a *duration-only* recovery is worth attempting.
 */
export function needsDurationRefresh(meta: any): boolean {
  if (!meta) return false;
  if (isTerminalEntry(meta)) return false;
  if (isLiveStream(meta)) return false;
  return hasTitle(meta) && hasChannel(meta) && !hasDuration(meta);
}

export interface MetadataGapSummary {
  total: number;
  /** Resolved entries (fully populated, or terminal) */
  complete: number;
  /** Unresolved entries — always `total - complete` */
  needsAttention: number;
  missingDuration: number;
  missingTitle: number;
  missingChannel: number;
  /** title + channel present but duration missing (duration-only recovery candidates) */
  durationRecoverable: number;
  live: number;
  terminal: number;
  empty: number;
  /** videoIds that need a duration-only recovery pass */
  recoverableIds: string[];
}

/**
 * Aggregate gap statistics over a collection of metadata entries.
 * Accepts a record keyed by videoId or an iterable of entries.
 *
 * Invariant: `complete + needsAttention === total`.
 */
export function collectMetadataGaps(
  entries: Record<string, any> | Iterable<any> | null | undefined
): MetadataGapSummary {
  const summary: MetadataGapSummary = {
    total: 0,
    complete: 0,
    needsAttention: 0,
    missingDuration: 0,
    missingTitle: 0,
    missingChannel: 0,
    durationRecoverable: 0,
    live: 0,
    terminal: 0,
    empty: 0,
    recoverableIds: [],
  };

  const visit = (id: string, meta: any) => {
    summary.total++;

    if (!meta || typeof meta !== "object") {
      summary.empty++;
      summary.needsAttention++;
      return;
    }

    const gaps = getMetadataGaps(meta);

    if (gaps.empty) summary.empty++;
    if (gaps.missingTitle) summary.missingTitle++;
    if (gaps.missingChannel) summary.missingChannel++;
    if (gaps.missingDuration) summary.missingDuration++;
    if (isTerminalEntry(meta)) summary.terminal++;
    if (isLiveStream(meta)) summary.live++;

    if (needsDurationRefresh(meta)) {
      summary.durationRecoverable++;
      if (id) summary.recoverableIds.push(id);
    }

    if (hasCompleteMetadata(meta)) summary.complete++;
    else summary.needsAttention++;
  };

  if (
    entries &&
    !Array.isArray(entries) &&
    typeof (entries as any)[Symbol.iterator] !== "function"
  ) {
    for (const [id, meta] of Object.entries(entries as Record<string, any>)) {
      visit(id, meta);
    }
  } else if (entries) {
    let index = 0;
    for (const meta of entries as Iterable<any>) {
      visit((meta && meta.videoId) || String(index++), meta);
    }
  }

  return summary;
}
