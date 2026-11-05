/**
 * Menu constants — Stable IDs, labels, and context definitions.
 */

import { DestinationType } from "../shared/quick-add.js";
import { TabScope } from "../shared/tab-selection.js";

// ─── Stable Menu Item IDs ─────────────────────────────────────────────────────

export const MenuId = {
  // Root
  ROOT: "yph-root",

  // Main sections
  MY_PLAYLISTS: "yph-my-playlists",
  SEPARATOR_1: "yph-sep-1",

  // Scopes submenu
  SCOPES_ROOT: "yph-scopes-root",
  SCOPE_CURRENT: "yph-scope-current",
  SCOPE_LEFT: "yph-scope-left",
  SCOPE_RIGHT: "yph-scope-right",
  SCOPE_ALL_INCLUDE: "yph-scope-all-include",
  SCOPE_ALL_EXCLUDE: "yph-scope-all-exclude",
  SCOPE_ALL_WINDOWS: "yph-scope-all-windows",
  SCOPE_SELECTED: "yph-scope-selected",

  // Link/video context items
  ADD_LINK_TO_DEST: "yph-add-link-to-dest",
  ADD_VIDEO_TO_DEST: "yph-add-video-to-dest",

  // Destination chooser submenu
  DEST_ROOT: "yph-dest-root",
  DEST_FAVORITE: "yph-dest-favorite",
  DEST_LATEST: "yph-dest-latest",
  DEST_BUILDER: "yph-dest-builder",
  DEST_NEW_LOCAL: "yph-dest-new-local",
  DEST_CHOOSER: "yph-dest-chooser",

  // YouTube playlist context
  SEPARATOR_2: "yph-sep-2",
  SAVE_PLAYLIST: "yph-save-playlist",

  // Ordinary page context
  IMPORT_FROM_PAGE: "yph-import-from-page",

  // Settings
  SEPARATOR_3: "yph-sep-3",
  SETTINGS: "yph-settings",
};

// ─── Menu Labels ──────────────────────────────────────────────────────────────

export const MenuLabels = {
  ROOT: "Playlist Manager",
  MY_PLAYLISTS: "My Playlists",
  SCOPES_ROOT: "Add YouTube tabs to [destination]",
  SCOPE_CURRENT: "Only this video tab",
  SCOPE_LEFT: "Tabs to the left",
  SCOPE_RIGHT: "Tabs to the right",
  SCOPE_ALL_INCLUDE: "All tabs in this window",
  SCOPE_ALL_EXCLUDE: "Other tabs in this window",
  SCOPE_ALL_WINDOWS: "All tabs across normal windows",
  SCOPE_SELECTED: "Selected tabs in this window",
  ADD_LINK_TO_DEST: "Add this YouTube link to [destination]",
  ADD_VIDEO_TO_DEST: "Add this YouTube video to [destination]",
  DEST_ROOT: "Destination",
  DEST_FAVORITE: "Favorite playlist",
  DEST_LATEST: "Latest playlist",
  DEST_BUILDER: "Playlist Builder",
  DEST_NEW_LOCAL: "New local playlist",
  DEST_CHOOSER: "Choose saved playlist…",
  SAVE_PLAYLIST: "Save this YouTube playlist…",
  IMPORT_FROM_PAGE: "Import YouTube links from this page…",
  SETTINGS: "Settings",
};

// ─── Context Definitions ──────────────────────────────────────────────────────

/**
 * Contexts where the root menu appears.
 * @readonly
 */
export const ROOT_CONTEXTS = ["page", "link", "video", "frame", "selection"];

/**
 * Contexts for link/video specific items.
 * @readonly
 */
export const LINK_VIDEO_CONTEXTS = ["link", "video"];

/**
 * Context for page-level items (YouTube watch page).
 * @readonly
 */
export const PAGE_CONTEXTS = ["page"];

/**
 * Document URL patterns for YouTube watch pages.
 * @readonly
 */
export const YOUTUBE_WATCH_PATTERNS = [
  "https://www.youtube.com/watch*",
  "https://m.youtube.com/watch*",
];

/**
 * Document URL patterns for YouTube playlist pages.
 * @readonly
 */
export const YOUTUBE_PLAYLIST_PATTERNS = [
  "https://www.youtube.com/playlist*",
  "https://m.youtube.com/playlist*",
];

/**
 * Document URL patterns for ordinary HTTP(S) pages.
 * @readonly
 */
export const ORDINARY_PAGE_PATTERNS = ["http://*/*", "https://*/*"];

export default {
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
};
