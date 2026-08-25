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
 */

export const state = {
  videoService: null,
  parseYoutubeId: null,
  activeTargetMode: "latest",
  selectedPlaylistId: null,
};
