(function () {
  const videoElements = [
    ...document.querySelectorAll(
      "#content ytd-playlist-panel-video-renderer, #content ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer, ytd-playlist-video-renderer"
    ),
  ];

  return videoElements
    .map((el) => {
      const link = el.querySelector("a#thumbnail, a.ytd-playlist-video-renderer");
      const href = link ? link.getAttribute("href") : "";
      const match = href ? href.match(/watch\?v=([^&,]+)/) : null;
      const id = (match && match[1]) || "";

      // Scrape Title
      const titleEl = el.querySelector("#video-title");
      const title = titleEl ? titleEl.innerText.trim() : "";

      // Scrape Channel
      const channelEl = el.querySelector("#text.ytd-channel-name, #channel-name #text");
      const channel = channelEl ? channelEl.innerText.trim() : "";

      // Scrape duration label (e.g. "4:20")
      const timeEl = el.querySelector(
        "span.ytd-thumbnail-overlay-time-status-renderer, #text.ytd-thumbnail-overlay-time-status-renderer"
      );
      const durationLabel = timeEl ? timeEl.innerText.trim() : "";

      return { id, title, channel, durationLabel };
    })
    .filter((v) => v.id !== "");
})();
