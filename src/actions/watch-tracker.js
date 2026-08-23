(function () {
  const logPrefix = "[Watch Tracker]";

  let currentVideoId = null;
  let currentPlaylistId = null;
  let currentPlaylist = null;
  let trackedVideoEl = null;
  let rules = {};

  // Store references to bound handlers to remove them properly
  let boundHandlers = {};

  // Tracking state — declared here so all functions can reference them without TDZ issues
  let lastSaveTimestamp = 0;
  let lastSavedTimeValue = -1;
  let isCompleting = false;
  let lastTimeUpdateTick = 0;
  let debounceTimer = null;
  let isSaving = false;

  async function log(level, message, /** @type {any} */ details = null) {
    console.log("%s [%s] %s", logPrefix, level, message, details || "");
    try {
      await browser.runtime.sendMessage({
        cmd: "log-event",
        level,
        message: `${logPrefix} ${message}`,
        details,
      });
    } catch (e) {}
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
      ruleEnabled: data.ruleEnabled !== false, // default true
      ruleTrackPause: data.ruleTrackPause !== false, // default true
      ruleTrackUnload: data.ruleTrackUnload !== false, // default true
      ruleAutoDelete: !!data.ruleAutoDelete,
      ruleCompletionThreshold: data.ruleCompletionThreshold || 99,
      ruleHistoryThrottleMs: data.ruleHistoryThrottleMs || 5000,
      ruleHistoryDebounceMs: data.ruleHistoryDebounceMs || 1000,
      ruleTrackDuringPlayback: !!data.ruleTrackDuringPlayback,
    };
  }

  async function init() {
    window.addEventListener("yt-navigate-finish", onNavigateFinish);
    // Also run immediately on first load
    await onNavigateFinish();
  }

  async function teardown() {
    if (trackedVideoEl) {
      if (boundHandlers.pause)
        trackedVideoEl.removeEventListener("pause", boundHandlers.pause);
      if (boundHandlers.ended)
        trackedVideoEl.removeEventListener("ended", boundHandlers.ended);
      if (boundHandlers.timeupdate)
        trackedVideoEl.removeEventListener(
          "timeupdate",
          boundHandlers.timeupdate,
        );
      if (boundHandlers.play)
        trackedVideoEl.removeEventListener("play", boundHandlers.play);
    }
    if (boundHandlers.visibilitychange)
      document.removeEventListener(
        "visibilitychange",
        boundHandlers.visibilitychange,
      );
    if (boundHandlers.pagehide)
      window.removeEventListener("pagehide", boundHandlers.pagehide);
    if (boundHandlers.ytnavstart)
      window.removeEventListener("yt-navigate-start", boundHandlers.ytnavstart);

    boundHandlers = {};
    trackedVideoEl = null;

    // Clear any pending debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const existingPanel = document.getElementById("yph-native-panel");
    if (existingPanel) {
      existingPanel.remove();
    }
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

    // Support URL param, Hash param, or Session Storage fallback (to survive native YouTube SPA navigation)
    let hashParams = new URLSearchParams(window.location.hash.substring(1));
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

    if (!rules.ruleEnabled) {
      return; // Feature is disabled
    }

    await log("INFO", `Initializing for video ${currentVideoId}`, {
      playlistId: currentPlaylistId,
    });

    if (currentPlaylistId) {
      await loadCurrentPlaylistFromStorage();
    }

    const videoEl = await waitForVideoElement();
    if (!videoEl) {
      await log("WARN", "No video element found after polling.");
      return;
    }

    trackedVideoEl = videoEl;

    // --- Auto-Resume Logic ---
    if (!urlParams.get("t")) {
      try {
        const history = await browser.runtime.sendMessage({
          cmd: "get-yph-history",
          videoId: currentVideoId,
        });
        if (history && history.t && !history.isCompleted) {
          const resume = () => {
            log("INFO", `Auto-resuming video to ${history.t}s`);
            trackedVideoEl.currentTime = history.t;
          };

          if (trackedVideoEl.readyState >= 1) {
            resume();
          } else {
            trackedVideoEl.addEventListener("loadedmetadata", resume, {
              once: true,
            });
          }
        }
      } catch (e) {}
    }

    startProgressTracking();
  }

  async function loadCurrentPlaylistFromStorage() {
    if (!currentPlaylistId) return;
    const LOCAL_PLAYLISTS_KEY = "yph_local_playlists";
    try {
      const result = await browser.storage.local.get(LOCAL_PLAYLISTS_KEY);
      const playlists = result[LOCAL_PLAYLISTS_KEY] || [];
      currentPlaylist =
        playlists.find((p) => p.id === currentPlaylistId) || null;
    } catch (e) {
      await log(
        "ERROR",
        "Failed to load local playlists for cleanup context",
        e,
      );
      currentPlaylist = null;
    }
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

  // --- Tracking Logic ---

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
    document.addEventListener(
      "visibilitychange",
      boundHandlers.visibilitychange,
    );
    window.addEventListener("pagehide", boundHandlers.pagehide);
    window.addEventListener("yt-navigate-start", boundHandlers.ytnavstart);
    trackedVideoEl.addEventListener("ended", boundHandlers.ended);
    trackedVideoEl.addEventListener("timeupdate", boundHandlers.timeupdate);
  }

  function isAdShowing() {
    return document.querySelector(".ad-showing") !== null;
  }

  function onPlayTrigger() {
    // Cancel pending debounce save when user resumes playback
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
      if (
        !dur ||
        isNaN(dur) ||
        t === 0 ||
        (t === lastSavedTimeValue && triggerType !== "ended")
      )
        return;

      // A video is completed if the 'ended' event fired OR it passed the threshold
      const pct = (t / dur) * 100;
      const isCompleted =
        triggerType === "ended" || pct >= rules.ruleCompletionThreshold;

      lastSaveTimestamp = now;
      lastSavedTimeValue = t;

      // Get video title and channel from page
      let videoTitle = "";
      let channelName = "";
      try {
        const titleEl =
          document.querySelector("h1.ytd-watch-metadata") ||
          document.querySelector(".title.ytd-video-primary-info-renderer");
        videoTitle = titleEl
          ? /** @type {HTMLElement} */ (titleEl).innerText.trim()
          : "";

        const channelEl =
          document.querySelector("#text.ytd-channel-name") ||
          document.querySelector(
            "ytd-video-owner-renderer #channel-name #text",
          );
        channelName = channelEl
          ? /** @type {HTMLElement} */ (channelEl).innerText.trim()
          : "";
      } catch (e) {}

      try {
        await browser.runtime.sendMessage({
          cmd: "save-yph-history",
          videoId: currentVideoId,
          t: t,
          dur: dur,
          title: videoTitle,
          channel: channelName,
          isCompleted: isCompleted,
        });
        // We don't log every save to system logs to avoid spamming, but completion triggers a log below
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
      `Completion threshold reached (${rules.ruleCompletionThreshold}%) for video ${currentVideoId}`,
    );

    // Always save history one last time so we know it's done
    await onSaveTrigger("ended");

    if (rules.ruleAutoDelete && currentPlaylistId) {
      await log(
        "INFO",
        `Triggering auto-delete from playlist ${currentPlaylistId}`,
      );
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

  // --- Start ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
