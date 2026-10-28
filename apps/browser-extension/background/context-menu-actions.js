/* Native menu actions shared by Chromium and Firefox desktop. */
import { playlistBuilderId, updateBadge, alert } from "./utils.js";
import { tabsForScope, youtubeTabs, parseYouTubeVideoId } from "../shared/tab-selection.js";

export const scopes = [
  ["current", "This video"],
  ["selected", "Selected tabs"],
  ["left", "Tabs to the left"],
  ["right", "Tabs to the right"],
  ["window", "All tabs in this window"],
  ["other", "All other tabs in this window"],
  ["all", "All tabs in all windows"],
];
export const targets = [
  ["builder", "Playlist Builder"],
  ["favorite", "Favorite"],
  ["latest", "Latest playlist"],
  ["new", "New local playlist"],
];

async function selectedVideos(scope, anchor) {
  const tabs = await browser.tabs.query(scope === "all" ? {} : { windowId: anchor?.windowId });
  return youtubeTabs(tabsForScope(scope, anchor, tabs));
}

async function saveLocalPlaylist(title, videos) {
  const playlist = {
    id: `local-${Date.now()}`,
    title,
    videos,
    timestamp: Date.now(),
    saved: true,
    isLocal: true,
  };
  await window.savePlaylist(playlist, { syncToYoutube: false });
  return playlist;
}

async function addToPlaylist(playlist, videos) {
  const ids = videos.map((video) => video.id);
  const existing = new Set(playlist.videos || []);
  const added = ids.filter((id) => !existing.has(id));
  if (!added.length) return 0;
  playlist.videos = [...(playlist.videos || []), ...added];
  await window.savePlaylist(playlist, { syncToYoutube: false });
  return added.length;
}

export async function runTabCapture(scope, target, anchor) {
  const videos = await selectedVideos(scope, anchor);
  if (!videos.length) throw new Error("No YouTube videos were found in the selected tabs.");
  if (target === "builder") {
    const stored = await browser.storage.local.get(playlistBuilderId);
    const current = stored[playlistBuilderId] || [];
    const known = new Set(current);
    const added = videos.map((video) => video.id).filter((id) => !known.has(id));
    await browser.storage.local.set({ [playlistBuilderId]: [...current, ...added] });
    updateBadge(String(current.length + added.length));
    await alert(
      `Added ${added.length} video${added.length === 1 ? "" : "s"} to Playlist Builder.`,
      true
    );
    return;
  }
  const playlists = await window.getPlaylists();
  let playlist;
  if (target === "new")
    playlist = await saveLocalPlaylist(
      "New playlist",
      videos.map((video) => video.id)
    );
  else if (target === "favorite")
    playlist = await window.getPlaylist((await window.ensureWatchLaterPlaylist()).id);
  else
    playlist = playlists
      .filter((item) => item.id?.startsWith("local-"))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
  if (!playlist)
    throw new Error("Create or select a local playlist first, then use the popup to add tabs.");
  const added = target === "new" ? videos.length : await addToPlaylist(playlist, videos);
  await alert(`Added ${added} video${added === 1 ? "" : "s"} to “${playlist.title}”.`, true);
}

export function videoIdFromMenu(info, tab) {
  return parseYouTubeVideoId(info.linkUrl || info.srcUrl || info.pageUrl || tab?.url);
}
