/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

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
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be"
    );
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
  return allTabs.filter((tab) => {
    if (!tab.url) return false;
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname.toLowerCase();
      const isYoutube = hostname === "youtube.com" || hostname.endsWith(".youtube.com");
      const isShort = hostname === "youtu.be";
      const isVideo = (isYoutube && url.pathname.includes("/watch")) || isShort;
      return isVideo && (!filterFn || filterFn(tab));
    } catch {
      return false;
    }
  });
}

/**
 * @returns {Promise<Tab[]>}
 */
export async function getAllVideoTabsAcrossWindows() {
  const allTabs = await browser.tabs.query({});
  return allTabs.filter((tab) => {
    if (!tab.url) return false;
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname.toLowerCase();
      const isYoutube = hostname === "youtube.com" || hostname.endsWith(".youtube.com");
      const isShort = hostname === "youtu.be";
      return (isYoutube && url.pathname.includes("/watch")) || isShort;
    } catch {
      return false;
    }
  });
}
