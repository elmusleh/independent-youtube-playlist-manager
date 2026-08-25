/* eslint-disable no-console */
/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

import { getById, getErrorMessage, setIcon, log, alert, isNotNull } from "./utils.js";
import { getActiveTab, isYoutubeTab } from "./tabs.js";
import { state } from "./state.js";
import { updateTargetUI } from "./target.js";

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

// ---------------------------------------------------------------------------
// Tab metadata scraping
// ---------------------------------------------------------------------------

const VIDEO_META_CACHE_KEY = "yph_video_metadata_cache";

/**
 * Helper to convert ISO 8601 to seconds
 * @param {string} iso
 * @returns {number}
 */
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
      if (result && result.videoId) {
        results.push(result);
      }
    } catch (e) {
      // Silently fail for individual tabs (might be restricted or still loading)
      console.warn(`[YPH] Failed to scrape tab ${tab.id}:`, e);
    }
  }

  if (results.length > 0) {
    try {
      const store = await browser.storage.local.get(VIDEO_META_CACHE_KEY);
      const map = store[VIDEO_META_CACHE_KEY] || {};

      results.forEach((res) => {
        map[res.videoId] = {
          title: res.title || "",
          channel: res.channel || "",
          durationISO: res.durationISO || "",
          durationSeconds: isoToSeconds(res.durationISO) || 0,
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

// ---------------------------------------------------------------------------
// Smart playlist naming
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<string>}
 */
export async function getSmartDefaultPlaylistName() {
  const dateStr = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  try {
    const activeTab = await getActiveTab();
    if (activeTab && activeTab.title) {
      let title = activeTab.title.trim();
      title = title.replace(/\s*[-–—]\s*YouTube$/i, "");
      title = title.replace(/^\(\d+\)\s*/, "");

      if (title) {
        if (title.length > 40) {
          title = title.substring(0, 37) + "...";
        }
        return `${title} (${dateStr})`;
      }
    }
  } catch (e) {
    console.warn("Failed to get smart playlist name:", e);
  }

  return `Playlist (${dateStr})`;
}

// ---------------------------------------------------------------------------
// Close tabs helper
// ---------------------------------------------------------------------------

/**
 * @param {Tab[]} tabsToClose
 */
export async function handleCloseAddedTabs(tabsToClose) {
  try {
    const settings = await window.getSettings();
    if (settings.closeAddedTabs && tabsToClose.length > 0) {
      const tabIds = tabsToClose.map((t) => t.id).filter(isNotNull);
      if (tabIds.length > 0) {
        await log("INFO", `Popup: Closing ${tabIds.length} tabs as per closeAddedTabs setting`);
        await browser.tabs.remove(tabIds);
      }
    }
  } catch (e) {
    await log("ERROR", "Popup: Failed to close tabs", getErrorMessage(e));
  }
}

// ---------------------------------------------------------------------------
// Add videos to resolved playlist
// ---------------------------------------------------------------------------

/**
 * Add videoIds to the currently selected playlist target.
 * @param {string[]} videoIds
 * @param {Tab[]} [videoTabs]
 */
export async function addVideosToResolvedPlaylist(videoIds, videoTabs = []) {
  const btnExecute = getById("btn-execute-add");

  try {
    if (videoIds.length === 0) {
      return alert("No videos to add.");
    }

    // Visual feedback
    if (btnExecute) {
      btnExecute.disabled = true;
      setIcon(btnExecute, "fa-solid fa-spinner fa-spin");
    }

    const settings = await window.getSettings();
    let targetPlaylist;

    if (state.activeTargetMode === "create") {
      await log("INFO", "Popup: Auto-creating new playlist on add...");
      const title = await getSmartDefaultPlaylistName();

      const newId = await window.savePlaylist(
        {
          id: "",
          title,
          videos: [],
          timestamp: Date.now(),
          isLocal: true,
          saved: true,
        },
        { syncToYoutube: false }
      );

      const select = getById("select-target-playlist");
      const opt = document.createElement("option");
      opt.value = newId;
      opt.textContent = title;
      select.appendChild(opt);
      select.value = newId;

      state.selectedPlaylistId = newId;
      state.activeTargetMode = "custom";
      updateTargetUI();

      targetPlaylist = await window.getPlaylist(newId);
    } else if (state.activeTargetMode === "favorite") {
      await log("INFO", "Popup: Resolving favorite playlist...");
      const { id: favId } = await window.ensureWatchLaterPlaylist();
      if (!favId) throw new Error("Could not find favorite playlist.");
      targetPlaylist = await window.getPlaylist(favId);
    } else if (state.activeTargetMode === "latest") {
      await log("INFO", "Popup: Resolving latest playlist...");
      const playlists = await window.getPlaylists();
      if (playlists.length === 0) {
        if (btnExecute) {
          btnExecute.disabled = false;
          btnExecute.style.opacity = "1";
          setIcon(btnExecute, "fa-solid fa-plus");
        }
        return alert("No playlists found. Create one first!");
      }
      targetPlaylist = [...playlists].sort((a, b) => b.timestamp - a.timestamp)[0];
    } else {
      if (!state.selectedPlaylistId) {
        if (btnExecute) {
          btnExecute.disabled = false;
          btnExecute.style.opacity = "1";
          setIcon(btnExecute, "fa-solid fa-plus");
        }
        return alert("Please select a target playlist.");
      }
      targetPlaylist = await window.getPlaylist(state.selectedPlaylistId);
    }

    if (!targetPlaylist) throw new Error("Target playlist not found.");

    const position = settings.addToLatestPosition || "bottom";
    await log("INFO", `Popup: Adding to ${targetPlaylist.title} at ${position}`);

    // Filter out videos already in the playlist
    const newVideoIds = videoIds.filter((id) => !targetPlaylist.videos.includes(id));

    if (newVideoIds.length === 0) {
      if (btnExecute) {
        btnExecute.disabled = false;
        btnExecute.style.opacity = "1";
        setIcon(btnExecute, "fa-solid fa-plus");
      }
      return alert(`Videos are already in the playlist: ${targetPlaylist.title}`, true);
    }

    const updatedVideos = [...targetPlaylist.videos];
    if (position === "top") {
      updatedVideos.unshift(...newVideoIds);
    } else {
      updatedVideos.push(...newVideoIds);
    }
    targetPlaylist.videos = updatedVideos;

    targetPlaylist.timestamp = Date.now();

    const signedIn = await window.isSignedIn();
    const isLocal = targetPlaylist.id.startsWith("local-");

    await window.savePlaylist(targetPlaylist, {
      syncToYoutube: signedIn && !isLocal,
    });

    if (videoTabs.length > 0) {
      await handleCloseAddedTabs(videoTabs);
    }

    alert(`Added ${newVideoIds.length} video(s) to ${targetPlaylist.title}`, true);
    window.close();
  } catch (e) {
    if (btnExecute) {
      btnExecute.disabled = false;
      btnExecute.style.opacity = "1";
      setIcon(btnExecute, "fa-solid fa-plus");
    }
    const msg = getErrorMessage(e);
    await log("ERROR", "Popup: Quick add failed", msg);
    alert("Quick add failed: " + msg);
  }
}
