/* eslint-disable no-console */
/**
 * Extracts metadata for the video currently open in the tab.
 *
 * Duration is the field most often lost, so the injector probes several
 * independent sources in order of reliability. Two rules matter here:
 *
 *  - `lengthSeconds === 0` is treated as "unknown", never as a live stream.
 *  - A zero-length result yields an empty duration string, so the caller's
 *    completeness check keeps failing and other tiers can still recover it.
 */
(() => {
  try {
    const pathname = window.location.pathname;
    const search = window.location.search;

    const isShortsPage = pathname.startsWith("/shorts/");
    const videoId = new URLSearchParams(search).get("v")
      ? new URLSearchParams(search).get("v")
      : pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/)?.[1];
    if (!videoId) return null;

    function isoToSeconds(iso) {
      if (!iso) return 0;
      const match = iso.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
      if (!match) return 0;
      const d = parseInt(match[1] || "0", 10);
      const h = parseInt(match[2] || "0", 10);
      const m = parseInt(match[3] || "0", 10);
      const s = parseFloat(match[4] || "0");
      return d * 86400 + h * 3600 + m * 60 + Math.floor(s);
    }

    function secsToISO(secs) {
      const s = Math.round(secs);
      if (!Number.isFinite(s) || s <= 0) return "";
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return "PT" + (h ? `${h}H` : "") + (m ? `${m}M` : "") + (sec || (!h && !m) ? `${sec}S` : "");
    }

    let title = "";
    let channel = "";
    let durationSeconds = 0;
    let durationISO = "";
    let isLive = false;

    // Source 1: microdata / OpenGraph (fastest, present on watch pages)
    title =
      document.querySelector('meta[itemprop="name"]')?.getAttribute("content") ||
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      document.querySelector("#title h1 yt-formatted-string")?.textContent?.trim() ||
      "";

    channel =
      document.querySelector('link[itemprop="name"]')?.getAttribute("content") ||
      document
        .querySelector('span[itemprop="author"] link[itemprop="name"]')
        ?.getAttribute("content") ||
      document.querySelector("ytd-video-owner-renderer #channel-name a")?.textContent?.trim() ||
      document.querySelector("#owner #channel-name a")?.textContent?.trim() ||
      document.querySelector(".slim-owner-channel-name")?.textContent?.trim() ||
      "";

    const metaDuration = document
      .querySelector('meta[itemprop="duration"]')
      ?.getAttribute("content");
    if (metaDuration) durationISO = metaDuration;
    if (!title) title = document.title.replace(" - YouTube", "");

    // Source 2: server-rendered ytInitialPlayerResponse (authoritative)
    const playerResponse = window.ytInitialPlayerResponse;
    if (playerResponse && playerResponse.videoDetails) {
      const details = playerResponse.videoDetails;
      if (!title && details.title) title = details.title;
      if (!channel && details.author) channel = details.author;
      if (details.lengthSeconds) {
        const parsed = parseInt(details.lengthSeconds, 10);
        if (parsed > 0) {
          durationSeconds = parsed;
          durationISO = secsToISO(parsed);
        }
      }
      isLive =
        details.isLiveContent === true ||
        Boolean(details.liveBroadcastDetails) ||
        Boolean(playerResponse.microformat?.playerMicroformatRenderer?.liveBroadcastDetails);
    }

    // Source 3: server-rendered ytInitialData (fills gaps for Shorts / new layouts)
    if (!durationSeconds && window.ytInitialData && typeof window.ytInitialData === "object") {
      const str = JSON.stringify(window.ytInitialData);
      const match = str.match(/"lengthSeconds":"(\d+)"/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (parsed > 0) {
          durationSeconds = parsed;
          durationISO = secsToISO(parsed);
        }
      }
      if (!isLive && /"isLiveContent":true|"isLiveNow":true/.test(str)) isLive = true;
    }

    // Source 4: JSON-LD VideoObject
    if (!durationSeconds) {
      for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const data = JSON.parse(node.textContent || "{}");
          const duration = data.duration || data["@graph"]?.[0]?.duration;
          if (typeof duration === "string" && duration.startsWith("PT")) {
            const parsed = isoToSeconds(duration);
            if (parsed > 0) {
              durationSeconds = parsed;
              durationISO = duration;
            }
            break;
          }
        } catch {
          /* ignore malformed JSON-LD */
        }
      }
    }

    // Source 5: HTML5 media element (last resort — already-playing pages only)
    if (!durationSeconds) {
      const videoEl = document.querySelector("video.html5-main-video, video");
      if (videoEl && videoEl.duration && !isNaN(videoEl.duration) && videoEl.duration > 0) {
        durationSeconds = Math.round(videoEl.duration);
        durationISO = secsToISO(durationSeconds);
      }
    }

    return {
      videoId,
      title: title || "",
      channel: channel || "",
      durationISO: durationISO || "",
      durationSeconds: durationSeconds || 0,
      isLive,
      isShort: isShortsPage || Boolean(playerResponse?.videoDetails?.isShorts),
    };
  } catch (e) {
    console.error("[YPH] Metadata extraction failed:", e);
    return null;
  }
})();
