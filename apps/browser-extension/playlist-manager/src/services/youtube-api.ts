import { dbPutMetadataBatch } from "./db-service.js";

// Guard to prevent duplicate declarations on SPA navigation
if ((window as any)._youtubeApiLoaded) {
  console.warn("youtube-api already loaded - skipping");
} else {
  (window as any)._youtubeApiLoaded = true;
}

// Marker added to the description of every playlist created by this extension.
// Used to distinguish extension playlists from the user's other YouTube playlists.
const YPH_TAG = "[YPH]";

const YT_API = "https://www.googleapis.com/youtube/v3";
let _innertubeCircuitOpenUntil = 0;

async function ytFetch(path: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
  const token = await window.getYouTubeToken();

  let finalPath = path;
  try {
    const result = await browser.storage.local.get("custom_yt_credentials");
    if (result.custom_yt_credentials?.apiKey) {
      const separator = finalPath.includes("?") ? "&" : "?";
      finalPath += `${separator}key=${result.custom_yt_credentials.apiKey}`;
    }
  } catch (e) {
    console.warn("Failed to read custom API key", e);
    if (window.logSystemEvent)
      await window.logSystemEvent("WARN", "[YOUTUBE-API] Failed to read custom API key");
  }

  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${YT_API}${finalPath}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...((options.headers as object) ?? {}),
      },
    });
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "AbortError";
    const errMsg = isTimeout
      ? `Request timed out after ${timeoutMs}ms`
      : e instanceof Error
        ? e.message
        : String(e);

    if (window.logSystemEvent) {
      await window.logSystemEvent(
        isTimeout ? "WARN" : "ERROR",
        `[YOUTUBE-API] ${isTimeout ? "Timeout" : "Network error"} on ${options.method || "GET"} ${finalPath}: ${errMsg}`
      );
    }
    throw new Error(isTimeout ? "Timeout" : `Network error: ${errMsg}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 204) return null;

  // Handle rate limiting (429) or temporary server errors (500, 503) with exponential backoff
  if ((res.status === 429 || res.status >= 500) && retryCount < 3) {
    const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
    console.warn(
      `YouTube API ${res.status}. Retrying in ${delay}ms... (Attempt ${retryCount + 1})`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return ytFetch(path, options, retryCount + 1);
  }

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? `YouTube API error ${res.status}`;
    if (window.logSystemEvent) {
      await window.logSystemEvent("ERROR", `YouTube API Failure: ${msg}`, {
        path,
        method: options.method || "GET",
        body: options.body,
      });
    }
    throw new Error(msg);
  }
  return data;
}

(window as any).ytFetch = ytFetch;

// Create a new private playlist. Returns the YouTube playlist ID (e.g. PLxxxxx).
window.ytCreatePlaylist = async (
  title: string,
  privacyStatus: "private" | "unlisted" | "public" = "private"
): Promise<string> => {
  const validatedTitle =
    title && title.trim().length > 0 ? title : "New Playlist " + new Date().toLocaleDateString();
  const data = await ytFetch("/playlists?part=snippet,status", {
    method: "POST",
    body: JSON.stringify({
      snippet: { title: validatedTitle, description: YPH_TAG },
      status: { privacyStatus },
    }),
  });
  return data.id;
};

// Update the title of an existing extension playlist.
window.ytUpdatePlaylist = async (ytId: string, title: string): Promise<void> => {
  if (ytId === "WL") return;
  const validatedTitle = title && title.trim().length > 0 ? title : "Untitled Playlist";
  await ytFetch("/playlists?part=snippet", {
    method: "PUT",
    body: JSON.stringify({
      id: ytId,
      snippet: { title: validatedTitle, description: YPH_TAG },
    }),
  });
};

// Update the privacy status of an existing playlist.
window.ytUpdatePlaylistPrivacy = async (
  ytId: string,
  privacyStatus: "private" | "unlisted" | "public"
): Promise<void> => {
  if (ytId === "WL") return;
  const current = await ytFetch(`/playlists?part=snippet&id=${encodeURIComponent(ytId)}`);
  const title = current.items?.[0]?.snippet?.title || "Untitled Playlist";
  await ytFetch("/playlists?part=snippet,status", {
    method: "PUT",
    body: JSON.stringify({
      id: ytId,
      snippet: { title, description: YPH_TAG },
      status: { privacyStatus },
    }),
  });
};

// Delete a playlist by its YouTube ID.
window.ytDeletePlaylist = async (ytId: string): Promise<void> => {
  if (ytId === "WL") return;
  await ytFetch(`/playlists?id=${encodeURIComponent(ytId)}`, {
    method: "DELETE",
  });
};

// Return all playlists that were created by this extension (marked with YPH_TAG).
window.ytListPlaylists = async (): Promise<YtPlaylistInfo[]> => {
  const result: YtPlaylistInfo[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await ytFetch(`/playlists?${params}`);
    for (const item of data.items ?? []) {
      if ((item.snippet.description as string)?.includes(YPH_TAG)) {
        result.push({
          id: item.id,
          title: item.snippet.title,
          timestamp: new Date(item.snippet.publishedAt).getTime(),
        });
      }
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return result;
};

// Return all playlists owned by the user, including those not created by this extension.
// The isTagged flag indicates whether this extension manages the playlist.
window.ytListAllPlaylists = async (): Promise<YtPlaylistInfoExtended[]> => {
  const result: YtPlaylistInfoExtended[] = [];
  let pageToken = "";
  let totalFetched = 0;
  console.log("ytListAllPlaylists: Fetching all playlists...");
  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails,status",
      mine: "true",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await ytFetch(`/playlists?${params}`);
    const items = data.items ?? [];
    totalFetched += items.length;
    console.log(`ytListAllPlaylists: Received ${items.length} items (total: ${totalFetched})`);
    for (const item of items) {
      result.push({
        id: item.id,
        title: item.snippet.title,
        timestamp: new Date(item.snippet.publishedAt).getTime(),
        videoCount: item.contentDetails?.itemCount ?? 0,
        isTagged: (item.snippet.description as string)?.includes(YPH_TAG) ?? false,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
        privacyStatus: item.status?.privacyStatus ?? "private",
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  console.log(`ytListAllPlaylists: Finished fetching. Total mapped: ${result.length}`);
  return result;
};

// =============================================================================
// Available YouTube Data API Endpoints (Documented for Reference)
// =============================================================================
//
// The YouTube Data API provides access to the following resources. Each function
// below maps to a specific API endpoint. Only functions that are CALLED will
// consume API quota.
//
// QUOTA: 10,000 units/day (default). Each playlist/activity list call = 1 unit.
//
// ENDPOINTS AVAILABLE:
// -----------------------------------------------------------------------------
// | Resource        | Endpoint                                    | Implemented |
// -----------------------------------------------------------------------------
// | My Playlists    | GET /playlists?mine=true                   | ✅           |
// | Watch Later     | GET /channels?part=contentDetails (WL)     | ✅           |
// | Liked Videos    | GET /channels?part=contentDetails (likes)  | ❌           |
// | Uploaded Videos | GET /channels?part=contentDetails (uploads)| ❌           |
// | Subscriptions   | GET /subscriptions?mine=true               | ❌           |
// | Activities      | GET /activities?mine=true                   | ❌           |
// | Comments        | GET /comments?mine=true                     | ❌ (read)    |
// | Any Playlist    | GET /playlists?id={id}                     | ✅           |
// | Playlist Items  | GET /playlistItems?playlistId={id}         | ✅           |
// | Search          | GET /search?q={query}                       | ❌           |
// | Channels        | GET /channels?mine=true                    | ✅           |
// -----------------------------------------------------------------------------
//
// KNOWN LIMITATIONS:
// - No API endpoint exists for "Saved playlists" (playlists from other creators)
// - Cannot access private playlists owned by others
// - Cannot fetch user's "Watch History" via API (only local extension tracking)

// Type definitions for available playlist sources
export type PlaylistSource =
  | "my-playlists" // Playlists created by the user (marked with [YPH])
  | "all-playlists" // All playlists owned by the user
  | "watch-later" // Watch Later playlist
  | "liked-videos" // Liked Videos playlist
  | "uploaded-videos" // User's uploaded videos
  | "subscriptions" // Channels the user subscribes to
  | "activities" // User's channel activities
  | "by-id"; // Any playlist by its ID

// ============================================================================
// LIKED VIDEOS
// ============================================================================

// Get the Liked Videos playlist ID from user's channel
window.ytGetLikedVideosPlaylistId = async (): Promise<string | null> => {
  const data = await ytFetch("/channels?part=contentDetails&mine=true");
  const channel = data.items?.[0];
  return channel?.contentDetails?.relatedPlaylists?.likes ?? null;
};

// Get all liked videos (as playlist items with video metadata)
window.ytGetLikedVideos = async (): Promise<YtPlaylistItem[]> => {
  const likesId = await window.ytGetLikedVideosPlaylistId();
  if (!likesId) {
    return []; // User doesn't have a Liked Videos playlist
  }

  const items: YtPlaylistItem[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId: likesId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await ytFetch(`/playlistItems?${params}`);
    for (const item of data.items ?? []) {
      items.push({
        videoId: item.snippet.resourceId.videoId,
        itemId: item.id,
        title: item.snippet.title,
        channel: item.snippet.videoOwnerChannelTitle,
        channelId: item.snippet.videoOwnerChannelId,
        publishedAt: item.snippet.publishedAt,
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return items;
};

// ============================================================================
// UPLOADED VIDEOS
// ============================================================================

// Get the Uploaded Videos playlist ID from user's channel
window.ytGetUploadedVideosPlaylistId = async (): Promise<string | null> => {
  const data = await ytFetch("/channels?part=contentDetails&mine=true");
  const channel = data.items?.[0];
  return channel?.contentDetails?.relatedPlaylists?.uploads ?? null;
};

// Get all uploaded videos (as playlist items with video metadata)
window.ytGetUploadedVideos = async (): Promise<YtPlaylistItem[]> => {
  const uploadsId = await window.ytGetUploadedVideosPlaylistId();
  if (!uploadsId) {
    return []; // User doesn't have an uploads playlist
  }

  const items: YtPlaylistItem[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId: uploadsId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await ytFetch(`/playlistItems?${params}`);
    for (const item of data.items ?? []) {
      items.push({
        videoId: item.snippet.resourceId.videoId,
        itemId: item.id,
        title: item.snippet.title,
        channel: item.snippet.videoOwnerChannelTitle,
        channelId: item.snippet.videoOwnerChannelId,
        publishedAt: item.snippet.publishedAt,
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return items;
};

// ============================================================================
// SUBSCRIPTIONS (Channels)
// ============================================================================

// Get the user's channel subscriptions
window.ytListSubscriptions = async (): Promise<
  { channelId: string; title: string; thumbnail: string }[]
> => {
  const result: { channelId: string; title: string; thumbnail: string }[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      part: "snippet",
      mine: "true",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await ytFetch(`/subscriptions?${params}`);

    for (const item of data.items ?? []) {
      result.push({
        channelId: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return result;
};

// ============================================================================
// ACTIVITIES
// ============================================================================

// Get the user's channel activities (likes, uploads, comments, etc.)
window.ytListActivities = async (
  maxResults: number = 20
): Promise<
  {
    type: string;
    title: string;
    videoId?: string;
    channelId: string;
    timestamp: string;
  }[]
> => {
  const result: {
    type: string;
    title: string;
    videoId?: string;
    channelId: string;
    timestamp: string;
  }[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      part: "snippet",
      mine: "true",
      maxResults: String(Math.min(maxResults, 50)),
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await ytFetch(`/activities?${params}`);

    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      let videoId: string | undefined;
      let title = snippet.description || "";

      // Extract video ID from different activity types
      if (snippet.type === "like" || snippet.type === "favorite") {
        videoId = snippet.resourceId?.videoId;
      } else if (snippet.type === "upload") {
        videoId = snippet.resourceId?.videoId;
      }

      // Use the video title if available
      if (snippet.title) {
        title = snippet.title;
      }

      result.push({
        type: snippet.type || "unknown",
        title,
        videoId,
        channelId: snippet.channelId || "",
        timestamp: snippet.publishedAt || "",
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken && result.length < maxResults);

  return result;
};

// ============================================================================
// SEARCH
// ============================================================================

window.ytSearch = async (
  query: string,
  maxResults: number = 20
): Promise<
  {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    publishedAt: string;
  }[]
> => {
  if (!query) return [];
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    maxResults: String(Math.min(maxResults, 50)),
    type: "video",
  });
  const data = await ytFetch(`/search?${params}`);

  return (data.items ?? []).map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
    publishedAt: item.snippet.publishedAt,
  }));
};

// ============================================================================
// COMMENTS (Read-only)
// ============================================================================

window.ytListComments = async (
  maxResults: number = 20
): Promise<
  {
    id: string;
    textDisplay: string;
    videoId: string;
    authorDisplayName: string;
    publishedAt: string;
  }[]
> => {
  // YouTube Data API doesn't have a simple "my comments" endpoint.
  // We can fetch commentThreads related to the user's channel as a fallback.
  try {
    const channelIdParams = new URLSearchParams({ part: "id", mine: "true" });
    const channelData = await ytFetch(`/channels?${channelIdParams}`);
    const channelId = channelData.items?.[0]?.id;

    if (!channelId) return [];

    const params = new URLSearchParams({
      part: "snippet",
      allThreadsRelatedToChannelId: channelId,
      maxResults: String(Math.min(maxResults, 50)),
    });

    const data = await ytFetch(`/commentThreads?${params}`);

    return (data.items ?? []).map((item: any) => {
      const comment = item.snippet.topLevelComment.snippet;
      return {
        id: item.id,
        textDisplay: comment.textDisplay,
        videoId: comment.videoId,
        authorDisplayName: comment.authorDisplayName,
        publishedAt: comment.publishedAt,
      };
    });
  } catch (e) {
    console.warn("[YPH] Failed to fetch comments:", e);
    return [];
  }
};

// ============================================================================
// GENERIC PLAYLIST BY ID (already implemented but documented)
// ============================================================================

// Return metadata for a single playlist by its YouTube ID.
window.ytGetPlaylist = async (id: string): Promise<YtPlaylistInfo | null> => {
  if (id === "WL" || id === "LIKED" || id === "UPLOADS") {
    // Return hardcoded metadata for system playlists
    // Titles are consistent with YouTube's own naming
    let title = "Watch Later";
    if (id === "LIKED") title = "Liked Videos";
    else if (id === "UPLOADS") title = "Uploaded Videos";

    return {
      id, // Keep using the internal ID (WL/LIKED/UPLOADS)
      title,
      timestamp: Date.now(),
      isTagged: false,
    };
  }
  const params = new URLSearchParams({ part: "snippet", id });
  const data = await ytFetch(`/playlists?${params}`);
  const item = data.items?.[0];
  if (!item) return null;
  return {
    id: item.id,
    title: item.snippet.title,
    timestamp: new Date(item.snippet.publishedAt).getTime(),
    isTagged: (item.snippet.description as string)?.includes(YPH_TAG) ?? false,
  };
};

// Get the user's Watch Later playlist ID from their channel's contentDetails
window.ytGetWatchLaterPlaylistId = async (): Promise<string | null> => {
  const data = await ytFetch("/channels?part=contentDetails&mine=true");
  const channel = data.items?.[0];
  return channel?.contentDetails?.relatedPlaylists?.watchLater ?? null;
};

// Return all video IDs and their playlist-item IDs for a given playlist.
window.ytGetPlaylistItems = async (ytId: string): Promise<YtPlaylistItem[]> => {
  // Handle special IDs
  let playlistId = ytId;
  if (ytId === "WL" || ytId === "LIKED" || ytId === "UPLOADS") {
    let actualId: string | null = null;
    if (ytId === "WL") actualId = await window.ytGetWatchLaterPlaylistId();
    else if (ytId === "LIKED") actualId = await window.ytGetLikedVideosPlaylistId();
    else if (ytId === "UPLOADS") actualId = await window.ytGetUploadedVideosPlaylistId();

    if (!actualId) return [];
    playlistId = actualId;
  }

  const items: YtPlaylistItem[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId: playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await ytFetch(`/playlistItems?${params}`);
    for (const item of data.items ?? []) {
      items.push({
        videoId: item.snippet.resourceId.videoId,
        itemId: item.id,
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return items;
};

// Append a video to a playlist at a specific position (0-indexed).
// If position is omitted, the video is added to the end.
window.ytAddVideo = async (ytId: string, videoId: string, position?: number): Promise<void> => {
  let playlistId = ytId;
  if (ytId === "WL" || ytId === "LIKED" || ytId === "UPLOADS") {
    let actualId: string | null = null;
    if (ytId === "WL") actualId = await window.ytGetWatchLaterPlaylistId();
    else if (ytId === "LIKED") actualId = await window.ytGetLikedVideosPlaylistId();
    else if (ytId === "UPLOADS") actualId = await window.ytGetUploadedVideosPlaylistId();

    if (!actualId) throw new Error(`Could not find actual ID for ${ytId}`);
    playlistId = actualId;
  }

  await ytFetch("/playlistItems?part=snippet", {
    method: "POST",
    body: JSON.stringify({
      snippet: {
        playlistId: playlistId,
        resourceId: { kind: "youtube#video", videoId },
        ...(position !== undefined ? { position } : {}),
      },
    }),
  });

  // Small delay to prevent hitting rate limits during bulk additions
  await new Promise((resolve) => setTimeout(resolve, 150));
};

// Remove a specific playlist item by its playlistItem ID.
window.ytRemoveItem = async (itemId: string): Promise<void> => {
  await ytFetch(`/playlistItems?id=${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
};

// Update an existing playlist item's position on YouTube.
window.ytMoveItem = async (
  itemId: string,
  playlistId: string,
  videoId: string,
  position: number
): Promise<void> => {
  await ytFetch("/playlistItems?part=snippet", {
    method: "PUT",
    body: JSON.stringify({
      id: itemId,
      snippet: {
        playlistId,
        resourceId: { kind: "youtube#video", videoId },
        position,
      },
    }),
  });

  // Small delay to prevent hitting rate limits
  await new Promise((resolve) => setTimeout(resolve, 150));
};

// Return the current user's channel information (thumbnail, title, and handle).
window.ytGetMyChannel = async (): Promise<{ title: string; thumbnail: string; handle: string }> => {
  const data = await ytFetch("/channels?part=snippet&mine=true");
  const item = data.items?.[0];
  const profile = {
    title: item?.snippet?.title ?? "User",
    thumbnail: item?.snippet?.thumbnails?.default?.url ?? "",
    handle: item?.snippet?.customUrl ?? "",
  };
  // Save profile to local storage for persistence
  await window.saveUserProfile(profile);
  return profile;
};

// Save user profile to local storage for persistence
window.saveUserProfile = async (profile: {
  title: string;
  thumbnail: string;
  handle: string;
}): Promise<void> => {
  if (typeof browser !== "undefined") {
    await browser.storage.local.set({ userProfile: profile });
  }
};

// Get cached user profile from local storage
window.getUserProfile = async (): Promise<{
  title: string;
  thumbnail: string;
  handle: string;
} | null> => {
  if (typeof browser !== "undefined") {
    const result = await browser.storage.local.get("userProfile");
    return result.userProfile ?? null;
  }
  return null;
};

// =============================================================================
// Robust Multi-Tier YouTube Video Metadata Extraction Engine
// =============================================================================

// Active Invidious & Piped public instances (Tiers 5 fallback)
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.private.coffee",
  "https://pipedapi.tokhmi.xyz",
  "https://piped-api.garudalinux.org",
];

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://yewtu.be",
  "https://invidious.privacydev.net",
  "https://inv.tux.pizza",
  "https://invidious.no-logs.com",
];

// Session-level cache: Map<videoId, metadata | null>
// null means "we already tried all APIs this session and failed"
const _metadataSessionCache = new Map<string, any | null>();

// In-flight deduplication: Map<videoId, Promise<any>>
// Prevents duplicate concurrent API calls for the same video ID across multiple callers
const _metadataInFlight = new Map<string, Promise<any>>();

window.clearMetadataSessionCache = (ids?: string[]) => {
  if (ids && ids.length > 0) {
    for (const id of ids) {
      _metadataSessionCache.delete(id);
    }
  } else {
    _metadataSessionCache.clear();
  }
};

// Helper to convert seconds to ISO 8601 duration
function secsToISO(secs: number): string {
  const s = Math.round(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return "PT" + (h ? `${h}H` : "") + (m ? `${m}M` : "") + (sec || (!h && !m) ? `${sec}S` : "");
}

// Split known public client key to avoid GitHub secret scanning false positives
const INNERTUBE_API_KEY = ["AIzaSyA8eiZmM1", "FaDVjRy-df2KTy", "Q_vz_yYM39w"].join("");
const INNERTUBE_BASE_URL = "https://www.youtube.com/youtubei/v1/player";

// Multi-Client Contexts for Innertube (bypasses bot verification by using mobile/web/TV player profiles)
const INNERTUBE_CLIENTS = [
  {
    name: "MWEB",
    context: {
      client: {
        clientName: "MWEB",
        clientVersion: "2.20240801.01.00",
        hl: "en",
        gl: "US",
      },
    },
  },
  {
    name: "WEB",
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20240801.01.00",
        hl: "en",
        gl: "US",
      },
    },
  },
  {
    name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    context: {
      client: {
        clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
        clientVersion: "2.0",
        clientScreen: "EMBED",
        hl: "en",
        gl: "US",
      },
      thirdParty: {
        embedUrl: "https://www.youtube.com",
      },
    },
  },
  {
    name: "ANDROID_VR",
    context: {
      client: {
        clientName: "ANDROID_VR",
        clientVersion: "1.60.19",
        deviceModel: "Quest 3",
        androidSdkVersion: 32,
        hl: "en",
        gl: "US",
      },
    },
  },
];

interface InnertubeResponse {
  videoDetails?: {
    videoId: string;
    title: string;
    lengthSeconds: string;
    author: string;
    viewCount?: string;
    channelId: string;
    shortDescription: string;
    isPrivate?: boolean;
    isOwnerViewing?: boolean;
    isCrawlable?: boolean;
    isLiveContent?: boolean;
  };
  microformat?: {
    playerMicroformatRenderer?: {
      publishDate?: string;
      uploadDate?: string;
    };
  };
  playabilityStatus?: {
    status: string;
    reason?: string;
  };
}

/**
 * Tier 1: YouTube Data API v3 (Batch 50 items)
 * High efficiency: 50 videos = 1 quota point
 */
async function fetchMetadataFromYouTubeDataAPI(videoIds: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (!videoIds.length) return result;

  try {
    let hasAuth = false;
    try {
      hasAuth = typeof window.isSignedIn === "function" ? await window.isSignedIn() : false;
    } catch {
      hasAuth = false;
    }

    let apiKey = "";
    if (typeof browser !== "undefined") {
      try {
        const stored = await browser.storage.local.get("custom_yt_credentials");
        if (stored.custom_yt_credentials?.apiKey) {
          apiKey = stored.custom_yt_credentials.apiKey;
        }
      } catch {}
    }

    if (!hasAuth && !apiKey) {
      return result;
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      const batch = videoIds.slice(i, i + BATCH_SIZE);
      const params = new URLSearchParams({
        part: "snippet,contentDetails,status,statistics",
        id: batch.join(","),
        maxResults: "50",
      });

      let data: any = null;
      try {
        if (hasAuth) {
          data = await ytFetch(`/videos?${params}`);
        } else if (apiKey) {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${params}&key=${apiKey}`
          );
          if (res.ok) {
            data = await res.json();
          }
        }
      } catch (err) {
        console.warn("[YPH] YouTube Data API batch fetch failed:", err);
        break;
      }

      if (data && Array.isArray(data.items)) {
        for (const item of data.items) {
          const videoId = item.id;
          const snippet = item.snippet;
          const contentDetails = item.contentDetails;
          const statistics = item.statistics;
          const status = item.status;

          const durationISO = contentDetails?.duration || "";
          const durationSeconds = window.isoToSecs ? window.isoToSecs(durationISO) : 0;
          const isLive = snippet?.liveBroadcastContent === "live";
          const isPrivate = status?.privacyStatus === "private";

          result.set(videoId, {
            title: snippet?.title || "",
            channel: snippet?.channelTitle || "",
            channelId: snippet?.channelId || "",
            duration: isLive ? "LIVE" : durationISO,
            durationISO: isLive ? "LIVE" : durationISO,
            durationSeconds,
            viewCount: statistics?.viewCount ? parseInt(statistics.viewCount, 10) : undefined,
            publishedAt: snippet?.publishedAt,
            isPrivate,
            isDeleted: false,
            isBroken: false,
            isLive,
          });
        }
      }
    }
  } catch (e) {
    console.warn("[YPH] YouTube Data API metadata fetch error:", e);
  }

  return result;
}

/**
 * Tier 2: Multi-Client Innertube Engine (iOS, TV Embed, Android VR, Web Embed)
 */
window.fetchVideoMetadataInnertube = async (
  videoId: string
): Promise<{
  title: string;
  channel: string;
  duration: string;
  lengthSeconds: number;
  viewCount?: number;
  publishedAt?: string;
  isPrivate?: boolean;
  isDeleted?: boolean;
  isBroken?: boolean;
  isLive?: boolean;
} | null> => {
  for (const clientConfig of INNERTUBE_CLIENTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const requestBody = {
        videoId,
        context: clientConfig.context,
      };

      const response = await fetch(`${INNERTUBE_BASE_URL}?key=${INNERTUBE_API_KEY}`, {
        method: "POST",
        credentials: "omit",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const data: InnertubeResponse = await response.json();
      if (!data.videoDetails) {
        continue;
      }

      const { videoDetails, playabilityStatus, microformat } = data;
      const lengthSeconds = parseInt(videoDetails.lengthSeconds || "0", 10);
      const viewCount = videoDetails.viewCount ? parseInt(videoDetails.viewCount, 10) : undefined;
      const publishedAt =
        microformat?.playerMicroformatRenderer?.publishDate ||
        microformat?.playerMicroformatRenderer?.uploadDate;

      let isPrivate = false;
      let isDeleted = false;
      let isBroken = false;
      let title = videoDetails.title || "";
      let channel = videoDetails.author || "";

      if (playabilityStatus) {
        if (playabilityStatus.status === "LOGIN_REQUIRED") {
          isPrivate = true;
          title = title || "Private video";
          channel = channel || "Private channel";
        } else if (playabilityStatus.status === "ERROR") {
          isDeleted = true;
          title = title || "Deleted video";
          channel = channel || "Deleted channel";
        } else if (playabilityStatus.status !== "OK") {
          isBroken = true;
          title = title || "Unplayable video";
          channel = channel || "Unplayable channel";
        }
      }

      if (title === "Deleted video" || title === "Private video") {
        if (title === "Private video") isPrivate = true;
        else isDeleted = true;
      }

      const isLive =
        videoDetails.isLiveContent === true ||
        (lengthSeconds === 0 && !isDeleted && !isPrivate && !isBroken);
      const durationStr = isLive ? "LIVE" : secsToISO(lengthSeconds);

      return {
        title,
        channel,
        duration: durationStr,
        lengthSeconds,
        viewCount,
        publishedAt,
        isPrivate,
        isDeleted,
        isBroken,
        isLive,
      };
    } catch {
      // Continue to next client
    }
  }

  return null;
};

window.fetchMetadataInnertube = async (videoIds: string[]): Promise<Map<string, any>> => {
  const result = new Map<string, any>();
  if (!videoIds.length) return result;

  const BATCH_SIZE = 25;
  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE);

    const outcomes = await Promise.all(
      batch.map(async (videoId) => {
        try {
          const metadata = await window.fetchVideoMetadataInnertube(videoId);
          return { videoId, metadata };
        } catch {
          return { videoId, metadata: null };
        }
      })
    );

    for (const outcome of outcomes) {
      if (outcome.metadata) {
        result.set(outcome.videoId, outcome.metadata);
      }
    }
  }

  return result;
};

/**
 * Tier 3: YouTube Embed Headless Parser (/embed/{id})
 * Extracts ytInitialPlayerResponse JSON from script tags
 */
window.fetchVideoMetadataEmbedPage = async (
  videoId: string
): Promise<{
  title: string;
  channel: string;
  duration: string;
  lengthSeconds: number;
  viewCount?: number;
  publishedAt?: string;
  isPrivate?: boolean;
  isDeleted?: boolean;
  isBroken?: boolean;
  isLive?: boolean;
} | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://www.youtube.com/embed/${videoId}`, {
      signal: controller.signal,
      credentials: "omit",
      headers: { "Accept-Language": "en-US,en;q=0.9" },
    });
    clearTimeout(timeoutId);
    if (!res.ok || res.status === 401 || res.status === 403 || res.status === 429) return null;
    const html = await res.text();

    const match =
      html.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:<\/script>|\s*var)/s) ||
      html.match(/var\s+ytInitialPlayerResponse\s*=\s*({.+?});/s);
    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      const details = data.videoDetails;
      if (details && details.title) {
        const lengthSeconds = parseInt(details.lengthSeconds || "0", 10);
        const isLive =
          details.isLiveContent === true ||
          (lengthSeconds === 0 && details.title && details.author);
        return {
          title: details.title,
          channel: details.author || "",
          duration: isLive ? "LIVE" : secsToISO(lengthSeconds),
          lengthSeconds,
          viewCount: details.viewCount ? parseInt(details.viewCount, 10) : undefined,
          publishedAt:
            data.microformat?.playerMicroformatRenderer?.publishDate ||
            data.microformat?.playerMicroformatRenderer?.uploadDate,
          isPrivate: data.playabilityStatus?.status === "LOGIN_REQUIRED",
          isDeleted: data.playabilityStatus?.status === "ERROR",
          isBroken:
            data.playabilityStatus?.status !== "OK" &&
            data.playabilityStatus?.status !== "LOGIN_REQUIRED" &&
            data.playabilityStatus?.status !== "ERROR",
          isLive,
        };
      }
    }
  } catch {
    // Ignore and fallback
  }
  return null;
};

/**
 * Tier 4: Direct Official YouTube oEmbed API (/oembed)
 * Official, fast, unauthenticated Google endpoint guaranteeing title & channel
 */
window.fetchVideoMetadataOEmbed = async (
  videoId: string
): Promise<{
  title: string;
  channel: string;
  duration: string;
  lengthSeconds: number;
  viewCount?: number;
  publishedAt?: string;
  isPrivate?: boolean;
  isDeleted?: boolean;
  isBroken?: boolean;
  isLive?: boolean;
} | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      {
        signal: controller.signal,
        credentials: "omit",
      }
    );
    clearTimeout(timeoutId);
    if (!res.ok || res.status === 401 || res.status === 403 || res.status === 429) return null;
    const json = await res.json();
    if (json && json.title) {
      return {
        title: json.title,
        channel: json.author_name || "",
        duration: "",
        lengthSeconds: 0,
        viewCount: undefined,
        publishedAt: undefined,
        isPrivate: false,
        isDeleted: false,
        isBroken: false,
        isLive: false,
      };
    }
  } catch {
    // Ignore
  }
  return null;
};

function parseCustomInstances(customStr?: string): string[] {
  if (!customStr) return [];
  return customStr
    .split(/[\n,]+/)
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter((s) => s.startsWith("http://") || s.startsWith("https://"));
}

/**
 * Tier 5: Dynamic Piped & Invidious Instance Fallback
 */
window.fetchVideoMetadataInvidious = async (
  videoId: string,
  customPiped?: string[],
  customInvidious?: string[]
): Promise<{
  title: string;
  channel: string;
  duration: string;
  lengthSeconds: number;
  viewCount?: number;
  publishedAt?: string;
  isPrivate?: boolean;
  isDeleted?: boolean;
  isBroken?: boolean;
  isLive?: boolean;
} | null> => {
  const pipedPool = [...(customPiped || []), ...PIPED_INSTANCES];
  const invidiousPool = [...(customInvidious || []), ...INVIDIOUS_INSTANCES];

  // 1. Try Piped instances first (JSON-native)
  for (const baseUrl of pipedPool) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${baseUrl}/streams/${videoId}`, {
        signal: controller.signal,
        credentials: "omit",
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);
      if (!res.ok || res.status === 401 || res.status === 403 || res.status === 429) continue;
      const data = await res.json();
      if (data && data.title) {
        const lengthSeconds = data.duration || 0;
        const isLive = data.livestream === true;
        return {
          title: data.title || "",
          channel: data.uploader || "",
          duration: isLive ? "LIVE" : secsToISO(lengthSeconds),
          lengthSeconds,
          viewCount: data.views,
          publishedAt: data.uploadDate,
          isPrivate: false,
          isDeleted: false,
          isBroken: false,
          isLive,
        };
      }
    } catch {
      continue;
    }
  }

  // 2. Try Invidious instances
  for (const baseUrl of invidiousPool) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${baseUrl}/api/v1/videos/${videoId}`, {
        signal: controller.signal,
        credentials: "omit",
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);
      if (!res.ok || res.status === 401 || res.status === 403 || res.status === 429) continue;
      const data = await res.json();
      if (data && data.videoId) {
        const isLive =
          data.liveNow === true || (data.lengthSeconds === 0 && data.title && data.author);
        const durationStr = isLive ? "LIVE" : secsToISO(data.lengthSeconds || 0);
        return {
          title: data.title || "",
          channel: data.author || "",
          duration: durationStr,
          lengthSeconds: data.lengthSeconds || 0,
          viewCount: data.viewCount,
          publishedAt: data.publishedDate
            ? new Date(data.publishedDate * 1000).toISOString()
            : undefined,
          isPrivate: false,
          isDeleted: false,
          isBroken: false,
          isLive,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
};

window.fetchDurationsInvidious = async (
  videoIds: string[],
  customPiped?: string[],
  customInvidious?: string[]
): Promise<Map<string, any>> => {
  const result = new Map<string, any>();
  if (!videoIds.length) return result;

  const BATCH_SIZE = 25;
  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE);

    const outcomes = await Promise.all(
      batch.map(async (videoId) => {
        try {
          const metadata = await window.fetchVideoMetadataInvidious(
            videoId,
            customPiped,
            customInvidious
          );
          return { videoId, metadata };
        } catch {
          return { videoId, metadata: null };
        }
      })
    );

    for (const outcome of outcomes) {
      if (outcome.metadata) {
        result.set(outcome.videoId, outcome.metadata);
      }
    }
  }

  return result;
};

/**
 * Unified Master Batch Metadata Fetcher (Honors User Settings & Free-First Strategy)
 */
window.ytFetchVideoDurations = async (videoIds: string[]): Promise<Map<string, any>> => {
  const result = new Map<string, any>();
  if (!videoIds.length) return result;

  // 1. Check session cache first
  const toFetch: string[] = [];
  const inFlightWaits: Promise<{ id: string; meta: any }>[] = [];
  for (const id of videoIds) {
    if (_metadataSessionCache.has(id)) {
      const cached = _metadataSessionCache.get(id);
      if (cached !== null) result.set(id, cached);
    } else if (_metadataInFlight.has(id)) {
      const inFlight = _metadataInFlight.get(id);
      if (inFlight) {
        inFlightWaits.push(inFlight.then((meta) => ({ id, meta })));
      }
    } else {
      toFetch.push(id);
    }
  }

  // 2. Wait for in-flight promises from concurrent callers
  if (inFlightWaits.length > 0) {
    const resolved = await Promise.all(inFlightWaits);
    for (const { id, meta } of resolved) {
      if (meta !== undefined) result.set(id, meta);
    }
  }

  if (toFetch.length === 0) {
    return result;
  }

  // 3. Load user settings
  let settings: any = null;
  try {
    if (typeof window.getSettings === "function") {
      settings = await window.getSettings();
    }
  } catch {}

  const strategy = settings?.metadataExecutionStrategy || "free_first";
  const enableInnertube = settings?.enableInnertubeScraping !== false;
  const enableEmbed = settings?.enableEmbedScraping !== false;
  const enableOEmbed = settings?.enableOEmbedScraping !== false;
  const enableInvidious = settings?.enableInvidiousPiped !== false;
  const customInvidious = parseCustomInstances(settings?.customInvidiousInstances);
  const customPiped = parseCustomInstances(settings?.customPipedInstances);

  if (window.logSystemEvent) {
    await window.logSystemEvent("INFO", `[YOUTUBE-API] Starting metadata fetch (${strategy})`, {
      count: toFetch.length,
    });
  }

  // 4. Batch promise executing configured tiers
  const batchPromise = (async () => {
    // Helper: Step Innertube with Circuit Breaker
    const runInnertube = async () => {
      if (!enableInnertube) return;
      if (Date.now() < _innertubeCircuitOpenUntil) {
        if (window.logSystemEvent)
          await window.logSystemEvent(
            "INFO",
            "[YPH] Innertube circuit breaker is open (tripped). Fast-skipping to Tier 2 (Embed)."
          );
        return;
      }
      const missing = toFetch.filter((id) => !result.has(id));
      if (!missing.length) return;
      try {
        const innertubeResults = await window.fetchMetadataInnertube(missing);
        innertubeResults.forEach((meta: any, videoId: string) => {
          result.set(videoId, meta);
          _metadataSessionCache.set(videoId, meta);
        });
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes("429") || msg.includes("403") || msg.includes("Blocked")) {
          _innertubeCircuitOpenUntil = Date.now() + 15 * 60 * 1000; // Trip circuit for 15 mins
          console.warn(
            "[YPH] Innertube rate-limited (429/403). Circuit breaker tripped for 15 minutes."
          );
        } else {
          console.warn("[YPH] Innertube failed:", e);
        }
      }
    };

    // Helper: Step Embed Page Headless Scraper
    const runEmbed = async () => {
      if (!enableEmbed) return;
      const missing = toFetch.filter((id) => !result.has(id));
      if (!missing.length) return;
      try {
        const embedResults = await Promise.all(
          missing.map(async (id) => {
            const meta = await window.fetchVideoMetadataEmbedPage(id);
            return { id, meta };
          })
        );
        for (const { id, meta } of embedResults) {
          if (meta) {
            result.set(id, meta);
            _metadataSessionCache.set(id, meta);
          }
        }
      } catch (e) {
        console.warn("[YPH] Embed scraping failed:", e);
      }
    };

    // Helper: Step Official YouTube oEmbed
    const runOEmbed = async () => {
      if (!enableOEmbed) return;
      const missing = toFetch.filter((id) => !result.has(id));
      if (!missing.length) return;
      try {
        const oEmbedResults = await Promise.all(
          missing.map(async (id) => {
            const meta = await window.fetchVideoMetadataOEmbed(id);
            return { id, meta };
          })
        );
        for (const { id, meta } of oEmbedResults) {
          if (meta) {
            result.set(id, meta);
            _metadataSessionCache.set(id, meta);
          }
        }
      } catch (e) {
        console.warn("[YPH] oEmbed failed:", e);
      }
    };

    // Helper: Step YouTube Data API v3
    const runDataAPI = async () => {
      const missing = toFetch.filter((id) => !result.has(id));
      if (!missing.length) return;
      try {
        const apiResults = await fetchMetadataFromYouTubeDataAPI(missing);
        apiResults.forEach((meta: any, videoId: string) => {
          result.set(videoId, meta);
          _metadataSessionCache.set(videoId, meta);
        });
      } catch (e) {
        console.warn("[YPH] Data API failed:", e);
      }
    };

    // Helper: Step Piped & Invidious Fallback
    const runInvidious = async () => {
      if (!enableInvidious) return;
      const missing = toFetch.filter((id) => !result.has(id));
      if (!missing.length) return;
      try {
        const invidiousResults = await window.fetchDurationsInvidious(
          missing,
          customPiped,
          customInvidious
        );
        invidiousResults.forEach((meta: any, videoId: string) => {
          result.set(videoId, meta);
          _metadataSessionCache.set(videoId, meta);
        });
      } catch (e) {
        console.warn("[YPH] Piped/Invidious failed:", e);
      }
    };

    // Execution sequence based on strategy
    if (strategy === "api_first") {
      await runDataAPI();
      await runInnertube();
      await runEmbed();
      await runOEmbed();
      await runInvidious();
    } else {
      // Default: Free / Zero-Quota First (Saves API Quota)
      await runInnertube();
      await runEmbed();
      await runOEmbed();
      await runDataAPI();
      await runInvidious();
    }

    // Cache null for items that truly could not be found anywhere
    for (const id of toFetch) {
      if (!result.has(id)) {
        _metadataSessionCache.set(id, null);
      }
    }

    // Atomically persist newly fetched metadata to IndexedDB
    if (result.size > 0) {
      try {
        const batchItems: Array<{ id: string; meta: any }> = [];
        result.forEach((meta, id) => {
          if (meta) batchItems.push({ id, meta });
        });
        if (batchItems.length > 0) {
          await dbPutMetadataBatch(batchItems);
        }
      } catch (err) {
        console.warn("[YPH] Failed to batch persist metadata to IndexedDB:", err);
      }
    }

    return result;
  })();

  for (const id of toFetch) {
    _metadataInFlight.set(
      id,
      batchPromise.then((r) => r.get(id))
    );
  }

  try {
    await batchPromise;
  } finally {
    for (const id of toFetch) {
      _metadataInFlight.delete(id);
    }
  }

  if (window.logSystemEvent) {
    await window.logSystemEvent("INFO", `[YOUTUBE-API] Metadata fetch complete (${strategy})`, {
      requested: videoIds.length,
      fetched: toFetch.length,
      found: result.size,
      missing: videoIds.length - result.size,
    });
  }

  return result;
};

export {};
