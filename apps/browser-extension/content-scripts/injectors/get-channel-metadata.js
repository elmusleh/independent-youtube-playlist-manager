(function() {
  // 1. Try to get channel ID from meta tags (most reliable)
  let channelId = "";
  const metaId = document.querySelector('meta[itemprop="identifier"]');
  if (metaId) {
    channelId = metaId.getAttribute("content") || "";
  }

  // 2. Fallback to canonical link
  if (!channelId) {
    const canonical = document.querySelector('link[rel="canonical"]');
    const href = canonical ? canonical.getAttribute("href") : "";
    if (href) {
      const match = href.match(/\/channel\/([^/?#]+)/);
      if (match) channelId = match[1];
    }
  }

  // 3. Fallback to scraping the ID from scripts (ytInitialData)
  if (!channelId && window['ytInitialData']) {
     try {
       channelId = window['ytInitialData'].metadata.channelMetadataRenderer.externalId;
     } catch(e) { /* ignore */ }
  }

  // Get Channel Name
  const channelNameEl = document.querySelector("#channel-name #text, #text-container.ytd-channel-name, .ytd-channel-name");
  const channelName = channelNameEl ? /** @type {HTMLElement} */ (channelNameEl).innerText.trim() : "Unknown Channel";

  return { channelId, channelName };
})();
