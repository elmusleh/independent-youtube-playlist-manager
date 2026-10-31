import { mutateLibrary } from "./library-mutations.js";
import { permittedUI } from "./message-access.js";
import { parseYouTubeVideoId } from "../shared/tab-selection.js";
/* eslint-disable no-console */
import { isAndroid, playlistBuilderId, updateBadge } from "./utils.js";
import { buildContextMenus } from "./context-menus.js";
import {
  saveHistory,
  getHistory,
  deleteHistoryItem,
  handleCleanupWatchedVideo,
  pruneHistory,
  pruneStaleMetadataCache,
} from "./history.js";
import "./sync.js"; // registers alarms.onAlarm listener as side effect

// ---------------------------------------------------------------------------
// init — run on install and every service worker restart
// ---------------------------------------------------------------------------

let _initRunning = false;

async function init() {
  const start = Date.now();
  try {
    if (_initRunning) return;
    _initRunning = true;
    try {
      if (window.logSystemEvent) await window.logSystemEvent("INFO", "Background: Initializing...");
      if (!isAndroid()) {
        const settings = await window.getSettings();
        await buildContextMenus(settings);
      }
    } finally {
      _initRunning = false;
    }
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `init took ${duration}ms`);
    }
  }
}

browser.runtime.onInstalled.addListener(init);
init();

// ---------------------------------------------------------------------------
// Context menu cleanup wrappers
// ---------------------------------------------------------------------------

async function clearAddVideoToPlaylistItems() {
  await init();
}

async function clearContextMenus() {
  // Reconciliation updates existing entries without a remove/recreate gap.
}

// ---------------------------------------------------------------------------
// Keyboard shortcut command
// ---------------------------------------------------------------------------

if (browser.commands?.onCommand) {
  browser.commands.onCommand.addListener(async (command) => {
    if (command === "quick_add_active_video") {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].url) {
          const videoId = tabs[0].incognito ? null : parseYouTubeVideoId(tabs[0].url);
          if (videoId) {
            await mutateLibrary({ type: "builder-append", ids: [videoId] });
            const { alert } = await import("./utils.js");
            await alert(`Added video (${videoId}) to Playlist Builder!`, true);
          }
        }
      } catch (err) {
        console.warn("[Background] Command execution failed:", err);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Runtime message router
// ---------------------------------------------------------------------------

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (["create-playlist", "update-settings"].includes(request?.cmd) && !permittedUI(sender)) {
    sendResponse({ error: "This page cannot change playlist settings or create playlists." });
    return false;
  }
  if (window.logSystemEvent)
    window.logSystemEvent("INFO", `Background: Received message: ${request.cmd}`);

  if (request.cmd === "get-playlist-builder") {
    (async () => {
      const items = await browser.storage.local.get(playlistBuilderId);
      sendResponse(items[playlistBuilderId] || []);
    })();
    return true;
  } else if (["clear-playlist-builder", "update-playlist-builder"].includes(request.cmd)) {
    if (!permittedUI(sender)) {
      sendResponse({ error: "Untrusted playlist page." });
      return false;
    }
    // Consume only the IDs the editor saved. Concurrent additions remain in the builder.
    const operation =
      request.cmd === "clear-playlist-builder"
        ? { type: "builder-consume", ids: request.savedIds || [] }
        : {
            type: "builder-replace",
            ids: request.playlistBuilder,
            expectedRevision: request.expectedRevision,
          };
    mutateLibrary(operation).then(
      () => sendResponse(true),
      (error) => sendResponse({ error: error.message })
    );
    return true;
  } else if (request.cmd === "focus-playlist-builder") {
    (async () => {
      const tabs = await browser.tabs.query({
        url: browser.runtime.getURL(`/editor/index.html`),
      });
      const builderTabs = tabs.filter(
        (tab) => tab.url && new URL(tab.url).hash === "#/playlist-builder"
      );
      if (builderTabs.length > 0) {
        const windowId = builderTabs[0].windowId;
        const tabId = builderTabs[0].id;
        if (windowId && !isAndroid() && browser.windows?.update) {
          await browser.windows.update(windowId, { focused: true });
        }
        if (tabId) browser.tabs.update(tabId, { active: true });
      }
      sendResponse(true);
    })();
    return true;
  } else if (request.cmd === "update-saved-playlists") {
    clearAddVideoToPlaylistItems().then(() => sendResponse(true));
    return true;
  } else if (request.cmd === "create-playlist") {
    createPlaylist(request.videoIds, request.title)
      .then(() => {
        if (window.logSystemEvent)
          window.logSystemEvent("INFO", "Background: Playlist created successfully");
        sendResponse(true);
      })
      .catch((e) => {
        if (window.logSystemEvent)
          window.logSystemEvent("ERROR", "Background: Failed to create playlist", {
            error: e.message,
          });
        sendResponse({ error: e.message });
      });
    return true;
  } else if (request.cmd === "update-settings") {
    clearContextMenus()
      .then(() => init())
      .then(() => sendResponse(true))
      .catch((e) => {
        console.error("update-settings failed:", e);
        sendResponse(false);
      });
    return true;
  } else if (request.cmd === "save-yph-history") {
    saveHistory(
      request.videoId,
      request.t,
      request.dur,
      request.title,
      request.channel,
      request.isCompleted
    ).then(sendResponse);
    return true;
  } else if (request.cmd === "get-yph-history") {
    getHistory(request.videoId).then(sendResponse);
    return true;
  } else if (request.cmd === "cleanup-watched-video") {
    handleCleanupWatchedVideo(request.videoId, request.playlistId)
      .then(sendResponse)
      .catch((e) => {
        console.error(e);
        sendResponse(false);
      });
    return true;
  } else if (request.cmd === "clear-yph-history") {
    browser.storage.local
      .remove("local_yt_history")
      .then(() => sendResponse(true))
      .catch((e) => {
        console.error(e);
        sendResponse(false);
      });
    return true;
  } else if (request.cmd === "delete-yph-history-item") {
    deleteHistoryItem(request.videoId)
      .then(sendResponse)
      .catch((e) => {
        console.error(e);
        sendResponse(false);
      });
    return true;
  } else if (request.cmd === "supabase-trigger-sync") {
    if (window.syncEngine) {
      window.syncEngine
        .triggerSync()
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
    } else {
      sendResponse({ success: false, error: "Sync engine not mounted" });
    }
    return true;
  } else if (request.cmd === "supabase-get-session") {
    if (window.supabaseGetSession) {
      window
        .supabaseGetSession()
        .then(sendResponse)
        .catch(() => sendResponse(null));
    } else {
      sendResponse(null);
    }
    return true;
  } else if (request.cmd === "log-event") {
    if (window.logSystemEvent) {
      window.logSystemEvent(request.level, request.message, request.details);
    }
    sendResponse(true);
    return true;
  }
});

// ---------------------------------------------------------------------------
// createPlaylist
// ---------------------------------------------------------------------------

/**
 * @param {string[]} videoIds
 * @param {string} [title]
 */
async function createPlaylist(videoIds, title) {
  const start = Date.now();
  try {
    if (videoIds.length === 0) {
      if (window.logSystemEvent)
        await window.logSystemEvent("WARN", "Background: createPlaylist called with 0 videos");
      return;
    }

    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        `Background: Creating playlist with ${videoIds.length} videos`
      );

    const playlist = await window.videoService.generatePlaylist(videoIds, title);
    const settings = await window.getSettings();
    const signedIn = await window.isSignedIn();

    const shouldSync = settings.saveCreatedPlaylists && signedIn;
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", `Background: Saving playlist (Sync: ${shouldSync})`);
    const playlistId = await window.savePlaylist(playlist, {
      syncToYoutube: shouldSync,
    });

    if (settings.openPlaylistEditorAfterCreation) {
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `Background: Opening editor for playlist: ${playlistId}`
        );
      const isLocal = playlistId.startsWith("local-");
      const url = isLocal
        ? `/editor/index.html#/playlist?id=${encodeURIComponent(playlistId)}`
        : `/editor/index.html#/playlist?id=${encodeURIComponent(playlistId)}`;

      await browser.tabs.create({
        url: browser.runtime.getURL(url),
      });
    } else {
      if (window.logSystemEvent)
        await window.logSystemEvent("INFO", "Background: Playing playlist immediately (no editor)");
      await window.videoService.openPlaylist(videoIds, playlistId);
    }
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `createPlaylist took ${duration}ms`);
    }
  }
}

// ---------------------------------------------------------------------------
// Initial badge + housekeeping
// ---------------------------------------------------------------------------

browser.storage.local.get(playlistBuilderId).then((items) => {
  const builder = items[playlistBuilderId];
  if (builder && builder.length > 0) {
    updateBadge("" + builder.length);
  }
});

setTimeout(() => {
  pruneHistory();
  pruneStaleMetadataCache();
}, 5000);
