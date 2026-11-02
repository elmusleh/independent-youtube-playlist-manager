/* eslint-disable no-console */
(function () {
  const logPrefix = "[Watch Tracker]";

  let currentVideoId = null;
  let currentPlaylistId = null;
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
    for (const ev of ["pause", "ended", "timeupdate", "play"]) {
      if (boundHandlers[ev]) document.removeEventListener(ev, boundHandlers[ev], true);
    }
    if (boundHandlers.visibilitychange)
      document.removeEventListener("visibilitychange", boundHandlers.visibilitychange);
    if (boundHandlers.pagehide) window.removeEventListener("pagehide", boundHandlers.pagehide);
    if (boundHandlers.ytnavstart)
      window.removeEventListener("yt-navigate-start", boundHandlers.ytnavstart);

    boundHandlers = {};

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
    // Watch pages carry the ID in ?v=; Shorts carry it in the path (/shorts/ID).
    currentVideoId =
      urlParams.get("v") || window.location.pathname.match(/^\/shorts\/([\w-]{11})\/?$/)?.[1];

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
      await log("WARN", "No video element found after observing.");
      return;
    }

    if (!urlParams.get("t")) {
      try {
        const history = await browser.runtime.sendMessage({
          cmd: "get-yph-history",
          videoId: currentVideoId,
        });
        if (history?.t && !history.isCompleted) {
          const doResume = () => {
            const video = getVideo();
            if (!video) return;
            log("INFO", `Auto-resuming video to ${history.t}s`);
            video.currentTime = history.t;
          };
          const video = getVideo();
          if (video && video.readyState >= 1) doResume();
          else if (video) video.addEventListener("loadedmetadata", doResume, { once: true });
        }
      } catch {
        /* ignore */
      }
    }

    startProgressTracking();
  }

  const VIDEO_SELECTOR =
    "#movie_player video, #shorts-player video, ytd-reel-video-renderer[is-active] video, video.html5-main-video, video";

  // Observe for the video element instead of a fixed poll, so tracking starts the
  // moment the player materialises (slow Fenix loads, Shorts reels). A bounded
  // timeout still resolves null so onNavigateFinish can fail safely.
  function waitForVideoElement(timeoutMs = 30000) {
    return new Promise((resolve) => {
      const existing = document.querySelector(VIDEO_SELECTOR);
      if (existing) {
        resolve(existing);
        return;
      }

      let settled = false;
      let timer = null;
      let observer = null;

      const settle = (video) => {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        if (timer) clearTimeout(timer);
        resolve(video);
      };

      observer = new MutationObserver(() => {
        const video = document.querySelector(VIDEO_SELECTOR);
        if (video) settle(video);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });

      timer = setTimeout(() => settle(null), timeoutMs);
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

    // Attach media events at the document level (capture phase) so they keep firing
    // even when YouTube replaces the <video> element. The handlers re-query the live
    // element via getVideo() instead of holding a stale reference.
    document.addEventListener("pause", boundHandlers.pause, true);
    document.addEventListener("play", boundHandlers.play, true);
    document.addEventListener("ended", boundHandlers.ended, true);
    document.addEventListener("timeupdate", boundHandlers.timeupdate, true);
    document.addEventListener("visibilitychange", boundHandlers.visibilitychange);
    window.addEventListener("pagehide", boundHandlers.pagehide);
    window.addEventListener("yt-navigate-start", boundHandlers.ytnavstart);
  }

  function getVideo() {
    // Re-query the live video element on every access. YouTube replaces the <video>
    // element on m.youtube.com (especially around pre-roll ads), so a cached
    // reference goes stale — its readyState stays 0 and no events fire on it.
    return document.querySelector(VIDEO_SELECTOR);
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

    // Completion and unload events save immediately (no debounce). Unload fires on
    // pagehide/visibilitychange/SPA-navigation — on mobile (Fenix) the page can be
    // suspended before a debounced timer runs, dropping the last timestamp.
    if (triggerType === "ended" || triggerType === "unload") {
      await performSave(triggerType);
      return;
    }

    // Debounce pause events only
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
      // Throttle periodic saves, but never drop a final flush (unload) or a
      // completion (ended): on mobile the page can be suspended right after a recent
      // save, and the latest position must still persist.
      if (triggerType !== "unload" && triggerType !== "ended") {
        if (now - lastSaveTimestamp < rules.ruleHistoryThrottleMs) {
          return;
        }
      }

      const video = getVideo();
      if (!video || isAdShowing()) return;

      const dur = video.duration;
      const t = video.currentTime;

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
        const titleEl = document.querySelector(
          "h1.ytd-watch-metadata, .title.ytd-video-primary-info-renderer, .slim-video-metadata-title, .slim-video-information-title"
        );
        videoTitle = titleEl?.textContent?.trim() || "";
        const channelEl = document.querySelector(
          "#text.ytd-channel-name, ytd-video-owner-renderer #channel-name #text, .slim-owner-channel-name, .slim-video-information-channel"
        );
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

    const video = getVideo();
    if (!video || isAdShowing() || isCompleting) return;

    const dur = video.duration;
    const t = video.currentTime;

    if (!dur || isNaN(dur)) return;

    // Always save position periodically during playback (throttled). On mobile
    // (m.youtube.com / Fenix) the pause/ended events do not reliably fire, and the
    // unload flush often runs after YouTube has already reset the video element
    // (readyState back to 0), so periodic saves are the only reliable signal.
    if (now - lastSaveTimestamp >= rules.ruleHistoryThrottleMs) {
      await performSave("timeupdate");
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
