/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

// ---------------------------------------------------------------------------
// YouTube hostname detection (single source of truth)
// ---------------------------------------------------------------------------

/**
 * Check if a hostname belongs to YouTube.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isYouTubeHost(hostname) {
  const h = hostname.toLowerCase();
  return h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be";
}

// ---------------------------------------------------------------------------
// Active tab / YouTube detection
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<Tab>}
 */
export async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

/**
 * @param {Tab} tab
 * @returns {boolean}
 */
export function isYoutubeTab(tab) {
  try {
    const url = new URL(tab.url || "");
    return isYouTubeHost(url.hostname);
  } catch {
    return false;
  }
}

/** @param {Tab} tab @returns {boolean} */
export function isYoutubeVideoTab(tab) {
  try {
    const url = new URL(tab.url || "");
    if (!isYouTubeHost(url.hostname)) return false;
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1).split("/")[0]
        : url.pathname === "/watch"
          ? url.searchParams.get("v")
          : url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})(?:\/|$)/)?.[1];
    return typeof id === "string" && /^[\w-]{11}$/.test(id);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tab collection
// ---------------------------------------------------------------------------

/**
 * @param {number} windowId
 * @param {(tab: Tab) => boolean} [filterFn]
 * @returns {Promise<Tab[]>}
 */
export async function getVideoTabsInWindow(windowId, filterFn) {
  const allTabs = await browser.tabs.query({ windowId });
  return allTabs.filter((tab) => isYoutubeVideoTab(tab) && (!filterFn || filterFn(tab)));
}

/**
 * @returns {Promise<Tab[]>}
 */
export async function getAllVideoTabsAcrossWindows() {
  const allTabs = await browser.tabs.query({});
  return allTabs.filter(isYoutubeVideoTab);
}
