/* eslint-disable no-console */
/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

import { getById, getErrorMessage, setIcon, log, alert, isNotNull } from "./utils.js";
import { getActiveTab, getVideoTabsInWindow, getAllVideoTabsAcrossWindows } from "./tabs.js";
import { state } from "./state.js";
import { updateTargetUI } from "./target.js";
import { scrapeMetadataFromTabs } from "./scrape-tabs.js";

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

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

// ---------------------------------------------------------------------------
// Quick Add by scope (extracted from popup.js setupUI)
// ---------------------------------------------------------------------------

/**
 * Resolve tabs and empty-message for the given scope.
 * @param {string} scope
 * @param {Tab} currentTab
 * @param {string} videoId
 * @returns {Promise<{tabs: Tab[], emptyMsg: string} | null>} null = early return already handled
 */
async function resolveTabsForScope(scope, currentTab, videoId) {
  const idx = currentTab.index;

  switch (scope) {
    case "current":
      if (!videoId) {
        alert("The current tab is not a YouTube video");
        return null;
      }
      return { tabs: [currentTab], emptyMsg: "No YouTube video tabs found" };

    case "left":
      return {
        tabs: await getVideoTabsInWindow(currentTab.windowId, (t) => t.index < idx),
        emptyMsg: "No YouTube video tabs found to the left",
      };
    case "right":
      return {
        tabs: await getVideoTabsInWindow(currentTab.windowId, (t) => t.index > idx),
        emptyMsg: "No YouTube video tabs found to the right",
      };
    case "all-this-window-include":
      return {
        tabs: await getVideoTabsInWindow(currentTab.windowId, () => true),
        emptyMsg: "No YouTube video tabs found in this window",
      };
    case "all-this-window-exclude":
      return {
        tabs: await getVideoTabsInWindow(currentTab.windowId, (t) => t.index !== idx),
        emptyMsg: "No other YouTube video tabs found in this window",
      };
    case "all-windows":
      return {
        tabs: await getAllVideoTabsAcrossWindows(),
        emptyMsg: "No YouTube video tabs found",
      };
    default:
      alert("Invalid scope selected");
      return null;
  }
}

/**
 * Execute the quick-add action based on the selected tab scope.
 * @param {"current"|"left"|"right"|"all-this-window-include"|"all-this-window-exclude"|"all-windows"} scope
 */
export async function executeQuickAddByScope(scope) {
  const currentTab = await getActiveTab();
  if (!currentTab || !currentTab.url) return alert("No active tab found");

  const videoId = state.parseYoutubeId(currentTab.url);
  const needsVideoId = ![
    "left",
    "right",
    "all-this-window-include",
    "all-this-window-exclude",
    "all-windows",
  ].includes(scope);
  if (!videoId && needsVideoId) return alert("The current tab is not a YouTube video");

  const resolved = await resolveTabsForScope(scope, currentTab, videoId);
  if (!resolved) return;

  const { tabs, emptyMsg } = resolved;
  if (tabs.length === 0) return alert(emptyMsg);

  await scrapeMetadataFromTabs(tabs);
  const videoIds = tabs.map((t) => state.parseYoutubeId(t.url)).filter(Boolean);
  const uniqueIds = [...new Set(videoIds)];
  if (uniqueIds.length === 0) return alert("No YouTube video tabs found");
  await addVideosToResolvedPlaylist(uniqueIds, tabs);
}
