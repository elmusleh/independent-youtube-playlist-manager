/// <reference path="./popup.d.ts" />
/// <reference path="../playlist-manager/src/types/services.d.ts" />

import { getById, getErrorMessage, log, YOUTUBE_REGEX } from "./utils.js";
import { getActiveTab, isYoutubeTab } from "./tabs.js";
import {
  showChannelModal,
  hideChannelModal,
  isYoutubeChannelPage,
  handleChannelImport,
} from "./channel.js";
import { executeQuickAddByScope } from "./quick-add.js";
import { updateTargetUI, initTargetData, loadDefaultTabScope } from "./target.js";
import { state } from "./state.js";
import { preparePageImport, showPageImportError, pageAccessError } from "./page-import.js";

// ---------------------------------------------------------------------------
// Editor service modules, lazy-loaded so they never block first paint or the
// click handlers below. The popup only needs their window.* globals
// (getSettings, getPlaylists, videoService, logSystemEvent, …).
// ---------------------------------------------------------------------------
let editorModulesPromise = null;

function loadEditorModules() {
  if (!editorModulesPromise) {
    editorModulesPromise = Promise.all([
      import("../editor/youtube-auth.js"),
      import("../editor/youtube-api.js"),
      import("../editor/storage-service.js"),
      import("../editor/utils.js"),
      import("../editor/video-service.js"),
    ]).catch((e) => {
      log("WARN", "Popup: could not load editor modules", getErrorMessage(e));
    });
  }
  return editorModulesPromise;
}

/** Minimal local fallback so quick-add never depends on a loaded module. */
function fallbackVideoService() {
  return {
    parseYoutubeId: (url) => {
      const match = YOUTUBE_REGEX.exec(url);
      return match ? match[1] : null;
    },
    parseYoutubeIds: (text) => {
      const videoIds = [];
      const regex = new RegExp(YOUTUBE_REGEX.source, "ig");
      let match;
      while ((match = regex.exec(text))) videoIds.push(match[1]);
      return videoIds;
    },
  };
}

// ---------------------------------------------------------------------------
// Click handlers — wired synchronously at module evaluation, before any await,
// so the popup is interactive on first paint.
// ---------------------------------------------------------------------------

function bind(id, handler) {
  const el = getById(id);
  if (!el) return;
  el.onclick = handler;
  const tag = el.tagName.toLowerCase();
  if (tag !== "button" && tag !== "a") {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler(e);
      }
    });
  }
}

async function openPlaylists() {
  try {
    await log("INFO", "Popup: My Playlists clicked");
    browser.tabs.create({ url: browser.runtime.getURL("/editor/index.html#/saved") });
    window.close();
  } catch (e) {
    const msg = getErrorMessage(e);
    await log("ERROR", "Popup: Failed to open playlists", msg);
    alert("Failed to open playlists: " + msg);
  }
}

async function openSettings() {
  try {
    await log("INFO", "Popup: Settings clicked");
    browser.tabs.create({ url: browser.runtime.getURL("/editor/index.html#/settings") });
    window.close();
  } catch (e) {
    const msg = getErrorMessage(e);
    await log("ERROR", "Popup: Failed to open settings", msg);
    alert("Failed to open settings: " + msg);
  }
}

async function openChannelImport() {
  try {
    await log("INFO", "Popup: Import from Channel clicked");
    const activeTab = await preparePageImport();
    const channelInfoDiv = getById("channel-info");
    if (channelInfoDiv) {
      channelInfoDiv.textContent = `${isYoutubeChannelPage(activeTab.url) ? "Channel" : "Page"}: ${
        activeTab.title || new URL(activeTab.url).hostname
      }`;
    }
    showChannelModal();
  } catch (e) {
    const msg = getErrorMessage(e);
    await log("ERROR", "Popup: Failed to open channel modal", msg);
    showPageImportError(pageAccessError(e));
  }
}

async function savePlaylist() {
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

    // Support both the legacy string[] shape and the object[] shape (id/title/...).
    const rawResult = result[0].result;
    const videoIds =
      rawResult.length > 0 && typeof rawResult[0] === "object" && rawResult[0].id
        ? rawResult.map((v) => v.id)
        : rawResult;

    if (!videoIds || videoIds.length === 0) {
      await log("WARN", "Popup: No video IDs returned from content script");
      return alert("The current tab is not a YouTube playlist tab");
    }

    const current = await browser.tabs.get(tabId);
    if (
      current.url !== activeTab.url ||
      current.windowId !== activeTab.windowId ||
      current.incognito
    ) {
      throw new Error("The playlist page changed or is private. Retry on the source page.");
    }

    const response = await browser.runtime.sendMessage({
      cmd: "capture",
      action: "start",
      args: {
        ids: videoIds,
        mode: "new",
        review: true,
        title: activeTab.title || "Saved YouTube playlist",
        sourceTabId: tabId,
        sourceTabUrl: activeTab.url,
      },
    });
    if (!response?.ok) throw new Error(response?.error || "Could not open playlist review.");
    window.close();
  } catch (e) {
    await log("ERROR", "Popup: Failed to save playlist", getErrorMessage(e));
    alert("Failed to save playlist: " + getErrorMessage(e));
  }
}

function wireUI() {
  bind("open-playlists", openPlaylists);
  bind("open-settings", openSettings);
  bind("popup-settings-link", openSettings);
  bind("import-channel", openChannelImport);
  bind("back-to-menu", hideChannelModal);
  bind("save-playlist", savePlaylist);

  const confirm = getById("confirm-import");
  if (confirm) confirm.onclick = () => handleChannelImport(state.videoService);

  const fav = getById("btn-target-fav");
  if (fav) {
    fav.onclick = () => {
      state.activeTargetMode = "favorite";
      updateTargetUI();
    };
  }

  const latest = getById("btn-target-latest");
  if (latest) {
    latest.onclick = () => {
      state.activeTargetMode = "latest";
      updateTargetUI();
    };
  }

  const targetSelect = getById("select-target-playlist");
  if (targetSelect) {
    targetSelect.onchange = (e) => {
      const target = e.target;
      if (!target) return;
      if (target.value === "__create_new__") {
        state.activeTargetMode = "create";
      } else {
        state.activeTargetMode = "custom";
        state.selectedPlaylistId = target.value;
      }
      updateTargetUI();
    };
  }

  const execute = getById("btn-execute-add");
  if (execute) {
    execute.onclick = async () => {
      const scope = getById("select-tab-scope").value;
      await executeQuickAddByScope(scope);
    };
  }
}

// ---------------------------------------------------------------------------
// init — data hydration only. Handlers are already live.
// ---------------------------------------------------------------------------

async function init() {
  await log("INFO", "Popup: Initializing...");

  await loadEditorModules();

  state.videoService = window.videoService || fallbackVideoService();
  state.parseYoutubeId = state.videoService.parseYoutubeId;

  // Theme / default-target correction (mode.js already painted the best guess).
  try {
    const settings = typeof window.getSettings === "function" ? await window.getSettings() : null;
    if (settings) {
      let theme = settings.themeChoice;
      if (theme === "device") {
        theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      if (theme === "dark" || theme === "light") {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
      }
      if (settings.defaultQuickAddTarget) {
        state.activeTargetMode = settings.defaultQuickAddTarget;
      }
    }
  } catch (e) {
    await log("WARN", "Popup: Could not load settings", getErrorMessage(e));
  }

  updateTargetUI();
  await loadDefaultTabScope();
  await initTargetData();

  await log("INFO", "Popup: Initialization complete");
}

wireUI();
init();
