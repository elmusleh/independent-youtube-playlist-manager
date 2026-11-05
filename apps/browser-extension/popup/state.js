/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

/**
 * Shared mutable state for the popup. Kept in a single module so the
 * quick-add and main modules can read/write it without circular imports.
 *
 * @typedef {Object} PopupState
 * @property {any} videoService
 * @property {((url: string) => string | null) | null} parseYoutubeId
 * @property {"favorite" | "latest" | "custom" | "create"} activeTargetMode
 * @property {string | null} selectedPlaylistId
 * @property {boolean} targetUserSelected
 * @property {boolean} scopeUserSelected
 */

export const state = {
  videoService: null,
  parseYoutubeId: null,
  activeTargetMode: "latest",
  selectedPlaylistId: null,
  // True once the user explicitly picks a target/scope before hydration finishes,
  // so initTargetData()/loadDefaultTabScope() don't overwrite their choice.
  targetUserSelected: false,
  scopeUserSelected: false,
};
