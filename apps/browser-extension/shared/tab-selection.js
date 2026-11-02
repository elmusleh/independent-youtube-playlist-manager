/**
 * Shared tab selection logic for context menu and popup.
 * Pure functions: no DOM, no browser API calls except via injected dependencies.
 */

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

/**
 * YouTube hostname allowlist.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isYouTubeHost(hostname) {
  const h = hostname.toLowerCase();
  return h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be";
}

/**
 * Check if a tab is a YouTube video tab and extract its video ID.
 * Supports watch, mobile, shorts, embed, youtu.be forms.
 * @param {Tab} tab
 * @returns {{ isVideo: boolean; videoId: string | null }}
 */
export function getYouTubeVideoInfo(tab) {
  try {
    if (!tab.url) return { isVideo: false, videoId: null };
    const url = new URL(tab.url);
    if (!isYouTubeHost(url.hostname)) return { isVideo: false, videoId: null };

    let videoId = null;
    if (url.hostname === "youtu.be") {
      videoId = url.pathname.slice(1).split("/")[0];
    } else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})(?:\/|$)/);
      if (match) videoId = match[1];
    }

    const valid = typeof videoId === "string" && /^[\w-]{11}$/.test(videoId);
    return { isVideo: valid, videoId: valid ? videoId : null };
  } catch {
    return { isVideo: false, videoId: null };
  }
}

/**
 * Check if a tab is a YouTube playlist page.
 * @param {Tab} tab
 * @returns {boolean}
 */
export function isYouTubePlaylistTab(tab) {
  try {
    if (!tab.url) return false;
    const url = new URL(tab.url);
    if (!isYouTubeHost(url.hostname)) return false;
    return url.pathname === "/playlist" && url.searchParams.has("list");
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a valid YouTube video URL (for link context).
 * @param {string} urlString
 * @returns {string | null} videoId or null
 */
export function parseYouTubeVideoId(urlString) {
  try {
    const url = new URL(urlString);
    if (!isYouTubeHost(url.hostname)) return null;

    let videoId = null;
    if (url.hostname === "youtu.be") {
      videoId = url.pathname.slice(1).split("/")[0];
    } else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})(?:\/|$)/);
      if (match) videoId = match[1];
    }
    return typeof videoId === "string" && /^[\w-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a YouTube playlist URL.
 * @param {string} urlString
 * @returns {string | null} playlistId or null
 */
export function parseYouTubePlaylistId(urlString) {
  try {
    const url = new URL(urlString);
    if (!isYouTubeHost(url.hostname)) return null;
    if (url.pathname === "/playlist") {
      return url.searchParams.get("list");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Deduplicate video IDs preserving first-seen order.
 * @param {string[]} ids
 * @returns {string[]}
 */
export function deduplicateVideoIds(ids) {
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Tab scope types.
 * @readonly
 * @enum {string}
 */
export const TabScope = {
  CURRENT: "current",
  LEFT: "left",
  RIGHT: "right",
  ALL_THIS_WINDOW_INCLUDE: "all-this-window-include",
  ALL_THIS_WINDOW_EXCLUDE: "all-this-window-exclude",
  ALL_WINDOWS: "all-windows",
  SELECTED: "selected",
};

/**
 * Resolve tabs for a given scope, anchored to the clicked tab.
 * @param {Object} params
 * @param {Tab} params.anchorTab - The tab that was right-clicked (anchor)
 * @param {Tab[]} params.allTabsInWindow - All tabs in the anchor's window
 * @param {Tab[]} params.allTabsAllWindows - All tabs across all normal windows
 * @param {string} params.scope - One of TabScope values
 * @returns {Tab[]} Filtered tabs in stable order
 */
export function resolveTabsForScope({ anchorTab, allTabsInWindow, allTabsAllWindows, scope }) {
  const anchorIndex = anchorTab.index;
  const anchorId = anchorTab.id;
  const isAnchorHighlighted = anchorTab.highlighted === true;
  const isAnchorPrivate = anchorTab.incognito === true;

  // Filter to YouTube video tabs only
  const videoTabsInWindow = allTabsInWindow
    .filter((t) => getYouTubeVideoInfo(t).isVideo)
    .sort((a, b) => a.index - b.index);

  const videoTabsAllWindows = allTabsAllWindows
    .filter((t) => getYouTubeVideoInfo(t).isVideo)
    .sort((a, b) => {
      // Anchor window first, then windowId ascending, then tab index
      if (a.windowId !== b.windowId) {
        if (a.windowId === anchorTab.windowId) return -1;
        if (b.windowId === anchorTab.windowId) return 1;
        return a.windowId - b.windowId;
      }
      return a.index - b.index;
    });

  // Selected tabs in the window (highlighted), or anchor only if not highlighted
  const selectedTabsInWindow = allTabsInWindow
    .filter((t) => t.highlighted === true && getYouTubeVideoInfo(t).isVideo)
    .sort((a, b) => a.index - b.index);

  switch (scope) {
    case TabScope.CURRENT:
      return getYouTubeVideoInfo(anchorTab).isVideo ? [anchorTab] : [];

    case TabScope.LEFT:
      return videoTabsInWindow.filter((t) => t.index < anchorIndex);

    case TabScope.RIGHT:
      return videoTabsInWindow.filter((t) => t.index > anchorIndex);

    case TabScope.ALL_THIS_WINDOW_INCLUDE:
      return videoTabsInWindow;

    case TabScope.ALL_THIS_WINDOW_EXCLUDE:
      return videoTabsInWindow.filter((t) => t.id !== anchorId);

    case TabScope.ALL_WINDOWS:
      return videoTabsAllWindows;

    case TabScope.SELECTED:
      // If anchor is highlighted, return all highlighted tabs; otherwise just anchor
      if (isAnchorHighlighted) {
        return selectedTabsInWindow.length > 0 ? selectedTabsInWindow : [anchorTab];
      }
      return getYouTubeVideoInfo(anchorTab).isVideo ? [anchorTab] : [];

    default:
      return [];
  }
}

/**
 * Extract unique video IDs from tabs, preserving order and deduplicating against existing playlist.
 * @param {Tab[]} tabs
 * @param {string[]} [existingVideoIds=[]] - Video IDs already in destination
 * @returns {{ videoIds: string[]; duplicateCount: number }}
 */
export function extractUniqueVideoIds(tabs, existingVideoIds = []) {
  const existingSet = new Set(existingVideoIds);
  const seen = new Set(existingVideoIds);
  const videoIds = [];
  let duplicateCount = 0;

  for (const tab of tabs) {
    const { videoId } = getYouTubeVideoInfo(tab);
    if (videoId) {
      if (seen.has(videoId)) {
        duplicateCount++;
      } else {
        seen.add(videoId);
        videoIds.push(videoId);
      }
    }
  }

  return { videoIds, duplicateCount };
}

/**
 * Validate that a tab is still valid for capture (not closed, not navigated, not private).
 * @param {Tab} tab
 * @param {Object} anchorSnapshot - { id, windowId, index, url, incognito }
 * @returns {{ valid: boolean; reason?: string }}
 */
export function validateTabForCapture(tab, anchorSnapshot) {
  if (!tab) return { valid: false, reason: "Tab no longer exists" };
  if (tab.id !== anchorSnapshot.id) return { valid: false, reason: "Tab ID mismatch" };
  if (tab.windowId !== anchorSnapshot.windowId)
    return { valid: false, reason: "Tab moved to another window" };
  if (tab.incognito !== anchorSnapshot.incognito)
    return { valid: false, reason: "Tab privacy state changed" };
  if (tab.url !== anchorSnapshot.url)
    return { valid: false, reason: "Tab navigated to different URL" };
  if (tab.incognito === true)
    return { valid: false, reason: "Private tabs are not captured by default" };
  return { valid: true };
}

/**
 * Create an anchor snapshot from a tab for later validation.
 * @param {Tab} tab
 * @returns {Object}
 */
export function createAnchorSnapshot(tab) {
  return {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    url: tab.url,
    incognito: tab.incognito === true,
    title: tab.title,
  };
}

export default {
  isYouTubeHost,
  getYouTubeVideoInfo,
  isYouTubePlaylistTab,
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
  deduplicateVideoIds,
  TabScope,
  resolveTabsForScope,
  extractUniqueVideoIds,
  validateTabForCapture,
  createAnchorSnapshot,
};
