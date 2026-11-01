import { resolveDestination, destinationMode } from "../shared/quick-add.js";
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
  ["favorite", "Favorite playlist", "saved"],
  ["latest", "Latest playlist", "saved"],
  ["builder", "Playlist Builder", "builder"],
  ["new", "New local playlist", "saved"],
  ["choose", "Choose saved playlist…", "saved"],
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
  const builderAllowed = !settings.disableContextBuilder;
  const anyAllowed = savedAllowed || builderAllowed;
  const mode = destinationMode(settings);
  // Label the menu with the destination the next action will really use.
  const effectiveMode =
    mode === "builder" && !builderAllowed ? "latest" : savedAllowed ? mode : "builder";
  const selected = resolveDestination(effectiveMode, settings, destinations);
  const label = (selected?.title || "Choose playlist").slice(0, 60);
  const items = [{ id: ROOT, title: "Playlist Manager", contexts }];
  const item = (id, title, extra = {}) =>
    items.push({ id: `yph:${id}`, parentId: ROOT, title, contexts, ...extra });
  const separator = (id) =>
    items.push({ id: `yph:${id}`, parentId: ROOT, type: "separator", contexts });
  if (savedAllowed) item("saved", "My Playlists");
  if (savedAllowed && anyAllowed) separator("sep-saved");
  if (anyAllowed) {
    item("scopes", `Add YouTube tabs to ${label}`);
    for (const [scope, title] of SCOPES)
      items.push({ id: `yph:scope:${scope}`, parentId: "yph:scopes", title, contexts });
    item("link", `Add this YouTube link to ${label}`, {
      contexts: ["link", "video"],
      targetUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"],
    });
    item("destination", "Destination");
    for (const [id, title, family] of TARGETS) {
      if (family === "builder" ? !builderAllowed : !savedAllowed) continue;
      items.push({ id: `yph:destination:${id}`, parentId: "yph:destination", title, contexts });
    }
  }
  if (anyAllowed && savedAllowed) separator("sep-actions");
  if (savedAllowed) {
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
