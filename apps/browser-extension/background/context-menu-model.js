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
const contexts = ["page", "link", "image", "video", "frame", "selection"];
export function menuModel(settings, destinations) {
  if (settings.disableContextMenu) return [];
  const mode = destinationMode(settings);
  const selected = resolveDestination(mode, settings, destinations);
  const label = (selected?.title || "Choose playlist").slice(0, 60);
  const allowed =
    mode === "builder" ? !settings.disableContextBuilder : !settings.disableContextSaved;
  const items = [{ id: ROOT, title: "Playlist Manager", contexts }];
  const item = (id, title, extra = {}) =>
    items.push({ id: `yph:${id}`, parentId: ROOT, title, contexts, ...extra });
  item("saved", "My Playlists");
  item("scopes", `Add YouTube tabs to ${label}`, { enabled: allowed });
  for (const [scope, title] of SCOPES)
    items.push({
      id: `yph:scope:${scope}`,
      parentId: "yph:scopes",
      title,
      contexts,
      enabled: allowed,
    });
  item("link", `Add this YouTube link to ${label}`, {
    contexts: ["link", "video"],
    enabled: allowed,
    targetUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"],
  });
  item("destination", "Destination");
  const targets = [
    ["favorite", "Favorite playlist"],
    ["latest", "Latest playlist"],
    ["builder", "Playlist Builder"],
    ["new", "New local playlist"],
    ["choose", "Choose saved playlist…"],
  ];
  for (const [id, title] of targets) {
    if (id === "builder" ? settings.disableContextBuilder : settings.disableContextSaved) continue;
    items.push({ id: `yph:destination:${id}`, parentId: "yph:destination", title, contexts });
  }
  if (!settings.disableContextSaved)
    item("save-playlist", "Save this YouTube playlist…", {
      documentUrlPatterns: ["*://*.youtube.com/*"],
    });
  if (!settings.disableContextSaved)
    item("import", "Import YouTube links from this page…", {
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
  item("settings", "Settings");
  return items;
}
