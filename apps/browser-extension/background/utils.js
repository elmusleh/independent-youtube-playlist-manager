// ---------------------------------------------------------------------------
// Shared constants & detectors
// ---------------------------------------------------------------------------

/** Detect Firefox for Android (Fenix) */
export const isAndroid = () => /Android/i.test(navigator.userAgent);

export const playlistBuilderId = "yphPlaylistBuilder";
export const playlistBuilderPageId = "yphPlaylistBuilderPage";
export const addVideoToPlaylistId = "yphAddVideoToPlaylist";
export const addVideoToPlaylistPageId = "yphAddVideoToPlaylistPage";
export const idSep = "#";
export const addVideoToPlaylistItemPrefix = `${addVideoToPlaylistId}${idSep}`;
export const addVideoToPlaylistPageItemPrefix = `${addVideoToPlaylistPageId}${idSep}`;

export const HISTORY_KEY = "local_yt_history";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {Error} error
 */
export function handleError(error) {
  alert(error.message);
}

/**
 * @param {string} message
 * @param {boolean} [isInfo]
 */
// NOTE: This is intentionally duplicated in popup/utils.js with a different
// relative icon path. Background uses "assets/...", popup uses "../assets/...".
export async function alert(message, isInfo) {
  browser.notifications.create({
    type: "basic",
    title: "Playlist Manager" + (isInfo ? "" : ": Error"),
    message: message,
    ...(isAndroid() ? {} : { iconUrl: "assets/icons/icon_48.png" }),
  });
}

/**
 * Update the extension badge with the given text
 * @param {string} text - Text to display on badge (empty string to hide)
 */
export function updateBadge(text) {
  const actionApi = browser.action || browser.browserAction;
  if (actionApi && typeof actionApi.setBadgeText === "function") {
    actionApi.setBadgeText({ text: text || "" });
    if (text && typeof actionApi.setBadgeBackgroundColor === "function") {
      actionApi.setBadgeBackgroundColor({ color: "#FF0000" });
    }
  }
}
