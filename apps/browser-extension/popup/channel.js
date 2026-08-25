/* eslint-disable no-console */
/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

import { getById, getErrorMessage, log, alert } from "./utils.js";
import { getActiveTab } from "./tabs.js";

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

// ---------------------------------------------------------------------------
// Modal visibility
// ---------------------------------------------------------------------------

/**
 * Show the channel import page
 */
export function showChannelModal() {
  const page = getById("channel-page");
  const mainMenu = getById("main-menu");
  const quickAdd = getById("quick-add-container");
  const menuDivider = getById("menu-divider");
  const header = getById("popup-header");

  if (header) header.style.display = "none";
  if (quickAdd) quickAdd.style.display = "none";
  if (menuDivider) menuDivider.style.display = "none";
  if (mainMenu) mainMenu.style.display = "none";
  if (page) page.style.display = "block";
}

/**
 * Hide the channel import page
 */
export function hideChannelModal() {
  const page = getById("channel-page");
  const mainMenu = getById("main-menu");
  const quickAdd = getById("quick-add-container");
  const menuDivider = getById("menu-divider");
  const header = getById("popup-header");

  if (page) page.style.display = "none";
  if (header) header.style.display = "flex";
  if (quickAdd) quickAdd.style.display = "block";
  if (menuDivider) menuDivider.style.display = "block";
  if (mainMenu) mainMenu.style.display = "block";

  // Reset progress section
  const progressSection = getById("progress-section");
  if (progressSection) progressSection.style.display = "none";

  const progressFill = getById("progress-fill");
  if (progressFill) progressFill.style.width = "0%";

  const progressText = getById("progress-text");
  if (progressText) progressText.textContent = "Initializing...";
}

/**
 * Update progress in the modal
 * @param {number} percent
 * @param {string} message
 */
export function updateProgress(percent, message) {
  const progressFill = getById("progress-fill");
  const progressText = getById("progress-text");

  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressText) progressText.textContent = message;
}

// ---------------------------------------------------------------------------
// Channel detection
// ---------------------------------------------------------------------------

/**
 * Detect channel from DOM using content script
 * @param {Tab} tab
 * @returns {Promise<{channelId: string, channelName: string} | null>}
 */
export async function detectChannelFromDOM(tab) {
  try {
    const result = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/content-scripts/injectors/get-channel-metadata.js"],
    });

    const metadata = result[0]?.result;
    if (metadata && metadata.channelId && metadata.channelName) {
      await log(
        "INFO",
        `Popup: Detected channel from DOM: ${metadata.channelName} (${metadata.channelId})`
      );
      return metadata;
    }
  } catch (e) {
    await log("WARN", "Popup: Failed to detect channel from DOM", getErrorMessage(e));
  }
  return null;
}

/**
 * Detect channel from URL
 * @param {string} url
 * @returns {{channelId: string, channelName: string} | null}
 */
export function detectChannelFromURL(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // Try to extract channel ID from various URL patterns
    const channelMatch = pathname.match(/\/channel\/([^/?]+)/);
    if (channelMatch) {
      return { channelId: channelMatch[1], channelName: "Channel" };
    }

    const handleMatch = pathname.match(/\/@([^/?]+)/);
    if (handleMatch) {
      return { channelId: handleMatch[1], channelName: `@${handleMatch[1]}` };
    }

    const customMatch = pathname.match(/\/c\/([^/?]+)/);
    if (customMatch) {
      return { channelId: customMatch[1], channelName: customMatch[1] };
    }

    const userMatch = pathname.match(/\/user\/([^/?]+)/);
    if (userMatch) {
      return { channelId: userMatch[1], channelName: userMatch[1] };
    }
  } catch (e) {
    console.warn("Popup: Failed to parse channel from URL", e);
  }
  return null;
}

/**
 * Check if URL is a YouTube channel page
 * @param {string} url
 * @returns {boolean}
 */
export function isYoutubeChannelPage(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    if (hostname !== "youtube.com" && !hostname.endsWith(".youtube.com")) return false;

    const channelPatterns = [/^\/channel\//, /^\/c\//, /^\/user\//, /^\/@/, /^\/videos$/];

    return channelPatterns.some((pattern) => pattern.test(pathname));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Channel import workflow
// ---------------------------------------------------------------------------

/**
 * Handle the channel import workflow
 * @param {any} videoService
 */
export async function handleChannelImport(videoService) {
  const confirmBtn = getById("confirm-import");
  const progressSection = getById("progress-section");
  const channelInfo = getById("channel-info");

  try {
    // Disable button during import
    if (confirmBtn) confirmBtn.disabled = true;
    if (progressSection) progressSection.style.display = "block";

    // Get selected options
    const quantity = parseInt(getById("input-quantity").value, 10) || 25;
    const order = getById("select-order").value;

    await log("INFO", `Popup: Starting page import - Quantity: ${quantity}, Order: ${order}`);

    // Get active tab
    updateProgress(10, "Detecting page...");
    const activeTab = await getActiveTab();
    if (!activeTab) throw new Error("No active tab found");
    if (!activeTab.id) throw new Error("Active tab has no ID");

    // Determine if this is a YouTube channel page
    const isChannelPage = activeTab.url && isYoutubeChannelPage(activeTab.url);
    await log("INFO", `Popup: Is channel page: ${isChannelPage}`);

    let videoIds = [];
    let pageTitle = activeTab.title || "Import";
    let scrapeResult;

    if (isChannelPage) {
      // Use channel-specific scraper with scrolling logic
      updateProgress(20, "Fetching videos from channel...");

      // Set target quantity as global variable
      await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (targetQuantity) => {
          window["YPH_TARGET_QUANTITY"] = targetQuantity;
        },
        args: [quantity],
      });

      const result = await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["/content-scripts/injectors/get-channel-video-ids.js"],
      });

      const rawVideos = result[0]?.result || [];
      await log("INFO", `Popup: Found ${rawVideos.length} videos on channel`);

      videoIds = rawVideos.map((v) => v.id);
      pageTitle = activeTab.title || "Channel Videos";

      // Show page info
      if (channelInfo) {
        channelInfo.textContent = `Found ${rawVideos.length} video(s) from channel`;
      }
    } else {
      // Use general page scraper
      updateProgress(20, "Scraping YouTube links...");
      let result;
      try {
        result = await browser.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["/content-scripts/injectors/scrape-youtube-links.js"],
        });
        await log("INFO", `Popup: Script execution result: ${JSON.stringify(result)}`);
      } catch (e) {
        await log("ERROR", `Popup: Script execution failed: ${getErrorMessage(e)}`);
        throw new Error(`Failed to execute scraping script: ${getErrorMessage(e)}`, { cause: e });
      }

      scrapeResult = result[0]?.result || {
        count: 0,
        links: [],
        url: activeTab.url,
        title: activeTab.title,
      };
      await log("INFO", `Popup: Scrape result: ${JSON.stringify(scrapeResult)}`);
      await log("INFO", `Popup: Found ${scrapeResult.count} YouTube links on page`);

      videoIds = scrapeResult.links.map((link) => link.id);
      pageTitle = scrapeResult.title || "Page Links";

      // Show page info
      if (channelInfo) {
        channelInfo.textContent = `Found ${scrapeResult.count} YouTube link(s) on: ${scrapeResult.title}`;
      }
    }

    updateProgress(40, `Found ${videoIds.length} videos...`);

    if (videoIds.length === 0) {
      throw new Error("No YouTube videos found on this page");
    }

    // Apply quantity limit
    let filteredIds = videoIds;
    if (quantity > 0 && filteredIds.length > quantity) {
      filteredIds = filteredIds.slice(0, quantity);
    }

    // Apply ordering
    if (order === "oldest") {
      filteredIds = filteredIds.reverse();
    }

    await log("INFO", `Popup: Processing ${filteredIds.length} videos after filtering`);
    updateProgress(50, `Processing ${filteredIds.length} videos...`);

    // Create playlist
    updateProgress(60, "Creating playlist...");
    const playlistName = `${pageTitle}`;
    const signedIn = await window.isSignedIn();

    const playlist = await videoService.generatePlaylist(filteredIds);
    playlist.title = playlistName;
    playlist.timestamp = Date.now();

    const id = await window.savePlaylist(playlist, { syncToYoutube: signedIn });
    await log("INFO", `Popup: Playlist created with ID: ${id}`);
    updateProgress(80, "Playlist created...");

    updateProgress(100, "Import complete!");
    await log("INFO", `Popup: Successfully imported ${filteredIds.length} videos`);

    // Open the editor
    const savedParam = id.startsWith("local-") ? "local=true" : "saved=true";
    await browser.tabs.create({
      url: browser.runtime.getURL(`/editor/index.html?id=${id}&${savedParam}#/editor`),
    });

    window.close();
  } catch (e) {
    const msg = getErrorMessage(e);
    await log("ERROR", "Popup: Page import failed", msg);
    alert("Import failed: " + msg);

    // Re-enable button on error
    if (confirmBtn) confirmBtn.disabled = false;
  }
}
