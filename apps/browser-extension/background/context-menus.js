/* eslint-disable no-console */
import {
  isAndroid,
  playlistBuilderId,
  playlistBuilderPageId,
  addVideoToPlaylistId,
  addVideoToPlaylistPageId,
  idSep,
  addVideoToPlaylistItemPrefix,
  addVideoToPlaylistPageItemPrefix,
  handleError,
  updateBadge,
} from "./utils.js";

// ---------------------------------------------------------------------------
// Context menu building
// ---------------------------------------------------------------------------

/**
 * @param {import("../../playlist-manager/src/types/model").Settings} settings
 */
export async function buildContextMenus(settings) {
  const start = Date.now();
  try {
    if (isAndroid()) return;
    if (!settings.disableContextBuilder) {
      browser.contextMenus.create({
        id: playlistBuilderId,
        title: "Add video to the playlist builder",
        contexts: ["link", "video"],
      });
      browser.contextMenus.create({
        id: playlistBuilderPageId,
        title: "Add video to the playlist builder",
        contexts: ["page"],
        documentUrlPatterns: ["https://www.youtube.com/watch*"],
      });
    }

    if (!settings.disableContextSaved) {
      browser.contextMenus.create({
        id: addVideoToPlaylistId,
        title: "Add video to saved playlist",
        contexts: ["link", "video"],
      });
      browser.contextMenus.create({
        id: addVideoToPlaylistPageId,
        title: "Add video to saved playlist",
        contexts: ["page"],
        documentUrlPatterns: ["https://www.youtube.com/watch*"],
      });
      await buildAddVideoToPlaylistItems();
    }
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `buildContextMenus took ${duration}ms`);
    }
  }
}

async function buildAddVideoToPlaylistItems() {
  const start = Date.now();
  try {
    if (isAndroid()) return;
    const playlists = await window.getPlaylists();
    for (const playlist of playlists) {
      const contextId = `${addVideoToPlaylistItemPrefix}${playlist.id}`;
      const pageContextId = `${addVideoToPlaylistPageItemPrefix}${playlist.id}`;
      browser.contextMenus.create({
        id: contextId,
        title: playlist.title,
        parentId: addVideoToPlaylistId,
      });
      browser.contextMenus.create({
        id: pageContextId,
        title: playlist.title,
        parentId: addVideoToPlaylistPageId,
      });
    }
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `buildAddVideoToPlaylistItems took ${duration}ms`);
    }
  }
}

// ---------------------------------------------------------------------------
// Context menu click handler (top-level registration)
// ---------------------------------------------------------------------------

if (!isAndroid())
  browser.contextMenus.onClicked.addListener(async (info, _tab) => {
    const clickedMenuId = info.menuItemId.toString();
    try {
      if (clickedMenuId === playlistBuilderId || clickedMenuId === playlistBuilderPageId) {
        addVideoToPlaylistBuilder(info);
      } else if (
        clickedMenuId.startsWith(addVideoToPlaylistItemPrefix) ||
        clickedMenuId.startsWith(addVideoToPlaylistPageItemPrefix)
      ) {
        addVideoToPlaylist(info, clickedMenuId);
      }
    } catch (error_inner) {
      handleError(error_inner);
    }
  });

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

/**
 * @param {browser.contextMenus.OnClickData} info
 */
function parseVideoId(info) {
  const link = info.linkUrl || info.pageUrl;
  const videoId = link && window.videoService.parseYoutubeId(link);
  if (!videoId) {
    throw new Error("Invalid YouTube video link: " + link);
  }
  return videoId;
}

async function fetchBuilder() {
  try {
    const items = await browser.storage.local.get(playlistBuilderId);
    if (items && items[playlistBuilderId] != null) {
      return items[playlistBuilderId] || [];
    }
  } catch (err) {
    console.error("Failed to fetch builder from storage:", err);
  }
  return [];
}

async function saveBuilder(playlistBuilder) {
  const items = {};
  items[playlistBuilderId] = playlistBuilder;
  try {
    await browser.storage.local.set(items);
  } catch (err) {
    console.error("Failed to save builder to storage:", err);
    if (err.name === "QuotaExceededError") {
      console.error("Storage quota exceeded!");
    }
  }
}

async function getPlaylistBuilderTab() {
  const tabs = await browser.tabs.query({
    url: browser.runtime.getURL(`/editor/index.html`),
  });
  return tabs.filter((tab) => tab.url && new URL(tab.url).hash === "#/playlist-builder");
}

async function openPlaylistBuilderTab() {
  const builderTabs = await getPlaylistBuilderTab();
  if (builderTabs.length === 0) {
    await browser.tabs.create({
      url: browser.runtime.getURL(`/editor/index.html#/playlist-builder`),
    });
    return [];
  }
  return builderTabs;
}

/**
 * @param {browser.contextMenus.OnClickData} info
 */
async function addVideoToPlaylistBuilder(info) {
  const start = Date.now();
  try {
    const videoId = parseVideoId(info);
    const playlistBuilder = await fetchBuilder();
    playlistBuilder.push(videoId);
    updateBadge("" + playlistBuilder.length);
    await saveBuilder(playlistBuilder);
    const settings = await window.getSettings();
    /** @type {browser.tabs.Tab[]} */
    let builderTabs = [];
    if (settings.openPlaylistBuilderAfterAdd) {
      builderTabs = await openPlaylistBuilderTab();
    } else {
      builderTabs = await getPlaylistBuilderTab();
    }
    builderTabs.forEach((tab) => browser.tabs.reload(tab.id));
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `addVideoToPlaylistBuilder took ${duration}ms`);
    }
  }
}

/**
 * @param {browser.contextMenus.OnClickData} info
 * @param {string} clickedMenuId
 */
async function addVideoToPlaylist(info, clickedMenuId) {
  const start = Date.now();
  try {
    const videoId = parseVideoId(info);
    const playlistId = clickedMenuId.split(idSep)[1];
    const playlist = await window.getPlaylist(playlistId);
    if (!playlist.videos.includes(videoId)) {
      playlist.videos.push(videoId);
    }

    const signedIn = await window.isSignedIn();
    const isLocal = playlistId.startsWith("local-");
    await window.savePlaylist(playlist, { syncToYoutube: signedIn && !isLocal });

    const settings = await window.getSettings();
    if (settings.openSavedPlaylistAfterAdd) {
      const localParam = isLocal ? "local=true" : "saved=true";
      await browser.tabs.create({
        url: browser.runtime.getURL(`/editor/index.html?id=${playlistId}&${localParam}#/editor`),
      });
    }
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `addVideoToPlaylist took ${duration}ms`);
    }
  }
}
