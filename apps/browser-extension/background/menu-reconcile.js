/* eslint-disable no-console */
/**
 * Menu reconciliation — update labels/enabled states without full rebuild.
 */

import { isAndroid } from "./utils.js";
import { MenuId, MenuLabels, DestinationType, TabScope } from "./menu-constants.js";
import {
  getSettings,
  hasFavorite,
  hasSavedPlaylists,
  isBuilderEnabled,
  isSavedEnabled,
  buildScopesLabel,
  invalidateSettingsCache,
  invalidatePlaylistsCache,
} from "./menu-state.js";
import { resolveDestination } from "../shared/quick-add.js";

let _menuBuilt = false;
let _reconcileScheduled = false;

/**
 * Reconcile menu - update labels/enabled states without full rebuild.
 * Called on settings/playlist/auth changes.
 * @param {Object} settings
 */
export async function reconcileMenu(settings) {
  if (isAndroid()) return;
  if (!_menuBuilt) {
    const { buildMenu } = await import("./menu-builders.js");
    await buildMenu(settings);
    return;
  }

  if (_reconcileScheduled) return;
  _reconcileScheduled = true;

  // Debounce rapid changes
  setTimeout(async () => {
    _reconcileScheduled = false;
    try {
      const hasFav = hasFavorite(settings);
      const hasSaved = await hasSavedPlaylists();
      const isBuilderOn = isBuilderEnabled(settings);

      // Update scopes label
      await browser.contextMenus.update(MenuId.SCOPES_ROOT, { title: buildScopesLabel(settings) });

      // Update link/video items
      const destination = resolveDestination(settings, null, null);
      const destLabel = destination.type === DestinationType.CUSTOM ? "playlist" : destination.type;
      await browser.contextMenus.update(MenuId.ADD_LINK_TO_DEST, {
        title: `Add this YouTube link to ${destLabel}`,
      });
      await browser.contextMenus.update(MenuId.ADD_VIDEO_TO_DEST, {
        title: `Add this YouTube video to ${destLabel}`,
      });

      // Update destination submenu items
      await browser.contextMenus.update(MenuId.DEST_FAVORITE, {
        title: hasFav ? MenuLabels.DEST_FAVORITE : `${MenuLabels.DEST_FAVORITE} (not configured)`,
        enabled: hasFav,
      });
      await browser.contextMenus.update(MenuId.DEST_LATEST, {
        title: hasSaved ? MenuLabels.DEST_LATEST : `${MenuLabels.DEST_LATEST} (no playlists)`,
        enabled: hasSaved,
      });
      await browser.contextMenus.update(MenuId.DEST_BUILDER, { enabled: isBuilderOn });
      await browser.contextMenus.update(MenuId.DEST_CHOOSER, {
        title: hasSaved
          ? MenuLabels.DEST_CHOOSER
          : `${MenuLabels.DEST_CHOOSER} (no saved playlists)`,
        enabled: hasSaved,
      });
    } catch (e) {
      console.warn("Menu reconciliation failed:", e);
      // If reconciliation fails, fall back to full rebuild
      _menuBuilt = false;
      const { buildMenu } = await import("./menu-builders.js");
      await buildMenu(settings);
    }
  }, 50);
}

/**
 * Set menu built flag.
 * @param {boolean} built
 */
export function setMenuBuilt(built) {
  _menuBuilt = built;
}

/**
 * Get menu built flag.
 * @returns {boolean}
 */
export function getMenuBuilt() {
  return _menuBuilt;
}

export default {
  reconcileMenu,
  setMenuBuilt,
  getMenuBuilt,
};
