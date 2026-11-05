import { parseYouTubeVideoId } from "../shared/tab-selection.js";
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
  return !tab.incognito && !!parseYouTubeVideoId(tab.url);
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
  const allTabs = await browser.tabs.query({ windowType: "normal" });
  return allTabs.filter(isYoutubeVideoTab);
}
