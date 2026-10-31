export const scopeAliases = {
  "all-this-window-include": "window",
  "all-this-window-exclude": "other",
  "all-windows": "all",
};
export function destinationMode(settings, remembered = true) {
  return (
    (remembered && settings.contextMenuDestination) ||
    (settings.defaultQuickAddTarget === "create" ? "new" : settings.defaultQuickAddTarget) ||
    "latest"
  );
}
/** Local cache only: menu availability never depends on network or sign-in. */
export async function cachedDestinations() {
  const stored = await browser.storage.local.get(["yph_local_playlists", "yt_playlist_cache_v1"]);
  const local = stored.yph_local_playlists || [];
  const remote = stored.yt_playlist_cache_v1?.list?.data || [];
  const map = new Map();
  for (const playlist of [...remote, ...local]) {
    if (playlist && typeof playlist.id === "string" && typeof playlist.title === "string")
      map.set(playlist.id, playlist);
  }
  return [...map.values()];
}
export function resolveDestination(mode, settings, playlists) {
  if (mode === "builder" || mode === "new")
    return { id: mode, title: mode === "builder" ? "Playlist Builder" : "New local playlist" };
  if (mode === "favorite")
    return playlists.find((p) => p.id === settings.watchLaterPlaylistId) || null;
  if (mode === "latest")
    return [...playlists].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0] || null;
  return playlists.find((p) => p.id === mode) || null;
}
export function requireDestinationEnabled(destination, settings, source) {
  if (source !== "menu") return;
  if (settings.disableContextMenu) throw new Error("The context menu is disabled in Settings.");
  if (destination === "builder" ? settings.disableContextBuilder : settings.disableContextSaved)
    throw new Error("This destination is disabled in context-menu settings.");
}
