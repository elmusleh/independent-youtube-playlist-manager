/* eslint-disable no-console */
(() => {
  try {
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (!videoId) return null;

    let title =
      document.querySelector('meta[itemprop="name"]')?.getAttribute("content") ||
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      document.querySelector("#title h1 yt-formatted-string")?.textContent?.trim() ||
      document.title.replace(" - YouTube", "");

    let channel =
      document.querySelector('link[itemprop="name"]')?.getAttribute("content") ||
      document
        .querySelector('span[itemprop="author"] link[itemprop="name"]')
        ?.getAttribute("content") ||
      document.querySelector("ytd-video-owner-renderer #channel-name a")?.textContent?.trim() ||
      document.querySelector("#owner #channel-name a")?.textContent?.trim();

    let durationISO =
      document.querySelector('meta[itemprop="duration"]')?.getAttribute("content") || "";

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
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return "PT" + (h ? `${h}H` : "") + (m ? `${m}M` : "") + (sec || (!h && !m) ? `${sec}S` : "");
    }

    let durationSeconds = isoToSeconds(durationISO);

    // Fallback: Check ytInitialPlayerResponse on window
    const playerResponse = window.ytInitialPlayerResponse;
    if (playerResponse && playerResponse.videoDetails) {
      const details = playerResponse.videoDetails;
      if (!title && details.title) title = details.title;
      if (!channel && details.author) channel = details.author;
      if (!durationSeconds && details.lengthSeconds) {
        durationSeconds = parseInt(details.lengthSeconds, 10);
        durationISO = secsToISO(durationSeconds);
      }
    }

    // Fallback: Check HTML5 video element duration
    if (!durationSeconds) {
      const videoEl = document.querySelector("video.html5-main-video");
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
    };
  } catch (e) {
    console.error("[YPH] Metadata extraction failed:", e);
    return null;
  }
})();
