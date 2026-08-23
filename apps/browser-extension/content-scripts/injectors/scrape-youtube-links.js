(async function () {
  // More flexible regex to match YouTube video IDs
  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const videoIdRegex = /([a-zA-Z0-9_-]{11})/;
  const videoIds = new Set();
  const links = [];

  // Helper to extract video ID from URL
  function extractVideoId(url) {
    if (!url) return null;
    const match = url.match(youtubeRegex);
    return match ? match[1] : null;
  }

  // Helper to normalize URL (handle relative URLs)
  function normalizeUrl(url) {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (url.startsWith("//")) {
      return window.location.protocol + url;
    }
    if (url.startsWith("/")) {
      return window.location.origin + url;
    }
    return url;
  }

  // Wait for dynamic content to load on YouTube pages
  async function waitForContent() {
    // If this is a YouTube watch page, wait a bit for related videos to load
    if (
      window.location.hostname === "www.youtube.com" &&
      window.location.pathname === "/watch"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to scroll to trigger lazy loading of related videos
      const relatedSection = document.querySelector("#secondary");
      if (relatedSection) {
        relatedSection.scrollIntoView({ behavior: "auto" });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  await waitForContent();

  // Scrape all links (a href)
  try {
    const allLinks = document.querySelectorAll("a[href]");
    allLinks.forEach((link) => {
      try {
        const href = link.getAttribute("href");
        const normalizedHref = normalizeUrl(href);
        const videoId = extractVideoId(normalizedHref);
        if (videoId && !videoIds.has(videoId)) {
          videoIds.add(videoId);
          links.push({
            id: videoId,
            url: normalizedHref,
            text: link.textContent?.trim() || "",
            source: "link",
          });
        }
      } catch (e) {
        // Skip individual link errors
      }
    });
  } catch (e) {
    // Continue if querySelectorAll fails
  }

  // Scrape iframes
  try {
    const iframes = document.querySelectorAll("iframe[src]");
    iframes.forEach((iframe) => {
      try {
        const src = iframe.getAttribute("src");
        const normalizedSrc = normalizeUrl(src);
        const videoId = extractVideoId(normalizedSrc);
        if (videoId && !videoIds.has(videoId)) {
          videoIds.add(videoId);
          links.push({
            id: videoId,
            url: normalizedSrc,
            text: "",
            source: "iframe",
          });
        }
      } catch (e) {
        // Skip individual iframe errors
      }
    });
  } catch (e) {
    // Continue if querySelectorAll fails
  }

  // Scrape text content for YouTube URLs
  try {
    const bodyText = document.body ? document.body.innerText : "";
    const globalYoutubeRegex = new RegExp(youtubeRegex.source, "g");
    let match;
    while ((match = globalYoutubeRegex.exec(bodyText)) !== null) {
      const videoId = match[1];
      if (videoId && !videoIds.has(videoId)) {
        videoIds.add(videoId);
        links.push({
          id: videoId,
          url: match[0],
          text: "",
          source: "text",
        });
      }
    }
  } catch (e) {
    // Continue if body text extraction fails
  }

  return {
    count: links.length,
    links: links,
    url: window.location.href,
    title: document.title,
  };
})();
