import { effectiveDestinationMode, resolveDestination } from "../shared/quick-add.js";
export const ROOT = "yphContextRoot";
export const SCOPES = [
  ["current", "Only this video tab"],
  ["selected", "Selected tabs in this window"],
  ["left", "Tabs to the left in this window"],
  ["right", "Tabs to the right in this window"],
  ["window", "All tabs in this window"],
  ["other", "Other tabs in this window"],
  ["all", "All tabs across normal windows"],
];
const TARGETS = [
  ["favorite", "Favorite playlist"],
  ["latest", "Latest playlist"],
  ["new", "Create new playlist"],
];
const contexts = ["page", "link", "image", "video", "frame", "selection"];

/** Ids created by a previous model that the current settings no longer want. */
export function staleMenuIds(desired, previousIds) {
  const keep = new Set(desired.map((item) => item.id));
  return [...previousIds].filter((id) => !keep.has(id));
}

/**
 * Bounded native menu: one entry per family, never one per saved playlist.
 * Disabled families are absent rather than greyed, and the scope label always
 * names a destination the user can actually reach.
 * @param {{disableContextMenu?: boolean, disableContextBuilder?: boolean,
 *   disableContextSaved?: boolean}} settings
 * @param {Array<{id: string, title: string, timestamp?: number}>} destinations
 */
export function menuModel(settings, destinations) {
  if (settings.disableContextMenu) return [];
  const savedAllowed = !settings.disableContextSaved;
  // Label the menu with the destination the next action will really use.
  const selected = resolveDestination(effectiveDestinationMode(settings), settings, destinations);
  const selectedDestId = selected?.id ?? null;
  const label = (selected?.title || "Choose playlist").slice(0, 60);
  const items = [{ id: ROOT, title: "IYPM", contexts }];
  const item = (id, title, extra = {}) =>
    items.push({ id: `yph:${id}`, parentId: ROOT, title, contexts, ...extra });
  const separator = (id) =>
    items.push({ id: `yph:${id}`, parentId: ROOT, type: "separator", contexts });
  if (savedAllowed) item("saved", "My Playlists");
  if (savedAllowed) {
    separator("sep-saved");
    // Each destination gets its own scope submenu
    for (const [destId, destTitle] of TARGETS) {
      const destItemId = `destination:${destId}`;
      item(destItemId, `Add YouTube tabs to ${destTitle}`);
      for (const [scope, title] of SCOPES)
        items.push({
          id: `yph:scope:${destId}:${scope}`,
          parentId: `yph:destination:${destId}`,
          title,
          contexts,
        });
    }
    item("link", "Add this YouTube link to selected destination", {
      contexts: ["link", "video"],
      targetUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"],
    });
    separator("sep-actions");
    item("save-playlist", "Save this YouTube playlist…", {
      documentUrlPatterns: ["*://*.youtube.com/*"],
    });
    item("import", "Import YouTube links from this page…", {
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
  }
  item("settings", "Settings");
  return items;
}
