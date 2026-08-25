/* eslint-disable no-console */
(function () {
  const logPrefix = "[Watch Tracker]";

  let currentVideoId = null;
  let currentPlaylistId = null;
  let trackedVideoEl = null;
  let rules = {};

  let boundHandlers = {};
  let lastSaveTimestamp = 0;
  let lastSavedTimeValue = -1;
  let isCompleting = false;
  let lastTimeUpdateTick = 0;
  let debounceTimer = null;
  let isSaving = false;

  async function log(level, message, /** @type {any} */ details = null) {
    try {
      await browser.runtime.sendMessage({
        cmd: "log-event",
        level,
        message: `${logPrefix} ${message}`,
        details,
      });
    } catch {
      /* background inactive */
    }
  }

  async function getSettings() {
    const data = await browser.storage.sync.get([
      "ruleEnabled",
      "ruleTrackPause",
      "ruleTrackUnload",
      "ruleAutoDelete",
      "ruleCompletionThreshold",
      "ruleHistoryThrottleMs",
      "ruleHistoryDebounceMs",
      "ruleTrackDuringPlayback",
    ]);
    rules = {
      ruleEnabled: data.ruleEnabled !== false,
      ruleTrackPause: data.ruleTrackPause !== false,
      ruleTrackUnload: data.ruleTrackUnload !== false,
      ruleAutoDelete: !!data.ruleAutoDelete,
      ruleCompletionThreshold: data.ruleCompletionThreshold || 99,
      ruleHistoryThrottleMs: data.ruleHistoryThrottleMs || 5000,
      ruleHistoryDebounceMs: data.ruleHistoryDebounceMs || 1000,
      ruleTrackDuringPlayback: !!data.ruleTrackDuringPlayback,
    };
  }

  async function init() {
    window.addEventListener("yt-navigate-finish", onNavigateFinish);
    await onNavigateFinish();
  }

  async function teardown() {
    if (trackedVideoEl) {
      for (const ev of ["pause", "ended", "timeupdate", "play"]) {
        if (boundHandlers[ev]) trackedVideoEl.removeEventListener(ev, boundHandlers[ev]);
      }
    }
    if (boundHandlers.visibilitychange)
      document.removeEventListener("visibilitychange", boundHandlers.visibilitychange);
    if (boundHandlers.pagehide) window.removeEventListener("pagehide", boundHandlers.pagehide);
    if (boundHandlers.ytnavstart)
      window.removeEventListener("yt-navigate-start", boundHandlers.ytnavstart);

    boundHandlers = {};
    trackedVideoEl = null;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    document.getElementById("yph-native-panel")?.remove();
  }

  async function onNavigateFinish() {
    await teardown();
    isCompleting = false;
    lastTimeUpdateTick = 0;
    lastSaveTimestamp = 0;
    lastSavedTimeValue = -1;
    isSaving = false;

    const urlParams = new URLSearchParams(window.location.search);
    currentVideoId = urlParams.get("v");

    // Support URL param, Hash param, or Session Storage fallback (survives YouTube SPA navigation)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const urlPlaylistId = urlParams.get("yph_local_list") || hashParams.get("yph_local_list");
    const hasListContext = urlParams.get("list") !== null;

    if (urlPlaylistId) {
      currentPlaylistId = urlPlaylistId;
      sessionStorage.setItem("yph_local_list", urlPlaylistId);
    } else if (hasListContext) {
      currentPlaylistId = sessionStorage.getItem("yph_local_list");
    } else {
      currentPlaylistId = null;
      sessionStorage.removeItem("yph_local_list");
    }

    if (!currentVideoId) return;

    await getSettings();

    if (!rules.ruleEnabled) return;

    await log("INFO", `Initializing for video ${currentVideoId}`, {
      playlistId: currentPlaylistId,
    });

    if (currentPlaylistId) {
      // Validate the playlist still exists in storage
      try {
        const LOCAL_PLAYLISTS_KEY = "yph_local_playlists";
        const result = await browser.storage.local.get(LOCAL_PLAYLISTS_KEY);
        const playlists = result[LOCAL_PLAYLISTS_KEY] || [];
        if (!playlists.find((p) => p.id === currentPlaylistId)) {
          await log("WARN", `Playlist ${currentPlaylistId} not found in storage`);
          currentPlaylistId = null;
        }
      } catch (e) {
        await log("ERROR", "Failed to load local playlists for cleanup context", e);
        currentPlaylistId = null;
      }
    }

    const videoEl = await waitForVideoElement();
    if (!videoEl) {
      await log("WARN", "No video element found after polling.");
      return;
    }

    trackedVideoEl = videoEl;

    if (!urlParams.get("t")) {
      try {
        const history = await browser.runtime.sendMessage({
          cmd: "get-yph-history",
          videoId: currentVideoId,
        });
        if (history?.t && !history.isCompleted) {
          const doResume = () => {
            log("INFO", `Auto-resuming video to ${history.t}s`);
            trackedVideoEl.currentTime = history.t;
          };
          if (trackedVideoEl.readyState >= 1) doResume();
          else trackedVideoEl.addEventListener("loadedmetadata", doResume, { once: true });
        }
      } catch {
        /* ignore */
      }
    }

    startProgressTracking();
  }

  function waitForVideoElement(maxRetries = 20, intervalMs = 200) {
    return new Promise((resolve) => {
      let retries = 0;
      const check = () => {
        const video = document.querySelector("#movie_player video");
        if (video) {
          resolve(video);
        } else if (retries >= maxRetries) {
          resolve(null);
        } else {
          retries++;
          setTimeout(check, intervalMs);
        }
      };
      check();
    });
  }

  function startProgressTracking() {
    boundHandlers.pause = () => onSaveTrigger("pause");
    boundHandlers.play = () => onPlayTrigger();
    boundHandlers.visibilitychange = () => {
      if (document.visibilityState === "hidden") onSaveTrigger("unload");
    };
    boundHandlers.pagehide = () => onSaveTrigger("unload");
    boundHandlers.ytnavstart = () => onSaveTrigger("unload");
    boundHandlers.ended = () => onSaveTrigger("ended");
    boundHandlers.timeupdate = onTimeUpdate;

    trackedVideoEl.addEventListener("pause", boundHandlers.pause);
    trackedVideoEl.addEventListener("play", boundHandlers.play);
    trackedVideoEl.addEventListener("ended", boundHandlers.ended);
    trackedVideoEl.addEventListener("timeupdate", boundHandlers.timeupdate);
    document.addEventListener("visibilitychange", boundHandlers.visibilitychange);
    window.addEventListener("pagehide", boundHandlers.pagehide);
    window.addEventListener("yt-navigate-start", boundHandlers.ytnavstart);
  }

  function isAdShowing() {
    return document.querySelector(".ad-showing") !== null;
  }

  function onPlayTrigger() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  async function onSaveTrigger(triggerType) {
    if (!rules.ruleEnabled) return;
    if (triggerType === "pause" && !rules.ruleTrackPause) return;
    if (triggerType === "unload" && !rules.ruleTrackUnload) return;

    // Completion events save immediately without debounce
    if (triggerType === "ended") {
      await performSave(triggerType);
      return;
    }

    // Debounce pause/unload events
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      performSave(triggerType);
    }, rules.ruleHistoryDebounceMs);
  }

  async function performSave(triggerType) {
    if (isSaving) return;
    isSaving = true;

    try {
      const now = Date.now();
      // Throttle: ensure minimum time between saves
      if (now - lastSaveTimestamp < rules.ruleHistoryThrottleMs) {
        return;
      }

      if (!trackedVideoEl || isAdShowing()) return;

      const dur = trackedVideoEl.duration;
      const t = trackedVideoEl.currentTime;

      // Don't save if it's invalid, zero, or if we haven't advanced since the last save (unless it's a completion event)
      if (!dur || isNaN(dur) || t === 0 || (t === lastSavedTimeValue && triggerType !== "ended"))
        return;

      // A video is completed if the 'ended' event fired OR it passed the threshold
      const pct = (t / dur) * 100;
      const isCompleted = triggerType === "ended" || pct >= rules.ruleCompletionThreshold;

      lastSaveTimestamp = now;
      lastSavedTimeValue = t;

      // Get video title and channel from page
      let videoTitle = "";
      let channelName = "";
      try {
        const titleEl =
          document.querySelector("h1.ytd-watch-metadata") ||
          document.querySelector(".title.ytd-video-primary-info-renderer");
        videoTitle = titleEl?.textContent?.trim() || "";
        const channelEl =
          document.querySelector("#text.ytd-channel-name") ||
          document.querySelector("ytd-video-owner-renderer #channel-name #text");
        channelName = channelEl?.textContent?.trim() || "";
      } catch {
        /* ignore */
      }

      try {
        await browser.runtime.sendMessage({
          cmd: "save-yph-history",
          videoId: currentVideoId,
          t,
          dur,
          title: videoTitle,
          channel: channelName,
          isCompleted,
        });
      } catch (e) {
        console.error(`${logPrefix} Failed to save history`, e);
      }
    } finally {
      isSaving = false;
    }
  }

  async function onTimeUpdate() {
    const now = Date.now();
    // Throttle checks to once every 1000ms to save CPU
    if (now - lastTimeUpdateTick < 1000) return;
    lastTimeUpdateTick = now;

    if (!trackedVideoEl || isAdShowing() || isCompleting) return;

    const dur = trackedVideoEl.duration;
    const t = trackedVideoEl.currentTime;

    if (!dur || isNaN(dur)) return;

    // Optional: Track position during playback if enabled
    if (rules.ruleTrackDuringPlayback) {
      if (now - lastSaveTimestamp >= rules.ruleHistoryThrottleMs) {
        await performSave("timeupdate");
      }
    }

    // Check for completion threshold
    const pct = (t / dur) * 100;
    if (pct >= rules.ruleCompletionThreshold) {
      isCompleting = true;
      await handleCompletion();
    }
  }

  async function handleCompletion() {
    await log(
      "INFO",
      `Completion threshold reached (${rules.ruleCompletionThreshold}%) for video ${currentVideoId}`
    );

    // Always save history one last time so we know it's done
    await onSaveTrigger("ended");

    if (rules.ruleAutoDelete && currentPlaylistId) {
      await log("INFO", `Triggering auto-delete from playlist ${currentPlaylistId}`);
      try {
        await browser.runtime.sendMessage({
          cmd: "cleanup-watched-video",
          videoId: currentVideoId,
          playlistId: currentPlaylistId,
        });
      } catch (e) {
        await log("ERROR", "Cleanup message failed", e);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
