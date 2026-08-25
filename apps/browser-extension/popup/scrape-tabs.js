/* eslint-disable no-console */
/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

import { log } from "./utils.js";
import { isYoutubeTab } from "./tabs.js";

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

const VIDEO_META_CACHE_KEY = "yph_video_metadata_cache";

/** @param {string} iso @returns {number} */
const isoToSeconds = (iso) => {
  if (!iso) return 0;
  const match = iso.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  const d = parseInt(match[1] || "0", 10);
  const h = parseInt(match[2] || "0", 10);
  const m = parseInt(match[3] || "0", 10);
  const s = parseFloat(match[4] || "0");
  return d * 86400 + h * 3600 + m * 60 + Math.floor(s);
};

/**
 * Scrapes metadata (title, channel, ISO duration) from a list of YouTube tabs
 * and persists it to the shared video metadata cache.
 * @param {Tab[]} tabs
 * @returns {Promise<Array<{videoId: string, title: string, channel: string, durationISO: string}>>}
 */
export async function scrapeMetadataFromTabs(tabs) {
  const results = [];

  for (const tab of tabs) {
    if (!tab.id || !isYoutubeTab(tab)) continue;
    try {
      // @ts-ignore
      const res = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["/content-scripts/injectors/get-video-metadata.js"],
      });
      const result = res[0]?.result;
      if (result && result.videoId) results.push(result);
    } catch (e) {
      console.warn(`[YPH] Failed to scrape tab ${tab.id}:`, e);
    }
  }

  if (results.length > 0) {
    try {
      const store = await browser.storage.local.get(VIDEO_META_CACHE_KEY);
      const map = store[VIDEO_META_CACHE_KEY] || {};
      results.forEach((r) => {
        map[r.videoId] = {
          title: r.title || "",
          channel: r.channel || "",
          durationISO: r.durationISO || "",
          durationSeconds: isoToSeconds(r.durationISO) || 0,
          lastUpdated: Date.now(),
        };
      });
      await browser.storage.local.set({ [VIDEO_META_CACHE_KEY]: map });
      await log("INFO", `Popup: Persisted metadata for ${results.length} videos from tabs`);
    } catch (e) {
      console.error("[YPH] Failed to save metadata to cache:", e);
    }
  }

  return results;
}
