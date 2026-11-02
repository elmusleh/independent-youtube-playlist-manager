/**
 * Shared quick-add logic for context menu and popup.
 * Pure functions: DOM-free destination/insertion rules; validated plain JSON input/output.
 */

import {
  isYouTubeHost,
  getYouTubeVideoInfo,
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
  deduplicateVideoIds,
  extractUniqueVideoIds,
} from "./tab-selection.js";

/**
 * Destination types for quick-add.
 * @readonly
 * @enum {string}
 */
export const DestinationType = {
  FAVORITE: "favorite",
  LATEST: "latest",
  BUILDER: "builder",
  NEW_LOCAL: "new-local",
  CUSTOM: "custom", // saved playlist by ID
};

/**
 * Insertion position.
 * @readonly
 * @enum {string}
 */
export const InsertPosition = {
  TOP: "top",
  BOTTOM: "bottom",
};

/**
 * Settings relevant to quick-add.
 * @typedef {Object} QuickAddSettings
 * @property {string} defaultQuickAddTarget - "favorite" | "latest" | "create" | "custom"
 * @property {string} defaultTabScope - TabScope value
 * @property {string} addToLatestPosition - "top" | "bottom"
 * @property {boolean} openPlaylistBuilderAfterAdd
 * @property {boolean} openSavedPlaylistAfterAdd
 * @property {boolean} closeAddedTabs
 * @property {boolean} disableContextBuilder
 * @property {boolean} disableContextSaved
 * @property {string} watchLaterPlaylistId
 */

/**
 * Result of a quick-add operation.
 * @typedef {Object} QuickAddResult
 * @property {boolean} success
 * @property {string} destinationId - ID of the destination playlist/builder
 * @property {string} destinationType - One of DestinationType
 * @property {number} addedCount
 * @property {number} duplicateCount
 * @property {number} skippedCount
 * @property {number} failedCount
 * @property {string[]} addedVideoIds
 * @property {string} [error]
 */

/**
 * Input for quick-add operation (serializable, no DOM/browser refs).
 * @typedef {Object} QuickAddInput
 * @property {string[]} videoIds - Validated YouTube video IDs
 * @property {string} destinationType - One of DestinationType
 * @property {string} [destinationId] - Required for CUSTOM destination
 * @property {string} [insertPosition] - "top" | "bottom"
 * @property {boolean} [syncToYouTube=false]
 * @property {boolean} [closeTabs=false]
 * @property {Object} [anchorSnapshot] - For tab validation
 */

/**
 * Determine the effective destination from settings and explicit choice.
 * @param {QuickAddSettings} settings
 * @param {string} [explicitDestinationType] - Override from user action
 * @param {string} [explicitDestinationId] - Playlist ID for custom
 * @returns {{ type: string; id: string | null; requiresChooser: boolean; reason?: string }}
 */
export function resolveDestination(settings, explicitDestinationType, explicitDestinationId) {
  // Explicit user choice from menu/chooser takes precedence
  if (explicitDestinationType) {
    if (explicitDestinationType === DestinationType.CUSTOM) {
      if (!explicitDestinationId) {
        return {
          type: DestinationType.CUSTOM,
          id: null,
          requiresChooser: true,
          reason: "No playlist ID provided for custom destination",
        };
      }
      return { type: DestinationType.CUSTOM, id: explicitDestinationId, requiresChooser: false };
    }
    if (explicitDestinationType === DestinationType.FAVORITE) {
      const favId = settings.watchLaterPlaylistId;
      if (!favId) {
        return {
          type: DestinationType.FAVORITE,
          id: null,
          requiresChooser: true,
          reason: "No favorite playlist configured",
        };
      }
      return { type: DestinationType.FAVORITE, id: favId, requiresChooser: false };
    }
    if (explicitDestinationType === DestinationType.LATEST) {
      return { type: DestinationType.LATEST, id: null, requiresChooser: false }; // resolved at runtime
    }
    if (explicitDestinationType === DestinationType.BUILDER) {
      return { type: DestinationType.BUILDER, id: "yphPlaylistBuilder", requiresChooser: false };
    }
    if (explicitDestinationType === DestinationType.NEW_LOCAL) {
      return { type: DestinationType.NEW_LOCAL, id: null, requiresChooser: false };
    }
  }

  // Fall back to settings default
  const defaultMode = settings.defaultQuickAddTarget || "create";
  if (defaultMode === "favorite") {
    const favId = settings.watchLaterPlaylistId;
    if (!favId) {
      return {
        type: DestinationType.FAVORITE,
        id: null,
        requiresChooser: true,
        reason: "No favorite playlist configured",
      };
    }
    return { type: DestinationType.FAVORITE, id: favId, requiresChooser: false };
  }
  if (defaultMode === "latest") {
    return { type: DestinationType.LATEST, id: null, requiresChooser: false };
  }
  if (defaultMode === "create") {
    return { type: DestinationType.NEW_LOCAL, id: null, requiresChooser: false };
  }
  // custom - would need a saved playlist ID, which we don't have in settings alone
  return {
    type: DestinationType.CUSTOM,
    id: null,
    requiresChooser: true,
    reason: "No default playlist selected",
  };
}

/**
 * Prepare a playlist object for saving based on destination.
 * @param {Object} params
 * @param {string[]} params.videoIds - Unique video IDs to add
 * @param {string} params.destinationType - Resolved destination type
 * @param {string} [params.destinationId] - Resolved destination ID
 * @param {string} params.insertPosition - "top" | "bottom"
 * @param {Playlist} [params.existingPlaylist] - Existing playlist object (for CUSTOM/FAVORITE/LATEST)
 * @param {string[]} [params.existingBuilder] - Existing builder video IDs
 * @returns {{ playlist: Playlist; isNew: boolean; destinationType: string; destinationId: string }}
 */
export function preparePlaylistForSave({
  videoIds,
  destinationType,
  destinationId,
  insertPosition,
  existingPlaylist,
  existingBuilder = [],
}) {
  const position = insertPosition || InsertPosition.BOTTOM;

  switch (destinationType) {
    case DestinationType.BUILDER: {
      const updatedBuilder =
        position === InsertPosition.TOP
          ? [...videoIds, ...existingBuilder]
          : [...existingBuilder, ...videoIds];
      return {
        playlist: {
          id: "yphPlaylistBuilder",
          title: "Playlist Builder",
          videos: updatedBuilder,
          timestamp: Date.now(),
        },
        isNew: false,
        destinationType: DestinationType.BUILDER,
        destinationId: "yphPlaylistBuilder",
      };
    }

    case DestinationType.NEW_LOCAL: {
      const newId = "local-" + Date.now();
      return {
        playlist: {
          id: newId,
          title: `Playlist (${new Date().toLocaleDateString()})`,
          videos: videoIds,
          timestamp: Date.now(),
          isLocal: true,
          saved: true,
        },
        isNew: true,
        destinationType: DestinationType.NEW_LOCAL,
        destinationId: newId,
      };
    }

    case DestinationType.FAVORITE:
    case DestinationType.LATEST:
    case DestinationType.CUSTOM: {
      if (!existingPlaylist) {
        throw new Error(`Destination playlist not found for type ${destinationType}`);
      }
      const updatedVideos =
        position === InsertPosition.TOP
          ? [...videoIds, ...existingPlaylist.videos]
          : [...existingPlaylist.videos, ...videoIds];
      return {
        playlist: { ...existingPlaylist, videos: updatedVideos, timestamp: Date.now() },
        isNew: false,
        destinationType,
        destinationId: existingPlaylist.id,
      };
    }

    default:
      throw new Error(`Unknown destination type: ${destinationType}`);
  }
}

/**
 * Validate video IDs array.
 * @param {string[]} videoIds
 * @returns {{ valid: boolean; error?: string }}
 */
export function validateVideoIds(videoIds) {
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return { valid: false, error: "No video IDs provided" };
  }
  for (const id of videoIds) {
    if (typeof id !== "string" || !/^[\w-]{11}$/.test(id)) {
      return { valid: false, error: `Invalid video ID format: ${id}` };
    }
  }
  return { valid: true };
}

/**
 * Filter and validate video IDs from raw input (tabs or links).
 * @param {Tab[]} tabs
 * @param {string[]} [existingVideoIds=[]]
 * @returns {{ videoIds: string[]; duplicateCount: number; invalidCount: number }}
 */
export function collectValidVideoIds(tabs, existingVideoIds = []) {
  const validIds = [];
  const seen = new Set(existingVideoIds);
  let duplicateCount = 0;
  let invalidCount = 0;

  for (const tab of tabs) {
    const { videoId, isVideo } = getYouTubeVideoInfo(tab);
    if (isVideo && videoId) {
      if (seen.has(videoId)) {
        duplicateCount++;
      } else {
        seen.add(videoId);
        validIds.push(videoId);
      }
    } else {
      invalidCount++;
    }
  }

  return { videoIds: validIds, duplicateCount, invalidCount };
}

/**
 * Collect video IDs from a link URL (for link context menu).
 * @param {string} linkUrl
 * @returns {string | null}
 */
export function collectVideoIdFromLink(linkUrl) {
  return parseYouTubeVideoId(linkUrl);
}

/**
 * Collect playlist ID from a link URL (for playlist context menu).
 * @param {string} linkUrl
 * @returns {string | null}
 */
export function collectPlaylistIdFromLink(linkUrl) {
  return parseYouTubePlaylistId(linkUrl);
}

/**
 * Default settings for quick-add (used when settings unavailable).
 * @returns {QuickAddSettings}
 */
export function getDefaultQuickAddSettings() {
  return {
    defaultQuickAddTarget: "create",
    defaultTabScope: "all-this-window-include",
    addToLatestPosition: "bottom",
    openPlaylistBuilderAfterAdd: true,
    openSavedPlaylistAfterAdd: true,
    closeAddedTabs: false, // Menu default: keep tabs open
    disableContextBuilder: false,
    disableContextSaved: false,
    watchLaterPlaylistId: null,
  };
}

export default {
  DestinationType,
  InsertPosition,
  resolveDestination,
  preparePlaylistForSave,
  validateVideoIds,
  collectValidVideoIds,
  collectVideoIdFromLink,
  collectPlaylistIdFromLink,
  getDefaultQuickAddSettings,
  deduplicateVideoIds,
  extractUniqueVideoIds,
};
