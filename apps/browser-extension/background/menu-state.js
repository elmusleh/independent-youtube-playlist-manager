/**
 * Menu state — settings and playlists caching for context menu.
 */

import { getDefaultQuickAddSettings } from "../shared/quick-add.js";
import {
  resolveDestination,
  DestinationType,
  effectiveDestinationMode,
} from "../shared/quick-add.js";

let _cachedSettings = null;
let _cachedPlaylists = null;

/**
 * Get current settings (with caching).
 * @returns {Promise<Object>}
 */
export async function getSettings() {
  if (!_cachedSettings && window.getSettings) {
    _cachedSettings = await window.getSettings();
  }
  return _cachedSettings || getDefaultQuickAddSettings();
}

/**
 * Invalidate settings cache.
 */
export function invalidateSettingsCache() {
  _cachedSettings = null;
}

/**
 * Get playlists (with caching).
 * @returns {Promise<Array>}
 */
export async function getPlaylists() {
  if (!_cachedPlaylists && window.getPlaylists) {
    _cachedPlaylists = await window.getPlaylists();
  }
  return _cachedPlaylists || [];
}

/**
 * Invalidate playlists cache.
 */
export function invalidatePlaylistsCache() {
  _cachedPlaylists = null;
}

/**
 * Check if builder destination is enabled.
 * @param {Object} settings
 * @returns {boolean}
 */
export function isBuilderEnabled(settings) {
  return !settings.disableContextBuilder;
}

/**
 * Check if saved playlists destination is enabled.
 * @param {Object} settings
 * @returns {boolean}
 */
export function isSavedEnabled(settings) {
  return !settings.disableContextSaved;
}

/**
 * Check if favorite playlist is configured.
 * @param {Object} settings
 * @returns {boolean}
 */
export function hasFavorite(settings) {
  return !!settings.watchLaterPlaylistId;
}

/**
 * Check if there are any saved playlists.
 * @returns {Promise<boolean>}
 */
export async function hasSavedPlaylists() {
  const playlists = await getPlaylists();
  return playlists.length > 0;
}

/**
 * Build the destination chooser submenu title with current destination.
 * @param {Object} settings
 * @returns {string}
 */
export function buildDestinationLabel(settings) {
  const destination = resolveDestination(effectiveDestinationMode(settings), settings, []);
  const typeLabels = {
    [DestinationType.FAVORITE]: "Favorite",
    [DestinationType.LATEST]: "Latest",
    [DestinationType.BUILDER]: "Builder",
    [DestinationType.NEW_LOCAL]: "New local",
    [DestinationType.CUSTOM]: "Custom",
  };
  const label = typeLabels[destination?.type] || "Destination";
  return `Destination: ${label}`;
}

/**
 * Build the scopes submenu title with current destination.
 * @param {Object} settings
 * @returns {string}
 */
export function buildScopesLabel(settings) {
  const destination = resolveDestination(effectiveDestinationMode(settings), settings, []);
  const typeLabels = {
    [DestinationType.FAVORITE]: "Favorite playlist",
    [DestinationType.LATEST]: "Latest playlist",
    [DestinationType.BUILDER]: "Playlist Builder",
    [DestinationType.NEW_LOCAL]: "New local playlist",
    [DestinationType.CUSTOM]: "Custom playlist",
  };
  const label = typeLabels[destination?.type] || "destination";
  return `Add YouTube tabs to ${label}`;
}

export default {
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
};
