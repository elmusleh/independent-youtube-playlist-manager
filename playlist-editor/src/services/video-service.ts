/// <reference path="../types/services.d.ts" />

import type { Playlist, NormalizedVideoMeta } from "../types/model.js";
import {
  dbGetMetadata,
  dbGetMetadataBatch,
  dbPutMetadata,
  dbPutMetadataBatch,
  dbDeleteMetadata,
  dbClearMetadata,
  dbGetStats,
} from "./db-service.js";
import { normalizeVideoMeta, sanitizeVideoId } from "./schema-normalizer.js";

window.getMetadataCacheCount = async (): Promise<number> => {
  try {
    const stats = await dbGetStats();
    return stats.totalMetadata;
  } catch {
    return 0;
  }
};

window.clearAllMetadataCache = async (): Promise<void> => {
  try {
    await dbClearMetadata();
    if (typeof window.clearMetadataSessionCache === "function") {
      window.clearMetadataSessionCache();
    }
  } catch (err) {
    console.warn("[VIDEO-SERVICE] Failed to clear metadata cache:", err);
  }
};

interface VideoMetaEntry extends NormalizedVideoMeta {}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for valid entries
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for failed fetches

function hasValidData(entry: any): boolean {
  if (!entry || typeof entry !== "object") return false;
  const title = (entry.title || "").trim();
  const hasTitle = Boolean(title && title !== "undefined" && title !== "null");
  const hasChannel = Boolean(entry.channel && entry.channel !== "undefined" && entry.channel !== "null");
  const hasDuration = Boolean(entry.durationISO || entry.durationSeconds || entry.isLive || entry.isDeleted || entry.isPrivate || entry.isBroken);
  return hasTitle || hasChannel || hasDuration;
}

function isEntryFresh(entry: any): boolean {
  if (!entry) return false;
  return hasValidData(entry);
}

function isNegativeCacheFresh(entry: any): boolean {
  if (!entry || !entry.lastFetchAttempt) return false;
  return (Date.now() - entry.lastFetchAttempt) < NEGATIVE_CACHE_TTL_MS;
}

function isValidAndFresh(entry: any): entry is VideoMetaEntry {
  return hasValidData(entry);
}

window.videoIdCount = 100;

// https://regex101.com/r/rq2KLv/1
window.youtubeRegexPattern =
  /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be\/|be.com\/\S*(?:watch|embed|shorts)(?:(?:(?=\/[-a-zA-Z0-9_]{11,}(?!\S))\/)|(?:\S*v=|v\/)))([-a-zA-Z0-9_]{11,})/.source;

class VideoService {
  YOUTUBE_URL_PREFIX = "https://www.youtube.com/watch?v=";
  THUMBNAIL_URL_PREFIX = "https://i.ytimg.com/vi/";
  THUMBNAIL_URL_SUFFIX = "/default.jpg";

  youtubeServiceURL = (globalThis as any).youtubeServiceURL;

  async getVideoMetadataBatch(videoIds: string[]): Promise<Record<string, VideoMetaEntry>> {
    if (typeof browser === "undefined") return {};
    try {
      const batch = await dbGetMetadataBatch(videoIds);
      const result: Record<string, VideoMetaEntry> = {};
      for (const [id, entry] of Object.entries(batch)) {
        if (isValidAndFresh(entry)) {
          result[id] = entry;
        }
      }
      return result;
    } catch (e) {
      return {};
    }
  }

  async shouldSkipFetch(videoId: string): Promise<boolean> {
    const entry = await dbGetMetadata(videoId);
    if (isValidAndFresh(entry)) return true;
    if (isNegativeCacheFresh(entry)) return true;
    return false;
  }

  async clearCache(videoIds: string[]) {
    if (typeof browser === "undefined") return;
    try {
      await dbDeleteMetadata(videoIds);
    } catch (e) {
      if (window.logSystemEvent) await window.logSystemEvent("WARN", `[VIDEO-SERVICE] Failed to clear cache for ${videoIds.length} videos`);
    }
  }

  async fetchVideo(videoId: string, sessionOnly = false) {
    let title = "";
    let channel = "";
    let duration = "";
    let progress = 0;
    let viewCount: number | undefined = undefined;
    let publishedAt: string | undefined = undefined;
    let isPrivate = false;
    let isDeleted = false;
    let isBroken = false;
    let isLive = false;

    // 1. Check persistent cache first
    let cached: any = null;
    if (typeof browser !== "undefined") {
      try {
        cached = await dbGetMetadata(videoId);
      } catch (e) {
        if (window.logSystemEvent) await window.logSystemEvent("WARN", `[VIDEO-SERVICE] Failed to read cache for ${videoId}`);
      }
    }
    const hasValidData = isValidAndFresh(cached);
    const isRecentNegativeCache = isNegativeCacheFresh(cached);
    if (cached && (hasValidData || isRecentNegativeCache)) {
      return {
        id: window.videoIdCount++,
        videoId,
        url: this.YOUTUBE_URL_PREFIX + videoId,
        title: cached.title || "",
        channel: cached.channel || "",
        duration: cached.durationISO || "",
        durationISO: cached.durationISO || "",
        durationSeconds: cached.durationSeconds ?? window.isoToSecs(cached.durationISO || ""),
        viewCount: cached.viewCount,
        publishedAt: cached.publishedAt,
        isPrivate: cached.isPrivate || false,
        isDeleted: cached.isDeleted || false,
        isBroken: cached.isBroken || false,
        isLive: cached.isLive || false,
        thumbnailUrl: this.getVideoThumbnailUrl(videoId),
      };
    }

    // 2. Session-only mode: return empty stub
    if (sessionOnly) {
      return {
        id: window.videoIdCount++, videoId, url: this.YOUTUBE_URL_PREFIX + videoId,
        title: "", channel: "", thumbnailUrl: this.getVideoThumbnailUrl(videoId),
      };
    }

    // 3. Official YouTube oEmbed API for fast title + channel lookup
    let sessionVideoData = sessionStorage.getItem(videoId);
    if (!sessionVideoData) {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (res.ok) {
          const json = await res.json();
          if (json && json.title) {
            title = json.title;
            channel = json.author_name || "";
            sessionStorage.setItem(videoId, JSON.stringify({ title, channel }));
          }
        }
      } catch (e) {
        if (window.logSystemEvent) await window.logSystemEvent("WARN", `[VIDEO-SERVICE] oEmbed fetch failed for ${videoId}`);
      }
    } else {
      ({ title, channel } = JSON.parse(sessionVideoData));
    }

    // 4. Watch history: backfill title/channel and get progress
    if (typeof browser !== "undefined") {
      try {
        const history = await browser.runtime.sendMessage({ cmd: "get-yph-history", videoId });
        if (history) {
          if (history.dur && history.isCompleted) {
            duration = window.secsToISO(history.dur);
          }
          if (history.t) progress = history.t;
          if (!title && history.title) title = history.title;
          if (!channel && history.channel) channel = history.channel;
        }
      } catch (e) {
        if (window.logSystemEvent) await window.logSystemEvent("WARN", `[VIDEO-SERVICE] History fetch failed for ${videoId}`);
      }
    }

    // 5. Tab scraping fallback
    if (!duration && typeof browser !== "undefined") {
      try {
        const tabs = await browser.tabs.query({ url: "*://*.youtube.com/*" });
        for (const tab of tabs) {
          if (!tab.id || !tab.url) continue;
          const url = new URL(tab.url);
          const tabVideoId = url.searchParams.get("v");
          if (tabVideoId === videoId) {
            const data = await browser.tabs.sendMessage(tab.id, { cmd: "get-video-metadata" });
            if (data && data.durationISO) {
              duration = data.durationISO;
              if (!title && data.title) title = data.title;
              if (!channel && data.channel) channel = data.channel;
              console.log(`[YPH] fetchVideo: Got metadata from open tab for ${videoId}: ${duration}`);
              break;
            }
          }
        }
      } catch (e) {
        if (window.logSystemEvent) await window.logSystemEvent("WARN", `[VIDEO-SERVICE] Tab scraping failed for ${videoId}`);
      }
    }

    // 6. Multi-tier metadata engine (Data API, Innertube, Embed Page, Piped/Invidious, oEmbed)
    if ((!duration || !title) && typeof window.ytFetchVideoDurations === "function") {
      try {
        if (typeof window.clearMetadataSessionCache === "function") {
          window.clearMetadataSessionCache([videoId]);
        }
        const map = await window.ytFetchVideoDurations([videoId]);
        const meta = map.get(videoId);
        if (meta) {
          if (typeof meta === "string") {
            duration = meta;
          } else {
            duration = meta.duration || meta.durationISO || duration;
            if (!viewCount) viewCount = meta.viewCount;
            if (!publishedAt) publishedAt = meta.publishedAt;
            isPrivate = meta.isPrivate || false;
            isDeleted = meta.isDeleted || false;
            isBroken = meta.isBroken || false;
            isLive = meta.isLive || false;
            if (meta.title && !title) title = meta.title;
            if (meta.channel && !channel) channel = meta.channel;
          }
        }
      } catch (e) {
        if (window.logSystemEvent) await window.logSystemEvent("WARN", `[VIDEO-SERVICE] Multi-tier metadata fetch failed for ${videoId}`);
      }
    }

    // 7. Write to persistent cache (per-video via dbPutMetadata with transactional integrity & schema normalization)
    if (typeof browser !== "undefined") {
      try {
        const existing = await dbGetMetadata(videoId);
        const entry = normalizeVideoMeta(
          {
            videoId,
            title: title || existing?.title || "",
            channel: channel || existing?.channel || "",
            durationISO: duration || existing?.durationISO || "",
            durationSeconds: window.isoToSecs(duration || existing?.durationISO || ""),
            viewCount: viewCount !== undefined ? viewCount : existing?.viewCount,
            publishedAt: publishedAt || existing?.publishedAt,
            isPrivate: isPrivate || existing?.isPrivate || false,
            isDeleted: isDeleted || existing?.isDeleted || false,
            isBroken: isBroken || existing?.isBroken || false,
            isLive: isLive || existing?.isLive || false,
            lastFetchAttempt: Date.now(),
            lastCachedAt: title || duration ? Date.now() : existing?.lastCachedAt,
          },
          videoId
        );

        await dbPutMetadata(videoId, entry);
      } catch (e) {
        if (window.logSystemEvent) await window.logSystemEvent("WARN", `[VIDEO-SERVICE] Failed to write cache for ${videoId}`);
      }
    }

    return {
      id: window.videoIdCount++,
      videoId,
      url: this.YOUTUBE_URL_PREFIX + videoId,
      title,
      channel: channel,
      durationISO: duration,
      durationSeconds: window.isoToSecs(duration),
      viewCount,
      publishedAt,
      isPrivate,
      isDeleted,
      isBroken,
      isLive,
      progress,
      thumbnailUrl: this.getVideoThumbnailUrl(videoId),
    };
  }

  async cacheMetadata(metadata: Record<string, any>) {
    if (typeof browser === "undefined") return;
    try {
      await dbPutMetadataBatch(metadata);
    } catch (e) {
      /* ignore */
    }
  }

  getVideoThumbnailUrl(videoId: string) {
    if (!videoId) {
      return null;
    }
    return this.THUMBNAIL_URL_PREFIX + videoId + this.THUMBNAIL_URL_SUFFIX;
  }

  parseYoutubeId(url: string) {
    const result = RegExp(window.youtubeRegexPattern, "i").exec(url);
    if (result && result.length > 1) {
      return result[1];
    }
    return null;
  }

  parseYoutubeIds(text: string) {
    let matches: RegExpExecArray | null;
    let videoIds: string[] = [];
    const regex = RegExp(window.youtubeRegexPattern, "ig");
    while ((matches = regex.exec(text))) {
      videoIds.push(matches[1]);
    }
    return videoIds;
  }

  async generatePlaylist(videoIds?: string[], title?: string) {
    const id = await window.generatePlaylistId();
    const date = new Date();
    return {
      id,
      title: title ?? date.toLocaleString(),
      videos: videoIds || [],
      timestamp: date.getTime(),
    };
  }

  openPlaylistEditor(playlist: Playlist) {
    const previousPage =
      location.hash.length > 0 ? location.hash.substring(1) : "/";
    history.pushState({ playlist, previousPage }, "", "#/editor");
    window.dispatchEvent(new Event("hashchange"));
  }

  async openPlaylist(videoIds: string[], playlistId?: string) {
    if (window.logSystemEvent) await window.logSystemEvent("INFO", `[VIDEO-SERVICE] Opening playlist with ${videoIds.length} videos`);

    let t = 0;
    if (playlistId && playlistId.startsWith("local-") && typeof browser !== "undefined") {
      try {
        const history = await browser.runtime.sendMessage({ cmd: "get-yph-history", videoId: videoIds[0] });
        if (history && history.t) {
          t = Math.floor(history.t);
          if (window.logSystemEvent) await window.logSystemEvent("INFO", `[VIDEO-SERVICE] Resuming ${videoIds[0]} at ${t}s from history`);
        }
      } catch (e) {
        console.error("Failed to fetch history:", e);
      }
    }

    const settings = await window.getSettings();
    const signedIn = await window.isSignedIn();

    const chunkEnabled = settings.playAllChunkEnabled && settings.playAllChunkSize > 0;

    const chunks: string[][] = [];
    if (chunkEnabled) {
      for (let i = 0; i < videoIds.length; i += settings.playAllChunkSize) {
        chunks.push(videoIds.slice(i, i + settings.playAllChunkSize));
      }
    } else {
      chunks.push(videoIds);
    }

    if (window.logSystemEvent) await window.logSystemEvent("INFO", `[VIDEO-SERVICE] Play All: ${videoIds.length} videos, chunking=${chunkEnabled ? settings.playAllChunkSize : "off"}, ${chunks.length} tab(s)`);

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const firstVideoId = chunk[0];
      let url = "";

      if (playlistId && playlistId !== "WL" && !playlistId.startsWith("local-") && !chunkEnabled) {
        url = `https://www.youtube.com/watch?v=${firstVideoId}&list=${playlistId}`;
        if (window.logSystemEvent) await window.logSystemEvent("INFO", `[VIDEO-SERVICE] Sync: Using &list= param`, { url });
      } else {
        const allIds = chunk.join(",");
        url = `${this.youtubeServiceURL || "https://www.youtube.com"}/watch_videos?video_ids=${allIds}`;
        if (window.logSystemEvent) await window.logSystemEvent("INFO", `[VIDEO-SERVICE] Offline/Guest: Using watch_videos generator`, { url });
      }

      if (idx === 0 && playlistId && playlistId.startsWith("local-")) {
        if (t > 0) {
          const separator = url.includes("?") ? "&" : "?";
          url += `${separator}t=${t}s`;
        }
        url = url.split("#")[0] + `#yph_local_list=${playlistId}`;
      }

      if (window.logSystemEvent) await window.logSystemEvent("INFO", `[VIDEO-SERVICE] Opening tab ${idx + 1}/${chunks.length}: ${url}`);

      if (typeof browser != "undefined") {
        await browser.tabs.create({ url });
      } else {
        window.open(url, "_blank");
      }
    }
  }
}

window.videoService = new VideoService();

export type { VideoService };
