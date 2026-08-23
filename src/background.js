// Detect Firefox for Android (Fenix) — contextMenus and identity APIs are unavailable there
const isAndroid = () => /Android/i.test(navigator.userAgent);

const playlistBuilderId = "yphPlaylistBuilder";
const playlistBuilderPageId = "yphPlaylistBuilderPage";
const addVideoToPlaylistId = "yphAddVideoToPlaylist";
const addVideoToPlaylistPageId = "yphAddVideoToPlaylistPage";
const idSep = "#";
const addVideoToPlaylistItemPrefix = `${addVideoToPlaylistId}${idSep}`;
const addVideoToPlaylistPageItemPrefix = `${addVideoToPlaylistPageId}${idSep}`;

// In MV3, global variables are reset when the service worker suspends.
// We should rely on browser.contextMenus.removeAll() or targeted removals.

// Mutex: set synchronously before the first await so concurrent calls bail out.
let _initRunning = false;

async function init() {
  if (_initRunning) return;
  _initRunning = true;
  try {
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", "Background: Initializing...");
    if (!isAndroid()) {
      await browser.contextMenus.removeAll();
      const settings = await window.getSettings();
      await buildContextMenus(settings);
    }
  } finally {
    _initRunning = false;
  }
}

browser.runtime.onInstalled.addListener(init);

// Also initialize on startup in case it's just a worker restart
init();

/**
 *
 * @param {import("./playlist-editor/src/types/model").Settings} settings
 */
async function buildContextMenus(settings) {
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
}

async function buildAddVideoToPlaylistItems() {
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
}

async function clearAddVideoToPlaylistItems() {
  await init();
}

async function clearContextMenus() {
  if (!isAndroid()) await browser.contextMenus.removeAll();
}

if (!isAndroid()) browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const clickedMenuId = info.menuItemId.toString();
  try {
    if (
      clickedMenuId == playlistBuilderId ||
      clickedMenuId == playlistBuilderPageId
    ) {
      addVideoToPlaylistBuilder(info);
    } else if (
      clickedMenuId.startsWith(addVideoToPlaylistItemPrefix) ||
      clickedMenuId.startsWith(addVideoToPlaylistPageItemPrefix)
    ) {
      addVideoToPlaylist(info, clickedMenuId);
    }
  } catch (error) {
    handleError(error);
  }
});

// Handle keyboard shortcut commands
if (browser.commands?.onCommand) {
  browser.commands.onCommand.addListener(async (command) => {
    if (command === "quick_add_active_video") {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].url) {
          const videoId = window.videoService ? window.videoService.parseYoutubeId(tabs[0].url) : null;
          if (videoId) {
            const playlistBuilder = await fetchBuilder();
            playlistBuilder.push(videoId);
            updateBadge("" + playlistBuilder.length);
            await saveBuilder(playlistBuilder);
            alert(`Added video (${videoId}) to Playlist Builder!`, true);
          }
        }
      } catch (err) {
        console.warn("[Background] Command execution failed:", err);
      }
    }
  });
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (window.logSystemEvent)
    window.logSystemEvent(
      "INFO",
      `Background: Received message: ${request.cmd}`,
    );

  if (request.cmd === "get-playlist-builder") {
    fetchBuilder().then(sendResponse);
    return true;
  } else if (request.cmd === "clear-playlist-builder") {
    saveBuilder([]).then(() => {
      updateBadge("");
      sendResponse(true);
    });
    return true;
  } else if (request.cmd === "update-playlist-builder") {
    const playlistBuilder = request.playlistBuilder;
    saveBuilder(playlistBuilder).then(() => {
      updateBadge("" + playlistBuilder.length);
      sendResponse(true);
    });
    return true;
  } else if (request.cmd === "focus-playlist-builder") {
    openPlaylistBuilderTab().then((builderTabs) => {
      if (builderTabs.length > 0) {
        const windowId = builderTabs[0].windowId;
        const tabId = builderTabs[0].id;
        if (windowId) browser.windows.update(windowId, { focused: true });
        if (tabId) browser.tabs.update(tabId, { active: true });
      }
      sendResponse(true);
    });
    return true;
  } else if (request.cmd === "update-saved-playlists") {
    clearAddVideoToPlaylistItems().then(() => sendResponse(true));
    return true;
  } else if (request.cmd === "create-playlist") {
    createPlaylist(request.videoIds, request.title)
      .then(() => {
        if (window.logSystemEvent)
          window.logSystemEvent(
            "INFO",
            "Background: Playlist created successfully",
          );
        sendResponse(true);
      })
      .catch((e) => {
        if (window.logSystemEvent)
          window.logSystemEvent(
            "ERROR",
            "Background: Failed to create playlist",
            { error: e.message },
          );
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
      request.isCompleted,
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
      .remove(HISTORY_KEY)
      .then(() => sendResponse(true))
      .catch((e) => {
        console.error(e);
        sendResponse(false);
      });
    return true;
  } else if (request.cmd === "supabase-trigger-sync") {
    if (window.syncEngine) {
      window.syncEngine.triggerSync().then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
    } else {
      sendResponse({ success: false, error: "Sync engine not mounted" });
    }
    return true;
  } else if (request.cmd === "supabase-get-session") {
    if (window.supabaseGetSession) {
      window.supabaseGetSession().then(sendResponse).catch(() => sendResponse(null));
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

/**
 * @param  {string[]} videoIds
 * @param  {string} [title]
 */
async function createPlaylist(videoIds, title) {
  if (videoIds.length == 0) {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "WARN",
        "Background: createPlaylist called with 0 videos",
      );
    return;
  }

  if (window.logSystemEvent)
    await window.logSystemEvent(
      "INFO",
      `Background: Creating playlist with ${videoIds.length} videos`,
    );

  const playlist = await window.videoService.generatePlaylist(videoIds, title);
  const settings = await window.getSettings();
  const signedIn = await window.isSignedIn();

  // Always save the playlist (at least locally)
  const shouldSync = settings.saveCreatedPlaylists && signedIn;
  if (window.logSystemEvent)
    await window.logSystemEvent(
      "INFO",
      `Background: Saving playlist (Sync: ${shouldSync})`,
    );
  const playlistId = await window.savePlaylist(playlist, {
    syncToYoutube: shouldSync,
  });

  if (settings.openPlaylistEditorAfterCreation) {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        `Background: Opening editor for playlist: ${playlistId}`,
      );
    const isLocal = playlistId.startsWith("local-");
    const url = isLocal
      ? `/editor/index.html?id=${playlistId}&local=true#/editor`
      : `/editor/index.html?id=${playlistId}#/editor`;

    await browser.tabs.create({
      url: browser.runtime.getURL(url),
    });
  } else {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        "Background: Playing playlist immediately (no editor)",
      );
    await window.videoService.openPlaylist(videoIds, playlistId);
  }
}

async function fetchBuilder() {
  try {
    const items = await browser.storage.local.get(playlistBuilderId);
    console.log("Raw data from storage (builder):", items[playlistBuilderId]);
    if (items && items[playlistBuilderId] != null) {
      return items[playlistBuilderId] || [];
    }
  } catch (err) {
    console.error("Failed to fetch builder from storage:", err);
  }
  return [];
}

async function saveBuilder(playlistBuilder) {
  console.log("Saving to storage (builder):", playlistBuilder);
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

fetchBuilder().then((playlistBuilder) => {
  if (playlistBuilder.length > 0) {
    updateBadge("" + playlistBuilder.length);
  }
});

/**
 * @param {browser.contextMenus.OnClickData} info
 */
async function addVideoToPlaylistBuilder(info) {
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
}

/**
 * @param {browser.contextMenus.OnClickData} info
 * @param {string} clickedMenuId
 */
async function addVideoToPlaylist(info, clickedMenuId) {
  const videoId = parseVideoId(info);
  const playlistId = clickedMenuId.split(idSep)[1];
  const playlist = await window.getPlaylist(playlistId);
  if (!playlist.videos.includes(videoId)) {
    playlist.videos.push(videoId);
  }

  const signedIn = await window.isSignedIn();
  // Don't sync if it's a local playlist
  const isLocal = playlistId.startsWith("local-");
  await window.savePlaylist(playlist, { syncToYoutube: signedIn && !isLocal });

  const settings = await window.getSettings();
  if (settings.openSavedPlaylistAfterAdd) {
    const localParam = isLocal ? "local=true" : "saved=true";
    await browser.tabs.create({
      url: browser.runtime.getURL(
        `/editor/index.html?id=${playlistId}&${localParam}#/editor`,
      ),
    });
  }
}

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

async function getPlaylistBuilderTab() {
  const tabs = await browser.tabs.query({
    url: browser.runtime.getURL(`/editor/index.html`),
  });
  return tabs.filter(
    (tab) => tab.url && new URL(tab.url).hash === "#/playlist-builder",
  );
}

async function openPlaylistBuilderTab() {
  const builderTabs = await getPlaylistBuilderTab();
  if (builderTabs.length == 0) {
    await browser.tabs.create({
      url: browser.runtime.getURL(`/editor/index.html#/playlist-builder`),
    });
    return [];
  }
  return builderTabs;
}

function handleError(error) {
  alert(error.message);
}

/**
 * @param {string} message
 * @param {boolean=} isInfo
 */
async function alert(message, isInfo) {
  browser.notifications.create({
    type: "basic",
    title: "Playlist Manager" + (isInfo ? "" : ": Error"),
    message: message,
    ...(isAndroid() ? {} : { iconUrl: "icons/icon_48.png" }),
  });
}

// --- History & Auto-Cleanup ---

const HISTORY_KEY = "local_yt_history";

async function saveHistory(videoId, t, dur, title, channel, isCompleted) {
  if (window.logSystemEvent)
    await window.logSystemEvent(
      "INFO",
      `Background: Saving history for ${videoId} at ${t}s (Completed: ${isCompleted})`,
    );
  const data = await browser.storage.local.get(HISTORY_KEY);
  const history = data[HISTORY_KEY] || {};

  const existing = history[videoId] || {};

  history[videoId] = {
    title: title || existing.title || "Unknown Title",
    channel: channel || existing.channel || "Unknown Channel",
    timestamp: t,
    duration: dur,
    isCompleted: !!isCompleted,
    lastWatchedAt: Date.now(),
  };
  await browser.storage.local.set({ [HISTORY_KEY]: history });
  return true;
}

async function getHistory(videoId) {
  const data = await browser.storage.local.get(HISTORY_KEY);
  const history = data[HISTORY_KEY] || {};
  const item = history[videoId] || null;
  if (item) {
    // Map back to 't' for internal consumption if needed, but we'll try to use standard names
    return {
      ...item,
      t: item.timestamp,
      dur: item.duration,
      ts: item.lastWatchedAt,
    };
  }
  return null;
}

async function handleCleanupWatchedVideo(videoId, playlistId) {
  const settings = await window.getSettings();
  if (!settings.ruleAutoDelete) {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        `Background: Skipping cleanup for ${videoId} (ruleAutoDelete is false)`,
      );
    return false;
  }

  if (window.logSystemEvent)
    await window.logSystemEvent(
      "INFO",
      `Background: Running cleanup for ${videoId} in playlist ${playlistId}`,
    );

  // Fetch the local playlists
  const LOCAL_PLAYLISTS_KEY = "yph_local_playlists";
  const result = await browser.storage.local.get(LOCAL_PLAYLISTS_KEY);
  const playlists = result[LOCAL_PLAYLISTS_KEY] || [];

  const index = playlists.findIndex((p) => p.id === playlistId);
  if (index >= 0) {
    const playlist = playlists[index];

    // SAFEGUARD: Skip auto-delete for permanent playlists
    if (playlist.isPermanent) {
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[CLEANUP] Skipping permanent playlist`,
          { videoId, playlistId },
        );
      return false;
    }

    const initialLength = playlist.videos.length;
    playlist.videos = playlist.videos.filter((id) => id !== videoId);

    if (playlist.videos.length < initialLength) {
      await browser.storage.local.set({ [LOCAL_PLAYLISTS_KEY]: playlists });
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[CLEANUP] Video removed from local playlist`,
          { videoId, playlistId },
        );

      // Clear cache to reflect changes in editor
      if (window.invalidatePlaylistCache) {
        window.invalidatePlaylistCache();
      }

      // Optionally notify editor pages to update
      try {
        browser.runtime
          .sendMessage({ cmd: "update-saved-playlists" })
          .catch(() => {});
      } catch (e) { /* ignore */ }

      return true;
    }
  } else {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "WARN",
        `Background: Playlist ${playlistId} not found during cleanup`,
      );
  }
  return false;
}

async function pruneHistory() {
  try {
    const settings = await window.getSettings();
    const retentionDays = settings.ruleHistoryRetentionDays || 30;
    const cutoffTs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const data = await browser.storage.local.get(HISTORY_KEY);
    const history = data[HISTORY_KEY];
    if (!history) return;

    let deletedCount = 0;
    for (const videoId in history) {
      if (history[videoId].lastWatchedAt < cutoffTs) {
        delete history[videoId];
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await browser.storage.local.set({ [HISTORY_KEY]: history });
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `Background: Pruned ${deletedCount} stale history records`,
        );
    }
  } catch (e) {
    console.error("Failed to prune history:", e);
  }
}

// Prune IndexedDB metadata cache entries older than 30 days
async function pruneStaleMetadataCache() {
  if (typeof indexedDB === "undefined") return;
  try {
    const dbRequest = indexedDB.open("keyval-store");
    dbRequest.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("keyval")) return;
      const tx = db.transaction("keyval", "readwrite");
      const store = tx.objectStore("keyval");
      const req = store.openCursor();
      const now = Date.now();
      const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const key = String(cursor.key);
          if (key.startsWith("yph:meta:")) {
            const val = cursor.value;
            if (val && val.lastCachedAt && (now - val.lastCachedAt > MAX_AGE_MS)) {
              cursor.delete();
            }
          }
          cursor.continue();
        }
      };
    };
  } catch (err) {
    console.warn("[Background] Stale cache pruning failed:", err);
  }
}

// Call housekeeping on startup
setTimeout(() => {
  pruneHistory();
  pruneStaleMetadataCache();
}, 5000);

// --- Auto-Retry Sync & Maintenance Alarm Handler ---
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "yph-cache-cleanup") {
    await pruneStaleMetadataCache();
  } else if (alarm.name === "supabase-cloud-sync") {
    if (window.syncEngine) {
      await window.syncEngine.triggerSync().catch((e) => console.warn("[Background] Supabase auto-sync error:", e));
    }
  } else if (alarm.name.startsWith("sync-retry-")) {
    const localPlaylistId = alarm.name.replace("sync-retry-", "");
    await handleSyncRetry(localPlaylistId);
  }
});

async function handleSyncRetry(localPlaylistId) {
  const alarmName = `sync-retry-${localPlaylistId}`;
  
  if (window.logSystemEvent) {
    await window.logSystemEvent(
      "INFO",
      `Background: Handling auto-retry for playlist ${localPlaylistId}`
    );
  }

  // Use message passing to editor page to perform sync
  // Find any open editor tab
  const editorTabs = await browser.tabs.query({
    url: browser.runtime.getURL("/editor/index.html*")
  });
  
  if (editorTabs.length === 0) {
    // No editor tab open - reschedule for later
    if (window.logSystemEvent) {
      await window.logSystemEvent(
        "WARN",
        `Background: No editor tab open for ${localPlaylistId}, rescheduling`
      );
    }
    await browser.alarms.create(alarmName, { delayInMinutes: 30 }); // Try again in 30 min
    return;
  }

  // Send resume-sync message to first available editor tab
  const targetTab = editorTabs[0];
  try {
    const response = await browser.tabs.sendMessage(targetTab.id, {
      cmd: "resume-sync",
      localPlaylistId: localPlaylistId,
      alarmName: alarmName
    });
    
    if (response && response.success) {
      if (window.logSystemEvent) {
        await window.logSystemEvent(
          "INFO",
          `Background: Resume sync initiated for ${localPlaylistId}`
        );
      }
      // Sync in progress - result will be handled by editor
    } else if (response && response.error) {
      // Handle error response
      const errorLower = response.error.toLowerCase();
      if (errorLower.includes("quota") || errorLower.includes("ratelimitexceeded")) {
        // Quota error - check retry count using direct storage access
        const SYNC_STATE_KEY = "yph_sync_state";
        const result = await browser.storage.local.get(SYNC_STATE_KEY);
        const allStates = result[SYNC_STATE_KEY] || {};
        const syncState = allStates[localPlaylistId];
        const retryCount = syncState?.retryCount || 0;
        
        if (retryCount >= 7) { // ~1 week max (7 retries * 24 hours)
          await browser.alarms.clear(alarmName);
          // Clear sync state
          if (allStates[localPlaylistId]) {
            delete allStates[localPlaylistId];
            await browser.storage.local.set({ [SYNC_STATE_KEY]: allStates });
          }
          await browser.notifications.create({
            type: "basic",
            title: "Playlist Manager",
            message: `Playlist sync failed after ${retryCount} attempts. Please try manually.`,
            ...(isAndroid() ? {} : { iconUrl: "icons/icon_48.png" }),
          }).catch((e) => console.warn("Notification failed:", e));
        } else {
          // Increment retry count and reschedule
          if (syncState) {
            syncState.retryCount = retryCount + 1;
            syncState.lastAttemptAt = Date.now();
            allStates[localPlaylistId] = syncState;
            await browser.storage.local.set({ [SYNC_STATE_KEY]: allStates });
          }
          await browser.alarms.create(alarmName, { delayInMinutes: 24 * 60 });
          await browser.notifications.create({
            type: "basic",
            title: "Playlist Manager",
            message: `Playlist sync paused due to API quota. Retry ${retryCount + 1}/7 - will try again in 24h.`,
            ...(isAndroid() ? {} : { iconUrl: "icons/icon_48.png" }),
          }).catch((e) => console.warn("Notification failed:", e));
        }
      } else if (response.error === "not_signed_in") {
        // Not signed in - reschedule for later
        await browser.alarms.create(alarmName, { delayInMinutes: 24 * 60 });
      } else if (response.error === "auto_retry_disabled") {
        // Auto-retry disabled - clear alarm to stop infinite loop
        await browser.alarms.clear(alarmName);
        await browser.notifications.create({
          type: "basic",
          title: "Playlist Manager",
          message: `Auto-retry is disabled. Click Sync to resume manually when ready.`,
          ...(isAndroid() ? {} : { iconUrl: "icons/icon_48.png" }),
        }).catch((e) => console.warn("Notification failed:", e));
      } else {
        // Other error - clear alarm
        await browser.alarms.clear(alarmName);
        await browser.notifications.create({
          type: "basic",
          title: "Playlist Manager: Error",
          message: `Failed to resume sync: ${response.error}`,
          ...(isAndroid() ? {} : { iconUrl: "icons/icon_48.png" }),
        }).catch((e) => console.warn("Notification failed:", e));
      }
    }
  } catch (e) {
    // Tab didn't respond - reschedule
    if (window.logSystemEvent) {
      await window.logSystemEvent(
        "WARN",
        `Background: Editor tab didn't respond for ${localPlaylistId}, rescheduling`,
        { error: e.message }
      );
    }
    await browser.alarms.create(alarmName, { delayInMinutes: 30 });
  }
}

function updateBadge(text) {
  const actionApi = browser.action || browser.browserAction;
  if (actionApi && typeof actionApi.setBadgeText === "function") {
    actionApi.setBadgeText({ text: text || "" });
    if (text && typeof actionApi.setBadgeBackgroundColor === "function") {
      actionApi.setBadgeBackgroundColor({ color: "#FF0000" });
    }
  }
}
