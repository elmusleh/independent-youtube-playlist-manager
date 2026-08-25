(async function () {
  const TARGET_QUANTITY = /** @type {number} */ (window["YPH_TARGET_QUANTITY"]) || 500; // Maximum videos to fetch

  // Helper to scroll down and wait for content to load
  async function scrollAndLoad(targetCount) {
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 100; // Prevent infinite loops

    while (scrollAttempts < maxScrollAttempts) {
      const currentVideos = document.querySelectorAll(
        "ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-compact-video-renderer"
      );

      if (currentVideos.length >= targetCount) {
        break;
      }

      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);

      // Wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newHeight = document.body.scrollHeight;

      // If height hasn't changed, we've reached the end
      if (newHeight === previousHeight) {
        scrollAttempts++;
        if (scrollAttempts >= 3) {
          break; // No more content loading
        }
      } else {
        scrollAttempts = 0;
        previousHeight = newHeight;
      }
    }

    // Scroll back to top
    window.scrollTo(0, 0);
  }

  // Scroll to load more videos
  await scrollAndLoad(TARGET_QUANTITY);

  const videoElements = [
    ...document.querySelectorAll(
      "ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-compact-video-renderer"
    ),
  ];

  const results = videoElements
    .map((el) => {
      const link = el.querySelector("a#video-title, a#video-title-link");
      const href = link ? link.getAttribute("href") : "";
      const match = href ? href.match(/watch\?v=([^&,]+)/) : null;
      const id = (match && match[1]) || "";

      // Scrape Title
      const title = link ? /** @type {HTMLElement} */ (link).innerText.trim() : "";

      // Scrape duration label
      const timeEl = el.querySelector(
        "ytd-thumbnail-overlay-time-status-renderer span, #text.ytd-thumbnail-overlay-time-status-renderer, span.ytd-thumbnail-overlay-time-status-renderer"
      );
      const durationLabel = timeEl ? /** @type {HTMLElement} */ (timeEl).innerText.trim() : "";

      // Scrape Channel
      const channelEl = document.querySelector(
        "#channel-name #text, #text-container.ytd-channel-name"
      );
      const channel = channelEl ? /** @type {HTMLElement} */ (channelEl).innerText.trim() : "";

      return { id, title, channel, durationLabel };
    })
    .filter((v) => v.id !== "");

  // Remove duplicates just in case
  const seen = new Set();
  const uniqueVideos = [];
  for (const v of results) {
    if (!seen.has(v.id)) {
      seen.add(v.id);
      uniqueVideos.push(v);
    }
  }

  return uniqueVideos;
})();
