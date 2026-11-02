/* eslint-disable no-console */
/**
 * Simple menu items — creators for single menu items (save playlist, import, settings).
 */

import {
  MenuId,
  MenuLabels,
  PAGE_CONTEXTS,
  YOUTUBE_PLAYLIST_PATTERNS,
  ORDINARY_PAGE_PATTERNS,
} from "./menu-constants.js";

/**
 * Create YouTube playlist context item (Save this YouTube playlist…).
 */
export async function createSavePlaylistItem() {
  try {
    await browser.contextMenus.create({
      id: MenuId.SAVE_PLAYLIST,
      title: MenuLabels.SAVE_PLAYLIST,
      parentId: MenuId.ROOT,
      contexts: PAGE_CONTEXTS,
      documentUrlPatterns: YOUTUBE_PLAYLIST_PATTERNS,
    });
  } catch (e) {
    console.warn("Failed to create save playlist item:", e);
  }
}

/**
 * Create ordinary page context item (Import YouTube links from this page…).
 */
export async function createImportFromPageItem() {
  try {
    await browser.contextMenus.create({
      id: MenuId.IMPORT_FROM_PAGE,
      title: MenuLabels.IMPORT_FROM_PAGE,
      parentId: MenuId.ROOT,
      contexts: PAGE_CONTEXTS,
      documentUrlPatterns: ORDINARY_PAGE_PATTERNS,
    });
  } catch (e) {
    console.warn("Failed to create import from page item:", e);
  }
}

/**
 * Create Settings item.
 */
export async function createSettingsItem() {
  try {
    await browser.contextMenus.create({
      id: MenuId.SETTINGS,
      title: MenuLabels.SETTINGS,
      parentId: MenuId.ROOT,
      contexts: ["page", "link", "video", "frame", "selection"],
    });
  } catch (e) {
    console.warn("Failed to create settings item:", e);
  }
}

export default {
  createSavePlaylistItem,
  createImportFromPageItem,
  createSettingsItem,
};
