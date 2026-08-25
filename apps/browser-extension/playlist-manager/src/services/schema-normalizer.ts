import type { NormalizedVideoMeta, Playlist } from "../types/model.js";

/**
 * Converts seconds to ISO 8601 duration format (e.g. PT5M30S)
 */
export function secsToISO(secs: number): string {
  if (isNaN(secs) || secs < 0) return "";
  const s = Math.round(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return "PT" + (h ? `${h}H` : "") + (m ? `${m}M` : "") + (sec || (!h && !m) ? `${sec}S` : "");
}

/**
 * Converts ISO 8601 duration to seconds
 */
export function isoToSecs(iso: string): number {
  if (!iso || typeof iso !== "string" || iso === "LIVE") return 0;
  const match = iso.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  const d = parseInt(match[1] || "0", 10);
  const h = parseInt(match[2] || "0", 10);
  const m = parseInt(match[3] || "0", 10);
  const s = parseFloat(match[4] || "0");
  return d * 86400 + h * 3600 + m * 60 + Math.floor(s);
}

/**
 * Extracts a clean 11-character YouTube video ID if an arbitrary string/URL is passed
 */
export function sanitizeVideoId(input: string): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Enforces rigid schema on arbitrary scraped or cached video metadata
 */
export function normalizeVideoMeta(raw: any, fallbackId = ""): NormalizedVideoMeta {
  if (!raw || typeof raw !== "object") {
    raw = {};
  }

  const videoId = sanitizeVideoId(raw.videoId || fallbackId);
  const rawTitle = typeof raw.title === "string" ? raw.title.trim() : "";
  const title = rawTitle === "undefined" || rawTitle === "null" ? "" : rawTitle;

  const rawChannel =
    typeof raw.channel === "string"
      ? raw.channel.trim()
      : typeof raw.author === "string"
        ? raw.author.trim()
        : "";
  const channel = rawChannel === "undefined" || rawChannel === "null" ? "" : rawChannel;

  let durationSeconds = 0;
  if (
    typeof raw.durationSeconds === "number" &&
    !isNaN(raw.durationSeconds) &&
    raw.durationSeconds >= 0
  ) {
    durationSeconds = Math.round(raw.durationSeconds);
  } else if (
    typeof raw.lengthSeconds === "number" &&
    !isNaN(raw.lengthSeconds) &&
    raw.lengthSeconds >= 0
  ) {
    durationSeconds = Math.round(raw.lengthSeconds);
  } else if (typeof raw.lengthSeconds === "string" && !isNaN(parseInt(raw.lengthSeconds, 10))) {
    durationSeconds = Math.max(0, parseInt(raw.lengthSeconds, 10));
  } else if (typeof raw.durationISO === "string" && raw.durationISO) {
    durationSeconds = isoToSecs(raw.durationISO);
  } else if (typeof raw.duration === "string" && raw.duration) {
    durationSeconds = isoToSecs(raw.duration);
  }

  let isLive =
    raw.isLive === true ||
    raw.isLiveContent === true ||
    raw.duration === "LIVE" ||
    raw.durationISO === "LIVE";
  let isPrivate = raw.isPrivate === true;
  let isDeleted = raw.isDeleted === true;
  let isBroken = raw.isBroken === true;

  if (title === "Private video") isPrivate = true;
  if (title === "Deleted video") isDeleted = true;

  let durationISO = "";
  if (isLive) {
    durationISO = "LIVE";
  } else if (typeof raw.durationISO === "string" && raw.durationISO.startsWith("PT")) {
    durationISO = raw.durationISO;
  } else if (typeof raw.duration === "string" && raw.duration.startsWith("PT")) {
    durationISO = raw.duration;
  } else if (durationSeconds > 0) {
    durationISO = secsToISO(durationSeconds);
  }

  let viewCount: number | undefined = undefined;
  if (typeof raw.viewCount === "number" && !isNaN(raw.viewCount) && raw.viewCount >= 0) {
    viewCount = Math.floor(raw.viewCount);
  } else if (typeof raw.viewCount === "string" && !isNaN(parseInt(raw.viewCount, 10))) {
    viewCount = Math.max(0, parseInt(raw.viewCount, 10));
  }

  let publishedAt: string | undefined = undefined;
  if (typeof raw.publishedAt === "string" && raw.publishedAt.trim()) {
    publishedAt = raw.publishedAt.trim();
  }

  const lastCachedAt =
    typeof raw.lastCachedAt === "number" && raw.lastCachedAt > 0 ? raw.lastCachedAt : Date.now();

  const lastFetchAttempt =
    typeof raw.lastFetchAttempt === "number" && raw.lastFetchAttempt > 0
      ? raw.lastFetchAttempt
      : undefined;

  return {
    videoId,
    title,
    channel,
    durationISO,
    durationSeconds,
    viewCount,
    publishedAt,
    isPrivate,
    isDeleted,
    isBroken,
    isLive,
    lastCachedAt,
    lastFetchAttempt,
  };
}

/**
 * Validates and normalizes playlist records
 */
export function normalizePlaylist(raw: any, fallbackId = ""): Playlist {
  if (!raw || typeof raw !== "object") {
    raw = {};
  }

  const id = String(raw.id || fallbackId || `local-${Date.now()}`);
  const rawTitle = typeof raw.title === "string" ? raw.title.trim() : "";
  const title = rawTitle || "Untitled Playlist";

  let videos: string[] = [];
  if (Array.isArray(raw.videos)) {
    const seen = new Set<string>();
    for (const v of raw.videos) {
      const vid = sanitizeVideoId(typeof v === "string" ? v : v?.videoId || "");
      if (vid && !seen.has(vid)) {
        seen.add(vid);
        videos.push(vid);
      }
    }
  }

  const timestamp =
    typeof raw.timestamp === "number" && raw.timestamp > 0 ? raw.timestamp : Date.now();

  return {
    id,
    title,
    videos,
    timestamp,
    saved: raw.saved === true,
    isLocal: raw.isLocal !== false,
    isTagged: raw.isTagged === true,
    isDirty: raw.isDirty === true,
    isPermanent: raw.isPermanent === true,
  };
}

/**
 * Validates watch history entries
 */
export function normalizeHistoryRecord(
  raw: any,
  videoId: string
): {
  videoId: string;
  t: number;
  dur: number;
  lastUpdated: number;
  isCompleted: boolean;
  title?: string;
  channel?: string;
} {
  if (!raw || typeof raw !== "object") {
    raw = {};
  }
  const cleanId = sanitizeVideoId(videoId || raw.videoId || "");
  const t = Math.max(0, typeof raw.t === "number" ? raw.t : 0);
  const dur = Math.max(0, typeof raw.dur === "number" ? raw.dur : 0);
  const lastUpdated =
    typeof raw.lastUpdated === "number" && raw.lastUpdated > 0 ? raw.lastUpdated : Date.now();
  const isCompleted = raw.isCompleted === true || (dur > 0 && t >= dur * 0.95);

  return {
    videoId: cleanId,
    t,
    dur,
    lastUpdated,
    isCompleted,
    title: typeof raw.title === "string" ? raw.title.trim() : undefined,
    channel: typeof raw.channel === "string" ? raw.channel.trim() : undefined,
  };
}
