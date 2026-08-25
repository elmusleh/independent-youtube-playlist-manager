/// <reference path="./popup.d.ts" />
/// <reference path="../playlist-manager/src/types/services.d.ts" />

import { getById, getErrorMessage, log, YOUTUBE_REGEX } from "./utils.js";
import {
  getActiveTab,
  isYoutubeTab,
  getVideoTabsInWindow,
  getAllVideoTabsAcrossWindows,
} from "./tabs.js";
import {
  showChannelModal,
  hideChannelModal,
  detectChannelFromDOM,
  detectChannelFromURL,
  handleChannelImport,
} from "./channel.js";
import { scrapeMetadataFromTabs, addVideosToResolvedPlaylist } from "./quick-add.js";
import { updateTargetUI, initTargetData, loadDefaultTabScope } from "./target.js";
import { state } from "./state.js";

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

async function init() {
  await log("INFO", "Popup: Initializing...");

  // Wait for videoService to be available
  let attempts = 0;
  while (!window.videoService && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  if (!window.videoService) {
    await log("ERROR", "Popup: videoService not found after 3s");
  }

  state.videoService = window.videoService || {
    parseYoutubeId: (url) => {
      const match = YOUTUBE_REGEX.exec(url);
      return match ? match[1] : null;
    },
    parseYoutubeIds: (text) => {
      let matches;
      const videoIds = [];
      const regex = new RegExp(YOUTUBE_REGEX.source, "ig");
      while ((matches = regex.exec(text))) {
        videoIds.push(matches[1]);
      }
      return videoIds;
    },
  };

  state.parseYoutubeId = state.videoService.parseYoutubeId;

  // Initialize theme and target mode
  try {
    // Wait for getSettings to be available
    attempts = 0;
    while (!window.getSettings && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.getSettings) {
      const settings = await window.getSettings();
      let theme = settings.themeChoice;
      if (theme == "device") {
        theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      document.documentElement.dataset.theme = theme;

      if (settings.defaultQuickAddTarget) {
        state.activeTargetMode = settings.defaultQuickAddTarget;
      }
    }
  } catch (e) {
    await log("WARN", "Popup: Could not load settings", getErrorMessage(e));
  }

  setupUI();
  updateTargetUI();

  // Load saved default tab scope preference
  await loadDefaultTabScope();

  // Load playlists
  await initTargetData();

  await log("INFO", "Popup: Initialization complete");
}

// ---------------------------------------------------------------------------
// setupUI
// ---------------------------------------------------------------------------

function setupUI() {
  // Navigation
  getById("open-playlists").onclick = async () => {
    try {
      await log("INFO", "Popup: My Playlists clicked");
      browser.tabs.create({
        url: browser.runtime.getURL("/editor/index.html#/saved"),
      });
      window.close();
    } catch (e) {
      const msg = getErrorMessage(e);
      await log("ERROR", "Popup: Failed to open playlists", msg);
      alert("Failed to open playlists: " + msg);
    }
  };

  getById("open-settings").onclick = async () => {
    try {
      await log("INFO", "Popup: Settings clicked");
      browser.tabs.create({
        url: browser.runtime.getURL("/editor/index.html#/settings"),
      });
      window.close();
    } catch (e) {
      const msg = getErrorMessage(e);
      await log("ERROR", "Popup: Failed to open settings", msg);
      alert("Failed to open settings: " + msg);
    }
  };

  const link = getById("popup-settings-link");
  if (link) {
    link.onclick = getById("open-settings").onclick;
  }

  // Channel Import
  getById("import-channel").onclick = async () => {
    try {
      await log("INFO", "Popup: Import from Channel clicked");
      const activeTab = await getActiveTab();
      if (!activeTab) return alert("No active tab found");

      // Detect channel info
      let channelInfo = await detectChannelFromDOM(activeTab);
      if (!channelInfo) {
        channelInfo = detectChannelFromURL(activeTab.url);
      }

      if (!channelInfo) {
        return alert(
          "Could not detect channel information. Please make sure you're on a YouTube channel page."
        );
      }

      // Update channel info display
      const channelInfoDiv = getById("channel-info");
      if (channelInfoDiv) {
        channelInfoDiv.textContent = `Channel: ${channelInfo.channelName}`;
      }

      showChannelModal();
    } catch (e) {
      const msg = getErrorMessage(e);
      await log("ERROR", "Popup: Failed to open channel modal", msg);
      alert("Failed to open channel modal: " + msg);
    }
  };

  // Back button
  getById("back-to-menu").onclick = hideChannelModal;

  // Modal confirm button - start import
  getById("confirm-import").onclick = () => handleChannelImport(state.videoService);

  getById("save-playlist").onclick = async () => {
    try {
      await log("INFO", "Popup: Save current YouTube playlist clicked");
      const activeTab = await getActiveTab();

      if (!activeTab) throw new Error("No active tab found");

      if (!isYoutubeTab(activeTab)) {
        await log("WARN", "Popup: Active tab is not YouTube");
        return alert("The current tab is not a YouTube playlist tab");
      }

      const tabId = activeTab.id;
      await log("INFO", `Popup: Fetching video IDs from tab ${tabId}`);

      const result = await browser.scripting.executeScript({
        target: { tabId },
        files: ["/content-scripts/injectors/get-playlist-video-ids.js"],
      });

      // Handle both old format (string[]) and new format (objects with id/title/channel/durationLabel)
      const rawResult = result[0].result;
      let videoIds;
      if (rawResult.length > 0 && typeof rawResult[0] === "object" && rawResult[0].id) {
        videoIds = rawResult.map((v) => v.id);
      } else {
        videoIds = rawResult;
      }

      if (!videoIds || videoIds.length == 0) {
        await log("WARN", "Popup: No video IDs returned from content script");
        return alert("The current tab is not a YouTube playlist tab");
      }

      await log("INFO", `Popup: Found ${videoIds.length} videos. Generating playlist object...`);
      const playlist = await state.videoService.generatePlaylist(videoIds);
      const signedIn = await window.isSignedIn();

      await log("INFO", `Popup: Saving playlist (Sync: ${signedIn})`);
      const id = await window.savePlaylist(playlist, {
        syncToYoutube: signedIn,
      });

      await log("INFO", `Popup: Playlist saved with ID: ${id}. Opening editor...`);
      const savedParam = id.startsWith("local-") ? "local=true" : "saved=true";
      await browser.tabs.create({
        url: browser.runtime.getURL(`/editor/index.html?id=${id}&${savedParam}#/editor`),
      });
      window.close();
    } catch (e) {
      await log("ERROR", "Popup: Failed to save playlist", getErrorMessage(e));
      alert("Failed to save playlist: " + getErrorMessage(e));
    }
  };

  // Quick Add - Target Selection
  getById("btn-target-fav").onclick = () => {
    state.activeTargetMode = "favorite";
    updateTargetUI();
  };
  getById("btn-target-latest").onclick = () => {
    state.activeTargetMode = "latest";
    updateTargetUI();
  };
  getById("select-target-playlist").onchange = (e) => {
    const target = e.target;
    if (!target) return;
    if (target.value === "__create_new__") {
      state.activeTargetMode = "create";
      updateTargetUI();
    } else {
      state.activeTargetMode = "custom";
      state.selectedPlaylistId = target.value;
      updateTargetUI();
    }
  };

  // Quick Add - Execute button with dropdown scope
  getById("btn-execute-add").onclick = async () => {
    const scope = getById("select-tab-scope").value;
    const currentTab = await getActiveTab();

    if (!currentTab || !currentTab.url) return alert("No active tab found");

    const videoId = state.parseYoutubeId(currentTab.url);
    if (
      !videoId &&
      scope !== "left" &&
      scope !== "right" &&
      scope !== "all-this-window-include" &&
      scope !== "all-this-window-exclude" &&
      scope !== "all-windows"
    ) {
      return alert("The current tab is not a YouTube video");
    }

    const currentIndex = currentTab.index;

    switch (scope) {
      case "current":
        if (!videoId) return alert("The current tab is not a YouTube video");
        await scrapeMetadataFromTabs([currentTab]);
        await addVideosToResolvedPlaylist([videoId], [currentTab]);
        return;

      case "left": {
        const videoTabs = await getVideoTabsInWindow(
          currentTab.windowId,
          (tab) => tab.index < currentIndex
        );
        if (videoTabs.length === 0) return alert("No YouTube video tabs found to the left");
        await scrapeMetadataFromTabs(videoTabs);
        const videoIds = videoTabs.map((tab) => state.parseYoutubeId(tab.url)).filter(Boolean);
        const uniqueIds = [...new Set(videoIds)];
        if (uniqueIds.length === 0) return alert("No YouTube video tabs found");
        await addVideosToResolvedPlaylist(uniqueIds, videoTabs);
        return;
      }

      case "right": {
        const videoTabs = await getVideoTabsInWindow(
          currentTab.windowId,
          (tab) => tab.index > currentIndex
        );
        if (videoTabs.length === 0) return alert("No YouTube video tabs found to the right");
        await scrapeMetadataFromTabs(videoTabs);
        const videoIds = videoTabs.map((tab) => state.parseYoutubeId(tab.url)).filter(Boolean);
        const uniqueIds = [...new Set(videoIds)];
        if (uniqueIds.length === 0) return alert("No YouTube video tabs found");
        await addVideosToResolvedPlaylist(uniqueIds, videoTabs);
        return;
      }

      case "all-this-window-include": {
        const videoTabs = await getVideoTabsInWindow(currentTab.windowId, () => true);
        if (videoTabs.length === 0) return alert("No YouTube video tabs found in this window");
        await scrapeMetadataFromTabs(videoTabs);
        const videoIds = videoTabs.map((tab) => state.parseYoutubeId(tab.url)).filter(Boolean);
        const uniqueIds = [...new Set(videoIds)];
        if (uniqueIds.length === 0) return alert("No YouTube video tabs found");
        await addVideosToResolvedPlaylist(uniqueIds, videoTabs);
        return;
      }

      case "all-this-window-exclude": {
        const videoTabs = await getVideoTabsInWindow(
          currentTab.windowId,
          (tab) => tab.index !== currentIndex
        );
        if (videoTabs.length === 0)
          return alert("No other YouTube video tabs found in this window");
        await scrapeMetadataFromTabs(videoTabs);
        const videoIds = videoTabs.map((tab) => state.parseYoutubeId(tab.url)).filter(Boolean);
        const uniqueIds = [...new Set(videoIds)];
        if (uniqueIds.length === 0) return alert("No YouTube video tabs found");
        await addVideosToResolvedPlaylist(uniqueIds, videoTabs);
        return;
      }

      case "all-windows": {
        const videoTabs = await getAllVideoTabsAcrossWindows();
        if (videoTabs.length === 0) return alert("No YouTube video tabs found");
        await scrapeMetadataFromTabs(videoTabs);
        const videoIds = videoTabs.map((tab) => state.parseYoutubeId(tab.url)).filter(Boolean);
        const uniqueIds = [...new Set(videoIds)];
        if (uniqueIds.length === 0) return alert("No YouTube video tabs found");
        await addVideosToResolvedPlaylist(uniqueIds, videoTabs);
        return;
      }

      default:
        return alert("Invalid scope selected");
    }
  };

  // Kick off target data loading (plays nicely alongside init already calling it)
  initTargetData();
}

// Bootstrap
init();
