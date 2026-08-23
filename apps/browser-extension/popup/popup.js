/// <reference path="./popup.d.ts" />
/// <reference path="../playlist-editor/src/types/services.d.ts" />

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

let videoService;
let parseYoutubeId;
let activeTargetMode = "latest"; // "favorite", "latest", "custom"
let selectedPlaylistId = null;

const getErrorMessage = (e) => (e instanceof Error ? e.message : String(e));

function setIcon(element, className) {
  element.textContent = "";
  const i = document.createElement("i");
  i.className = className;
  element.appendChild(i);
}

// Fallback regex if window.youtubeRegexPattern is missing
const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be\/|be.com\/\S*(?:watch|embed|shorts)(?:(?:(?=\/[-a-zA-Z0-9_]{11,}(?!\S))\/)|(?:\S*v=|v\/)))([-a-zA-Z0-9_]{11,})/;

/**
 * @param {"INFO" | "ERROR" | "WARN"} level
 * @param {string} message
 * @param {any} [details]
 */
async function log(level, message, details = null) {
  console.log(`[${level}] ${message}`, details || "");
  if (window.logSystemEvent) {
    try {
      await window.logSystemEvent(level, message, details);
    } catch (e) {
      console.error("Failed to log to system logs:", getErrorMessage(e));
    }
  }
}

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

  videoService = window.videoService || {
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

  parseYoutubeId = videoService.parseYoutubeId;

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
        theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      document.documentElement.dataset.theme = theme;

      if (settings.defaultQuickAddTarget) {
        activeTargetMode = settings.defaultQuickAddTarget;
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
          "Could not detect channel information. Please make sure you're on a YouTube channel page.",
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
  getById("confirm-import").onclick = handleChannelImport;

  getById("save-playlist").onclick = async () => {
    try {
      await log("INFO", "Popup: Save current YouTube playlist clicked");
      const activeTab = await getActiveTab();

      if (!activeTab) throw new Error("No active tab found");

      if (!isYoutubeTab(activeTab)) {
        await log("WARN", "Popup: Active tab is not YouTube");
        return alert("The current tab is not a YouTube playlist tab");
      }

      /** @type {any} */ const tabId = activeTab.id;
      await log("INFO", `Popup: Fetching video IDs from tab ${tabId}`);

      const result = await /** @type {any} */ (browser).scripting.executeScript(
        {
          target: { tabId },
          files: ["/content-scripts/injectors/get-playlist-video-ids.js"],
        },
      );

      // Handle both old format (string[]) and new format (objects with id/title/channel/durationLabel)
      const rawResult = result[0].result;
      let videoIds;
      if (
        rawResult.length > 0 &&
        typeof rawResult[0] === "object" &&
        rawResult[0].id
      ) {
        // New format: extract IDs from objects
        videoIds = rawResult.map((v) => v.id);
      } else {
        // Old format: already string array
        videoIds = rawResult;
      }

      if (!videoIds || videoIds.length == 0) {
        await log("WARN", "Popup: No video IDs returned from content script");
        return alert("The current tab is not a YouTube playlist tab");
      }

      await log(
        "INFO",
        `Popup: Found ${videoIds.length} videos. Generating playlist object...`,
      );
      const playlist = await videoService.generatePlaylist(videoIds);
      const signedIn = await window.isSignedIn();

      await log("INFO", `Popup: Saving playlist (Sync: ${signedIn})`);
      const id = await window.savePlaylist(playlist, {
        syncToYoutube: signedIn,
      });

      await log(
        "INFO",
        `Popup: Playlist saved with ID: ${id}. Opening editor...`,
      );
      const savedParam = id.startsWith("local-") ? "local=true" : "saved=true";
      await browser.tabs.create({
        url: browser.runtime.getURL(
          `/editor/index.html?id=${id}&${savedParam}#/editor`,
        ),
      });
      window.close();
    } catch (e) {
      await log("ERROR", "Popup: Failed to save playlist", getErrorMessage(e));
      alert("Failed to save playlist: " + getErrorMessage(e));
    }
  };

  // Quick Add - Target Selection
  getById("btn-target-fav").onclick = () => {
    activeTargetMode = "favorite";
    updateTargetUI();
  };
  getById("btn-target-latest").onclick = () => {
    activeTargetMode = "latest";
    updateTargetUI();
  };
  getById("select-target-playlist").onchange = (e) => {
    const target = /** @type {HTMLSelectElement} */ (e.target);
    if (!target) return;
    if (target.value === "__create_new__") {
      activeTargetMode = "create";
      updateTargetUI();
    } else {
      activeTargetMode = "custom";
      selectedPlaylistId = target.value;
      updateTargetUI();
    }
  };

  // Quick Add - Execute button with dropdown scope
  getById("btn-execute-add").onclick = async () => {
    const scope = getById("select-tab-scope").value;
    const currentTab = await getActiveTab();

    if (!currentTab || !currentTab.url) return alert("No active tab found");

    const videoId = parseYoutubeId(currentTab.url);
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
    let videoTabs = [];

    switch (scope) {
      case "current":
        if (!videoId) return alert("The current tab is not a YouTube video");
        await scrapeMetadataFromTabs([currentTab]);
        await addVideosToResolvedPlaylist([videoId], [currentTab]);
        return;

      case "left":
        videoTabs = await getVideoTabsInWindow(
          currentTab.windowId,
          (tab) => tab.index < currentIndex,
        );
        if (videoTabs.length === 0)
          return alert("No YouTube video tabs found to the left");
        break;

      case "right":
        videoTabs = await getVideoTabsInWindow(
          currentTab.windowId,
          (tab) => tab.index > currentIndex,
        );
        if (videoTabs.length === 0)
          return alert("No YouTube video tabs found to the right");
        break;

      case "all-this-window-include":
        videoTabs = await getVideoTabsInWindow(currentTab.windowId, () => true);
        if (videoTabs.length === 0)
          return alert("No YouTube video tabs found in this window");
        break;

      case "all-this-window-exclude":
        videoTabs = await getVideoTabsInWindow(
          currentTab.windowId,
          (tab) => tab.index !== currentIndex,
        );
        if (videoTabs.length === 0)
          return alert("No other YouTube video tabs found in this window");
        break;

      case "all-windows":
        videoTabs = await getAllVideoTabsAcrossWindows();
        if (videoTabs.length === 0) return alert("No YouTube video tabs found");
        break;

      default:
        return alert("Invalid scope selected");
    }

    await scrapeMetadataFromTabs(videoTabs);
    const videoIds = videoTabs
      .map((tab) => parseYoutubeId(tab.url))
      .filter(isNotNull);
    const uniqueIds = removeDuplicates(videoIds);
    if (uniqueIds.length === 0) return alert("No YouTube video tabs found");
    await addVideosToResolvedPlaylist(uniqueIds, videoTabs);
  };

  initTargetData();
}

/**
 * Scrapes metadata (title, channel, ISO duration) from a list of YouTube tabs
 * and persists it to the shared video metadata cache.
 * @param {Tab[]} tabs
 */
async function scrapeMetadataFromTabs(tabs) {
  const VIDEO_META_CACHE_KEY = "yph_video_metadata_cache";
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

      // Helper to convert ISO 8601 to seconds
      const isoToSeconds = (iso) => {
        if (!iso) return 0;
        const match = iso.match(
          /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/,
        );
        if (!match) return 0;
        const d = parseInt(match[1] || "0", 10);
        const h = parseInt(match[2] || "0", 10);
        const m = parseInt(match[3] || "0", 10);
        const s = parseFloat(match[4] || "0");
        return d * 86400 + h * 3600 + m * 60 + Math.floor(s);
      };

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
      await log(
        "INFO",
        `Popup: Persisted metadata for ${results.length} videos from tabs`,
      );
    } catch (e) {
      console.error("[YPH] Failed to save metadata to cache:", e);
    }
  }

  return results;
}

function updateTargetUI() {
  getById("btn-target-fav").classList.toggle(
    "active",
    activeTargetMode === "favorite",
  );
  getById("btn-target-latest").classList.toggle(
    "active",
    activeTargetMode === "latest",
  );
  const select = getById("select-target-playlist");
  if (activeTargetMode === "custom") {
    select.classList.add("active");
  } else if (activeTargetMode === "create") {
    select.value = "__create_new__";
    select.classList.add("active");
  } else {
    select.value = "";
    select.classList.remove("active");
  }
}

async function getSmartDefaultPlaylistName() {
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

async function initTargetData() {
  try {
    // Wait a bit for window.getPlaylists to be available
    let attempts = 0;
    while (!window.getPlaylists && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.getPlaylists) {
      await log("WARN", "Popup: getPlaylists not available");
      return;
    }

    const playlists = await window.getPlaylists();
    const select = getById("select-target-playlist");

    // Sort by timestamp (newest first) - "My playlists" appears at top
    const sorted = [...playlists].sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
    );

    // Show default playlist based on settings or default to latest
    const settingsObj = window.getSettings ? await window.getSettings() : null;
    const defaultMode = settingsObj?.defaultQuickAddTarget || "latest";

    if (defaultMode === "create") {
      activeTargetMode = "create";
      selectedPlaylistId = null;
    } else if (defaultMode === "favorite") {
      activeTargetMode = "favorite";
      selectedPlaylistId = null;
    } else {
      activeTargetMode = "latest";
      selectedPlaylistId = null;
    }

    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "More...";
    select.appendChild(placeholder);
    const createNew = document.createElement("option");
    createNew.value = "__create_new__";
    createNew.textContent = "✚ Create new...";
    select.appendChild(createNew);
    sorted.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.title;
      select.appendChild(opt);
    });

    // Update UI to reflect the default selection
    updateTargetUI();


  } catch (e) {
    await log("ERROR", "Failed to init target data", e);
  }
}

async function handleCloseAddedTabs(tabsToClose) {
  try {
    const settings = await window.getSettings();
    if (settings.closeAddedTabs && tabsToClose.length > 0) {
      const tabIds = tabsToClose.map((t) => t.id).filter(isNotNull);
      if (tabIds.length > 0) {
        await log(
          "INFO",
          `Popup: Closing ${tabIds.length} tabs as per closeAddedTabs setting`,
        );
        await browser.tabs.remove(tabIds);
      }
    }
  } catch (e) {
    await log("ERROR", "Popup: Failed to close tabs", getErrorMessage(e));
  }
}

async function addVideosToResolvedPlaylist(videoIds, videoTabs = []) {
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

    if (activeTargetMode === "create") {
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
        { syncToYoutube: false },
      );
      
      const select = getById("select-target-playlist");
      const opt = document.createElement("option");
      opt.value = newId;
      opt.textContent = title;
      select.appendChild(opt);
      select.value = newId;
      
      selectedPlaylistId = newId;
      activeTargetMode = "custom";
      updateTargetUI();
      
      targetPlaylist = await window.getPlaylist(newId);
    } else if (activeTargetMode === "favorite") {
      await log("INFO", "Popup: Resolving favorite playlist...");
      const { id: favId } = await window.ensureWatchLaterPlaylist();
      if (!favId) throw new Error("Could not find favorite playlist.");
      targetPlaylist = await window.getPlaylist(favId);
    } else if (activeTargetMode === "latest") {
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
      targetPlaylist = [...playlists].sort(
        (a, b) => b.timestamp - a.timestamp,
      )[0];
    } else {
      if (!selectedPlaylistId) {
        if (btnExecute) {
          btnExecute.disabled = false;
          btnExecute.style.opacity = "1";
          setIcon(btnExecute, "fa-solid fa-plus");
        }
        return alert("Please select a target playlist.");
      }
      targetPlaylist = await window.getPlaylist(selectedPlaylistId);
    }

    if (!targetPlaylist) throw new Error("Target playlist not found.");

    const position = settings.addToLatestPosition || "bottom";
    await log(
      "INFO",
      `Popup: Adding to ${targetPlaylist.title} at ${position}`,
    );

    // Filter out videos already in the playlist
    const newVideoIds = videoIds.filter(
      (id) => !targetPlaylist.videos.includes(id),
    );

    if (newVideoIds.length === 0) {
      if (btnExecute) {
        btnExecute.disabled = false;
        btnExecute.style.opacity = "1";
        setIcon(btnExecute, "fa-solid fa-plus");
      }
      return alert(
        `Videos are already in the playlist: ${targetPlaylist.title}`,
        true,
      );
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

    alert(
      `Added ${newVideoIds.length} video(s) to ${targetPlaylist.title}`,
      true,
    );
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

async function loadDefaultTabScope() {
  try {
    // Wait a bit for window.getSettings to be available
    let attempts = 0;
    while (!window.getSettings && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.getSettings) {
      const settings = await window.getSettings();
      const defaultScope =
        settings.defaultTabScope || "all-this-window-include";
      getById("select-tab-scope").value = defaultScope;
    } else {
      getById("select-tab-scope").value = "all-this-window-include";
    }
  } catch (e) {
    getById("select-tab-scope").value = "all-this-window-include";
  }
}

async function getVideoTabsInWindow(windowId, filterFn) {
  const allTabs = await browser.tabs.query({ windowId });
  return allTabs.filter((tab) => {
    if (!tab.url) return false;
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname.toLowerCase();
      const isYoutube =
        hostname === "youtube.com" || hostname.endsWith(".youtube.com");
      const isShort = hostname === "youtu.be";
      const isVideo = (isYoutube && url.pathname.includes("/watch")) || isShort;
      return isVideo && (!filterFn || filterFn(tab));
    } catch (e) {
      return false;
    }
  });
}

async function getAllVideoTabsAcrossWindows() {
  const allTabs = await browser.tabs.query({});
  return allTabs.filter((tab) => {
    if (!tab.url) return false;
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname.toLowerCase();
      const isYoutube =
        hostname === "youtube.com" || hostname.endsWith(".youtube.com");
      const isShort = hostname === "youtu.be";
      return (isYoutube && url.pathname.includes("/watch")) || isShort;
    } catch (e) {
      return false;
    }
  });
}

init();

/***********************************
 *            Tabs
 ***********************************/

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

/**
 * @param  {browser.tabs.Tab} tab
 */
function isYoutubeTab(tab) {
  try {
    const url = new URL(tab.url || "");
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be"
    );
  } catch (e) {
    return false;
  }
}

/**
 * Check if the current tab is on a YouTube channel page
 */
function isChannelPage(tab) {
  try {
    const url = new URL(tab.url || "");
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    if (!isYoutubeTab(tab)) return false;

    // Channel page patterns
    const channelPatterns = [
      /^\/channel\//, // /channel/UCxxxx
      /^\/c\//, // /c/channelname
      /^\/user\//, // /user/username
      /^\/@/, // /handle
      /^\/videos$/, // /videos
      /^\/shorts$/, // /shorts
      /^\/streams$/, // /streams
      /^\/playlists$/, // /playlists
      /^\/featured$/, // /featured
    ];

    return channelPatterns.some((pattern) => pattern.test(pathname));
  } catch (e) {
    return false;
  }
}

/**
 * Show the channel import page
 */
function showChannelModal() {
  const page = getById("channel-page");
  const mainMenu = getById("main-menu");
  const quickAdd = getById("quick-add-container");
  const menuDivider = getById("menu-divider");
  const header = getById("popup-header");

  if (header) header.style.display = "none";
  if (quickAdd) quickAdd.style.display = "none";
  if (menuDivider) menuDivider.style.display = "none";
  if (mainMenu) mainMenu.style.display = "none";
  if (page) page.style.display = "block";
}

/**
 * Hide the channel import page
 */
function hideChannelModal() {
  const page = getById("channel-page");
  const mainMenu = getById("main-menu");
  const quickAdd = getById("quick-add-container");
  const menuDivider = getById("menu-divider");
  const header = getById("popup-header");

  if (page) page.style.display = "none";
  if (header) header.style.display = "flex";
  if (quickAdd) quickAdd.style.display = "block";
  if (menuDivider) menuDivider.style.display = "block";
  if (mainMenu) mainMenu.style.display = "block";

  // Reset progress section
  const progressSection = getById("progress-section");
  if (progressSection) progressSection.style.display = "none";

  const progressFill = getById("progress-fill");
  if (progressFill) progressFill.style.width = "0%";

  const progressText = getById("progress-text");
  if (progressText) progressText.textContent = "Initializing...";
}

/**
 * Update progress in the modal
 */
function updateProgress(percent, message) {
  const progressFill = getById("progress-fill");
  const progressText = getById("progress-text");

  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressText) progressText.textContent = message;
}

/**
 * Detect channel from DOM using content script
 */
async function detectChannelFromDOM(tab) {
  try {
    const result = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/content-scripts/injectors/get-channel-metadata.js"],
    });

    const metadata = result[0]?.result;
    if (metadata && metadata.channelId && metadata.channelName) {
      await log(
        "INFO",
        `Popup: Detected channel from DOM: ${metadata.channelName} (${metadata.channelId})`,
      );
      return metadata;
    }
  } catch (e) {
    await log(
      "WARN",
      "Popup: Failed to detect channel from DOM",
      getErrorMessage(e),
    );
  }
  return null;
}

/**
 * Detect channel from URL
 */
function detectChannelFromURL(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // Try to extract channel ID from various URL patterns
    const channelMatch = pathname.match(/\/channel\/([^/?]+)/);
    if (channelMatch) {
      return { channelId: channelMatch[1], channelName: "Channel" };
    }

    const handleMatch = pathname.match(/\/@([^/?]+)/);
    if (handleMatch) {
      return { channelId: handleMatch[1], channelName: `@${handleMatch[1]}` };
    }

    const customMatch = pathname.match(/\/c\/([^/?]+)/);
    if (customMatch) {
      return { channelId: customMatch[1], channelName: customMatch[1] };
    }

    const userMatch = pathname.match(/\/user\/([^/?]+)/);
    if (userMatch) {
      return { channelId: userMatch[1], channelName: userMatch[1] };
    }
  } catch (e) {
    console.warn("Popup: Failed to parse channel from URL", e);
  }
  return null;
}

/**
 * Handle the channel import workflow
 */
async function handleChannelImport() {
  const confirmBtn = getById("confirm-import");
  const progressSection = getById("progress-section");
  const progressText = getById("progress-text");
  const progressFill = getById("progress-fill");
  const channelInfo = getById("channel-info");

  try {
    // Disable button during import
    if (confirmBtn) confirmBtn.disabled = true;
    if (progressSection) progressSection.style.display = "block";

    // Get selected options
    const quantity = parseInt(getById("input-quantity").value, 10) || 25;
    const order = getById("select-order").value;

    await log(
      "INFO",
      `Popup: Starting page import - Quantity: ${quantity}, Order: ${order}`,
    );

    // Get active tab
    updateProgress(10, "Detecting page...");
    const activeTab = await getActiveTab();
    if (!activeTab) throw new Error("No active tab found");
    if (!activeTab.id) throw new Error("Active tab has no ID");

    // Determine if this is a YouTube channel page
    const isChannelPage = activeTab.url && isYoutubeChannelPage(activeTab.url);
    await log("INFO", `Popup: Is channel page: ${isChannelPage}`);

    let videoIds = [];
    let pageTitle = activeTab.title || "Import";
    let scrapeResult;

    if (isChannelPage) {
      // Use channel-specific scraper with scrolling logic
      updateProgress(20, "Fetching videos from channel...");

      // Set target quantity as global variable
      await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (targetQuantity) => {
          window["YPH_TARGET_QUANTITY"] = targetQuantity;
        },
        args: [quantity],
      });

      const result = await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["/content-scripts/injectors/get-channel-video-ids.js"],
      });

      const rawVideos = result[0]?.result || [];
      await log("INFO", `Popup: Found ${rawVideos.length} videos on channel`);

      videoIds = rawVideos.map((v) => v.id);
      pageTitle = activeTab.title || "Channel Videos";

      // Show page info
      if (channelInfo) {
        channelInfo.textContent = `Found ${rawVideos.length} video(s) from channel`;
      }
    } else {
      // Use general page scraper
      updateProgress(20, "Scraping YouTube links...");
      let result;
      try {
        result = await browser.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["/content-scripts/injectors/scrape-youtube-links.js"],
        });
        await log(
          "INFO",
          `Popup: Script execution result: ${JSON.stringify(result)}`,
        );
      } catch (e) {
        await log(
          "ERROR",
          `Popup: Script execution failed: ${getErrorMessage(e)}`,
        );
        throw new Error(
          `Failed to execute scraping script: ${getErrorMessage(e)}`,
        );
      }

      scrapeResult = result[0]?.result || {
        count: 0,
        links: [],
        url: activeTab.url,
        title: activeTab.title,
      };
      await log(
        "INFO",
        `Popup: Scrape result: ${JSON.stringify(scrapeResult)}`,
      );
      await log(
        "INFO",
        `Popup: Found ${scrapeResult.count} YouTube links on page`,
      );

      videoIds = scrapeResult.links.map((link) => link.id);
      pageTitle = scrapeResult.title || "Page Links";

      // Show page info
      if (channelInfo) {
        channelInfo.textContent = `Found ${scrapeResult.count} YouTube link(s) on: ${scrapeResult.title}`;
      }
    }

    updateProgress(40, `Found ${videoIds.length} videos...`);

    if (videoIds.length === 0) {
      throw new Error("No YouTube videos found on this page");
    }

    // Apply quantity limit
    let filteredIds = videoIds;
    if (quantity > 0 && filteredIds.length > quantity) {
      filteredIds = filteredIds.slice(0, quantity);
    }

    // Apply ordering
    if (order === "oldest") {
      filteredIds = filteredIds.reverse();
    }

    await log(
      "INFO",
      `Popup: Processing ${filteredIds.length} videos after filtering`,
    );
    updateProgress(50, `Processing ${filteredIds.length} videos...`);

    // Create playlist
    updateProgress(60, "Creating playlist...");
    const playlistName = `${pageTitle}`;
    const signedIn = await window.isSignedIn();

    const playlist = await videoService.generatePlaylist(filteredIds);
    playlist.title = playlistName;
    playlist.timestamp = Date.now();

    const id = await window.savePlaylist(playlist, { syncToYoutube: signedIn });
    await log("INFO", `Popup: Playlist created with ID: ${id}`);
    updateProgress(80, "Playlist created...");

    updateProgress(100, "Import complete!");
    await log(
      "INFO",
      `Popup: Successfully imported ${filteredIds.length} videos`,
    );

    // Open the editor
    const savedParam = id.startsWith("local-") ? "local=true" : "saved=true";
    await browser.tabs.create({
      url: browser.runtime.getURL(
        `/editor/index.html?id=${id}&${savedParam}#/editor`,
      ),
    });

    window.close();
  } catch (e) {
    const msg = getErrorMessage(e);
    await log("ERROR", "Popup: Page import failed", msg);
    alert("Import failed: " + msg);

    // Re-enable button on error
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

/**
 * Check if URL is a YouTube channel page
 */
function isYoutubeChannelPage(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    if (hostname !== "youtube.com" && !hostname.endsWith(".youtube.com")) return false;

    const channelPatterns = [
      /^\/channel\//,
      /^\/c\//,
      /^\/user\//,
      /^\/@/,
      /^\/videos$/,
    ];

    return channelPatterns.some((pattern) => pattern.test(pathname));
  } catch (e) {
    return false;
  }
}

/***********************************
 *            Utils
 ***********************************/

/**
 * @param {T | null | undefined} argument
 * @returns {argument is T}
 * @template T
 */
function isNotNull(argument) {
  return argument != null;
}

/**
 * @param  {string} id
 * @returns {HTMLInputElement}
 */
function getById(id) {
  // @ts-ignore
  return document.getElementById(id);
}

/**
 * @param {string} message
 * @param {boolean=} isInfo
 */
async function alert(message, isInfo) {
  const isAndroid = /Android/i.test(navigator.userAgent);
  browser.notifications.create({
    type: "basic",
    title: "Playlist Manager" + (isInfo ? "" : ": Error"),
    message: message,
    ...(isAndroid ? {} : { iconUrl: "../icons/icon_48.png" }),
  });
}

/**
 * @param  {string[]} array
 * @returns {string[]}
 */
function removeDuplicates(array) {
  return Array.from(new Set(array));
}
