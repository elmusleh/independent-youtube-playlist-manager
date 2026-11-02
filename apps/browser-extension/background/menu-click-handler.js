/* eslint-disable no-console */
/**
 * Menu click handler — route context menu clicks to appropriate action.
 */

import { MenuId, DestinationType, TabScope } from "./menu-constants.js";

/**
 * Handle context menu click - route to appropriate handler.
 * @param {browser.contextMenus.OnClickData} info
 * @param {browser.tabs.Tab} tab
 * @returns {Promise<Object>}
 */
export async function handleMenuClick(info, tab) {
  const clickedId = info.menuItemId.toString();

  // Scope items
  const scopeMap = {
    [MenuId.SCOPE_CURRENT]: TabScope.CURRENT,
    [MenuId.SCOPE_LEFT]: TabScope.LEFT,
    [MenuId.SCOPE_RIGHT]: TabScope.RIGHT,
    [MenuId.SCOPE_ALL_INCLUDE]: TabScope.ALL_THIS_WINDOW_INCLUDE,
    [MenuId.SCOPE_ALL_EXCLUDE]: TabScope.ALL_THIS_WINDOW_EXCLUDE,
    [MenuId.SCOPE_ALL_WINDOWS]: TabScope.ALL_WINDOWS,
    [MenuId.SCOPE_SELECTED]: TabScope.SELECTED,
  };

  if (scopeMap[clickedId]) {
    return { type: "scope", scope: scopeMap[clickedId], tab };
  }

  // Link/video items
  if (clickedId === MenuId.ADD_LINK_TO_DEST || clickedId === MenuId.ADD_VIDEO_TO_DEST) {
    return { type: "single-video", info, tab };
  }

  // Destination items
  const destMap = {
    [MenuId.DEST_FAVORITE]: DestinationType.FAVORITE,
    [MenuId.DEST_LATEST]: DestinationType.LATEST,
    [MenuId.DEST_BUILDER]: DestinationType.BUILDER,
    [MenuId.DEST_NEW_LOCAL]: DestinationType.NEW_LOCAL,
    [MenuId.DEST_CHOOSER]: DestinationType.CUSTOM, // Opens chooser
  };

  if (destMap[clickedId]) {
    return { type: "destination", destinationType: destMap[clickedId], tab };
  }

  // YouTube playlist save
  if (clickedId === MenuId.SAVE_PLAYLIST) {
    return { type: "save-playlist", info, tab };
  }

  // Page import
  if (clickedId === MenuId.IMPORT_FROM_PAGE) {
    return { type: "page-import", info, tab };
  }

  // Settings
  if (clickedId === MenuId.SETTINGS) {
    return { type: "settings", tab };
  }

  return { type: "unknown", clickedId };
}

export default {
  handleMenuClick,
};
