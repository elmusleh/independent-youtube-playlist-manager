/* OneTab-style native menu for YouTube tabs and links. */
import {
  isAndroid,
  playlistBuilderId,
  playlistBuilderPageId,
  addVideoToPlaylistId,
  addVideoToPlaylistPageId,
  idSep,
  addVideoToPlaylistItemPrefix,
  addVideoToPlaylistPageItemPrefix,
  handleError,
  updateBadge,
} from "./utils.js";
import { runTabCapture, scopes, targets, videoIdFromMenu } from "./context-menu-actions.js";
const rootId = "yphContextRoot";
const captureId = "yphContextCapture";
const scopeId = (scope, target) => `${captureId}${idSep}${scope}${idSep}${target}`;

export async function buildContextMenus(settings) {
  const start = Date.now();
  try {
    if (isAndroid()) return;
    browser.contextMenus.create({
      id: rootId,
      title: "Playlist Manager",
      contexts: ["page", "link", "video"],
    });
    browser.contextMenus.create({
      id: captureId,
      parentId: rootId,
      title: "Add tabs to…",
      contexts: ["page", "link", "video"],
    });
    for (const [target, title] of targets) {
      const targetId = `${captureId}${idSep}target${idSep}${target}`;
      browser.contextMenus.create({
        id: targetId,
        parentId: captureId,
        title,
        contexts: ["page", "link", "video"],
      });
      for (const [scope, scopeTitle] of scopes)
        browser.contextMenus.create({
          id: scopeId(scope, target),
          parentId: targetId,
          title: scopeTitle,
          contexts: ["page", "link", "video"],
        });
    }
    if (!settings.disableContextBuilder) {
      browser.contextMenus.create({
        id: playlistBuilderId,
        parentId: rootId,
        title: "Add video to Playlist Builder",
        contexts: ["link", "video"],
      });
      browser.contextMenus.create({
        id: playlistBuilderPageId,
        parentId: rootId,
        title: "Add video to Playlist Builder",
        contexts: ["page"],
      });
    }
    if (!settings.disableContextSaved) {
      browser.contextMenus.create({
        id: addVideoToPlaylistId,
        parentId: rootId,
        title: "Add video to saved playlist…",
        contexts: ["link", "video"],
      });
      browser.contextMenus.create({
        id: addVideoToPlaylistPageId,
        parentId: rootId,
        title: "Add video to saved playlist…",
        contexts: ["page"],
      });
      await buildAddVideoToPlaylistItems();
    }
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent)
      window.logSystemEvent("PERF", `buildContextMenus took ${duration}ms`);
  }
}
async function buildAddVideoToPlaylistItems() {
  for (const playlist of await window.getPlaylists()) {
    browser.contextMenus.create({
      id: `${addVideoToPlaylistItemPrefix}${playlist.id}`,
      title: playlist.title,
      parentId: addVideoToPlaylistId,
    });
    browser.contextMenus.create({
      id: `${addVideoToPlaylistPageItemPrefix}${playlist.id}`,
      title: playlist.title,
      parentId: addVideoToPlaylistPageId,
    });
  }
}
if (!isAndroid())
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const clicked = String(info.menuItemId);
    try {
      const match = clicked.match(new RegExp(`^${captureId}#([^#]+)#([^#]+)$`));
      if (match && match[1] !== "target") return await runTabCapture(match[1], match[2], tab);
      if (clicked === playlistBuilderId || clicked === playlistBuilderPageId)
        return await addVideoToBuilder(info, tab);
      if (
        clicked.startsWith(addVideoToPlaylistItemPrefix) ||
        clicked.startsWith(addVideoToPlaylistPageItemPrefix)
      )
        return await addVideoToPlaylist(info, clicked, tab);
    } catch (error) {
      handleError(error);
    }
  });
async function addVideoToBuilder(info, tab) {
  const videoId = videoIdFromMenu(info, tab);
  if (!videoId) throw new Error("This is not a YouTube video link.");
  const stored = await browser.storage.local.get(playlistBuilderId);
  const current = stored[playlistBuilderId] || [];
  if (!current.includes(videoId)) current.push(videoId);
  await browser.storage.local.set({ [playlistBuilderId]: current });
  updateBadge(String(current.length));
}
async function addVideoToPlaylist(info, clickedMenuId, tab) {
  const videoId = videoIdFromMenu(info, tab);
  if (!videoId) throw new Error("This is not a YouTube video link.");
  const playlistId = clickedMenuId.split(idSep)[1];
  const playlist = await window.getPlaylist(playlistId);
  if (!playlist)
    throw new Error("That playlist is no longer available. Reopen the menu to refresh it.");
  if (!playlist.videos.includes(videoId)) playlist.videos.push(videoId);
  await window.savePlaylist(playlist, { syncToYoutube: false });
}
