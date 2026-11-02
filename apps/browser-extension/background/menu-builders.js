/* eslint-disable no-console */
/**
 * Menu builders — functions to create each menu section.
 */

import { isAndroid } from "./utils.js";
import {
  MenuId,
  MenuLabels,
  ROOT_CONTEXTS,
  LINK_VIDEO_CONTEXTS,
  PAGE_CONTEXTS,
  YOUTUBE_WATCH_PATTERNS,
  YOUTUBE_PLAYLIST_PATTERNS,
  ORDINARY_PAGE_PATTERNS,
} from "./menu-constants.js";
import {
  getSettings,
  hasFavorite,
  hasSavedPlaylists,
  isBuilderEnabled,
  isSavedEnabled,
  buildScopesLabel,
} from "./menu-state.js";
import { DestinationType } from "../shared/quick-add.js";
import { resolveDestination } from "../shared/quick-add.js";
import { TabScope } from "../shared/tab-selection.js";
import {
  createSavePlaylistItem,
  createImportFromPageItem,
  createSettingsItem,
} from "./menu-simple-items.js";

/**
 * Create the root menu item.
 */
export async function createRootMenu() {
  const title = MenuLabels.ROOT;
  try {
    await browser.contextMenus.create({
      id: MenuId.ROOT,
      title,
      contexts: ROOT_CONTEXTS,
    });
  } catch (e) {
    try {
      await browser.contextMenus.update(MenuId.ROOT, { title });
    } catch (err) {
      console.warn("Failed to create/update root menu:", err);
    }
  }
}

/**
 * Create the "My Playlists" header item (disabled, acts as section label).
 */
export async function createMyPlaylistsHeader() {
  try {
    await browser.contextMenus.create({
      id: MenuId.MY_PLAYLISTS,
      title: MenuLabels.MY_PLAYLISTS,
      parentId: MenuId.ROOT,
      contexts: ROOT_CONTEXTS,
      enabled: false,
    });
  } catch (e) {
    console.warn("Failed to create My Playlists header:", e);
  }
}

/**
 * Create separator.
 */
export async function createSeparator(id, parentId) {
  try {
    await browser.contextMenus.create({
      id,
      type: "separator",
      parentId,
      contexts: ROOT_CONTEXTS,
    });
  } catch (e) {
    console.warn(`Failed to create separator ${id}:`, e);
  }
}

/**
 * Create the Scopes submenu with 7 scope items.
 * @param {Object} settings
 */
export async function createScopesSubmenu(settings) {
  const label = buildScopesLabel(settings);

  try {
    await browser.contextMenus.create({
      id: MenuId.SCOPES_ROOT,
      title: label,
      parentId: MenuId.ROOT,
      contexts: ROOT_CONTEXTS,
    });
  } catch (e) {
    try {
      await browser.contextMenus.update(MenuId.SCOPES_ROOT, { title: label });
    } catch (err) {
      console.warn("Failed to create/update scopes submenu:", err);
    }
  }

  const scopes = [
    { id: MenuId.SCOPE_CURRENT, label: MenuLabels.SCOPE_CURRENT, scope: TabScope.CURRENT },
    { id: MenuId.SCOPE_LEFT, label: MenuLabels.SCOPE_LEFT, scope: TabScope.LEFT },
    { id: MenuId.SCOPE_RIGHT, label: MenuLabels.SCOPE_RIGHT, scope: TabScope.RIGHT },
    {
      id: MenuId.SCOPE_ALL_INCLUDE,
      label: MenuLabels.SCOPE_ALL_INCLUDE,
      scope: TabScope.ALL_THIS_WINDOW_INCLUDE,
    },
    {
      id: MenuId.SCOPE_ALL_EXCLUDE,
      label: MenuLabels.SCOPE_ALL_EXCLUDE,
      scope: TabScope.ALL_THIS_WINDOW_EXCLUDE,
    },
    {
      id: MenuId.SCOPE_ALL_WINDOWS,
      label: MenuLabels.SCOPE_ALL_WINDOWS,
      scope: TabScope.ALL_WINDOWS,
    },
    { id: MenuId.SCOPE_SELECTED, label: MenuLabels.SCOPE_SELECTED, scope: TabScope.SELECTED },
  ];

  for (const scope of scopes) {
    try {
      await browser.contextMenus.create({
        id: scope.id,
        title: scope.label,
        parentId: MenuId.SCOPES_ROOT,
        contexts: ROOT_CONTEXTS,
      });
    } catch (e) {
      console.warn(`Failed to create scope ${scope.id}:`, e);
    }
  }
}

/**
 * Create link/video context items (appear when right-clicking a YouTube link/video).
 * @param {Object} settings
 */
export async function createLinkVideoItems(settings) {
  const destination = await resolveDestination(settings, null, null);
  const destLabel = destination.type === DestinationType.CUSTOM ? "playlist" : destination.type;

  // Link context
  try {
    await browser.contextMenus.create({
      id: MenuId.ADD_LINK_TO_DEST,
      title: `Add this YouTube link to ${destLabel}`,
      contexts: LINK_VIDEO_CONTEXTS,
      documentUrlPatterns: ORDINARY_PAGE_PATTERNS,
      targetUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"],
    });
  } catch (e) {
    try {
      await browser.contextMenus.update(MenuId.ADD_LINK_TO_DEST, {
        title: `Add this YouTube link to ${destLabel}`,
      });
    } catch (err) {
      console.warn("Failed to create/update link item:", err);
    }
  }

  // Video context
  try {
    await browser.contextMenus.create({
      id: MenuId.ADD_VIDEO_TO_DEST,
      title: `Add this YouTube video to ${destLabel}`,
      contexts: ["video"],
      documentUrlPatterns: YOUTUBE_WATCH_PATTERNS,
    });
  } catch (e) {
    try {
      await browser.contextMenus.update(MenuId.ADD_VIDEO_TO_DEST, {
        title: `Add this YouTube video to ${destLabel}`,
      });
    } catch (err) {
      console.warn("Failed to create/update video item:", err);
    }
  }
}

/**
 * Create the Destination chooser submenu.
 * @param {Object} settings
 */
export async function createDestinationSubmenu(settings) {
  const hasFav = hasFavorite(settings);
  const hasSaved = await hasSavedPlaylists();
  const isBuilderOn = isBuilderEnabled(settings);

  try {
    await browser.contextMenus.create({
      id: MenuId.DEST_ROOT,
      title: MenuLabels.DEST_ROOT,
      parentId: MenuId.ROOT,
      contexts: ROOT_CONTEXTS,
    });
  } catch (e) {
    console.warn("Failed to create destination submenu:", e);
  }

  // Favorite
  try {
    await browser.contextMenus.create({
      id: MenuId.DEST_FAVORITE,
      title: hasFav ? MenuLabels.DEST_FAVORITE : `${MenuLabels.DEST_FAVORITE} (not configured)`,
      parentId: MenuId.DEST_ROOT,
      contexts: ROOT_CONTEXTS,
      enabled: hasFav,
    });
  } catch (e) {
    console.warn("Failed to create favorite dest:", e);
  }

  // Latest
  try {
    await browser.contextMenus.create({
      id: MenuId.DEST_LATEST,
      title: hasSaved ? MenuLabels.DEST_LATEST : `${MenuLabels.DEST_LATEST} (no playlists)`,
      parentId: MenuId.DEST_ROOT,
      contexts: ROOT_CONTEXTS,
      enabled: hasSaved,
    });
  } catch (e) {
    console.warn("Failed to create latest dest:", e);
  }

  // Builder
  try {
    await browser.contextMenus.create({
      id: MenuId.DEST_BUILDER,
      title: MenuLabels.DEST_BUILDER,
      parentId: MenuId.DEST_ROOT,
      contexts: ROOT_CONTEXTS,
      enabled: isBuilderOn,
    });
  } catch (e) {
    console.warn("Failed to create builder dest:", e);
  }

  // New local
  try {
    await browser.contextMenus.create({
      id: MenuId.DEST_NEW_LOCAL,
      title: MenuLabels.DEST_NEW_LOCAL,
      parentId: MenuId.DEST_ROOT,
      contexts: ROOT_CONTEXTS,
      enabled: true,
    });
  } catch (e) {
    console.warn("Failed to create new local dest:", e);
  }

  // Chooser (always enabled if there are saved playlists)
  try {
    await browser.contextMenus.create({
      id: MenuId.DEST_CHOOSER,
      title: hasSaved ? MenuLabels.DEST_CHOOSER : `${MenuLabels.DEST_CHOOSER} (no saved playlists)`,
      parentId: MenuId.DEST_ROOT,
      contexts: ROOT_CONTEXTS,
      enabled: hasSaved,
    });
  } catch (e) {
    console.warn("Failed to create chooser dest:", e);
  }
}

/**
 * Build the complete menu structure.
 * @param {Object} settings
 */
export async function buildMenu(settings) {
  if (isAndroid()) return;

  const start = Date.now();
  try {
    // Remove all existing menus first (clean rebuild)
    await browser.contextMenus.removeAll();

    // Build in order
    await createRootMenu();
    await createMyPlaylistsHeader();
    await createSeparator(MenuId.SEPARATOR_1, MenuId.ROOT);
    await createScopesSubmenu(settings);
    await createLinkVideoItems(settings);
    await createDestinationSubmenu(settings);
    await createSeparator(MenuId.SEPARATOR_2, MenuId.ROOT);
    await createSavePlaylistItem();
    await createImportFromPageItem();
    await createSeparator(MenuId.SEPARATOR_3, MenuId.ROOT);
    await createSettingsItem();
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `buildMenu took ${duration}ms`);
    }
  }
}

export default {
  createRootMenu,
  createMyPlaylistsHeader,
  createSeparator,
  createScopesSubmenu,
  createLinkVideoItems,
  createDestinationSubmenu,
  buildMenu,
};
