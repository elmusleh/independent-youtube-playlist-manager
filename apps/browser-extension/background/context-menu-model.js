/* eslint-disable no-console */
/**
 * Context Menu Model — Entry point composing menu-constants, menu-state, menu-builders, menu-reconcile, menu-click-handler.
 */

import { isAndroid } from "./utils.js";
import { getSettings, invalidateSettingsCache, invalidatePlaylistsCache } from "./menu-state.js";
import { buildMenu } from "./menu-builders.js";
import { reconcileMenu, setMenuBuilt } from "./menu-reconcile.js";
import { handleMenuClick } from "./menu-click-handler.js";
// Import constants for default export
import {
  MenuId,
  MenuLabels,
  ROOT_CONTEXTS,
  LINK_VIDEO_CONTEXTS,
  PAGE_CONTEXTS,
  YOUTUBE_WATCH_PATTERNS,
  YOUTUBE_PLAYLIST_PATTERNS,
  ORDINARY_PAGE_PATTERNS,
  DestinationType,
  TabScope,
} from "./menu-constants.js";
import { getPlaylists } from "./menu-state.js";

// Re-export all constants
export {
  MenuId,
  MenuLabels,
  ROOT_CONTEXTS,
  LINK_VIDEO_CONTEXTS,
  PAGE_CONTEXTS,
  YOUTUBE_WATCH_PATTERNS,
  YOUTUBE_PLAYLIST_PATTERNS,
  ORDINARY_PAGE_PATTERNS,
  DestinationType,
  TabScope,
} from "./menu-constants.js";

// Re-export state functions
export {
  getSettings,
  invalidateSettingsCache,
  getPlaylists,
  invalidatePlaylistsCache,
  isBuilderEnabled,
  isSavedEnabled,
  hasFavorite,
  hasSavedPlaylists,
  buildDestinationLabel,
  buildScopesLabel,
} from "./menu-state.js";

// Re-export builders
export {
  createRootMenu,
  createMyPlaylistsHeader,
  createSeparator,
  createScopesSubmenu,
  createLinkVideoItems,
  createDestinationSubmenu,
  createSavePlaylistItem,
  createImportFromPageItem,
  createSettingsItem,
  buildMenu,
} from "./menu-builders.js";

// Re-export reconciliation
export { reconcileMenu, setMenuBuilt, getMenuBuilt } from "./menu-reconcile.js";

// Re-export click handler
export { handleMenuClick } from "./menu-click-handler.js";

/**
 * Initialize menu on install/startup.
 */
export async function initializeMenu() {
  if (isAndroid()) return;

  try {
    await browser.contextMenus.removeAll();
    const settings = await getSettings();
    await buildMenu(settings);
    setMenuBuilt(true);
  } catch (e) {
    console.error("Menu initialization failed:", e);
  }
}

/**
 * Refresh menu labels from current settings/playlists.
 * Called from background message handler on settings/playlist changes.
 */
export async function refreshMenu() {
  invalidateSettingsCache();
  invalidatePlaylistsCache();
  const settings = await getSettings();
  await reconcileMenu(settings);
}

export default {
  // Constants
  MenuId,
  MenuLabels,
  ROOT_CONTEXTS,
  LINK_VIDEO_CONTEXTS,
  PAGE_CONTEXTS,
  YOUTUBE_WATCH_PATTERNS,
  YOUTUBE_PLAYLIST_PATTERNS,
  ORDINARY_PAGE_PATTERNS,
  DestinationType,
  TabScope,
  // State
  getSettings,
  invalidateSettingsCache,
  getPlaylists,
  invalidatePlaylistsCache,
  // Builders
  buildMenu,
  // Reconciliation
  reconcileMenu,
  // Click handler
  handleMenuClick,
  // Initialization
  initializeMenu,
  refreshMenu,
  resolveDestination: (settings, destinationType, destinationId) => {
    // Delegate to shared quick-add
    return import("../shared/quick-add.js").then(({ resolveDestination: fn }) =>
      fn(settings, destinationType, destinationId)
    );
  },
};
