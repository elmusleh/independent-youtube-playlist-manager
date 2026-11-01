/**
 * The fixture page and the settings variants the native menu gate verifies.
 * Kept apart from the runner so the expectations are reviewable in one place.
 */
"use strict";

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>Native menu fixture</title></head>
<body style="font:16px system-ui;padding:40px">
<h1>Native menu fixture</h1>
<p id="p">Right-click this paragraph for the page context.</p>
<p><a id="link" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">A YouTube watch link</a></p>
</body></html>`;

const SCOPES = [
  "Only this video tab",
  "Selected tabs in this window",
  "Tabs to the left in this window",
  "Tabs to the right in this window",
  "All tabs in this window",
  "Other tabs in this window",
  "All tabs across normal windows",
];

/** Words that only ever appear inside the parent panel / the branded submenu; used to
 * locate the panel in a full-frame capture. */
const PARENT_PROBES = ["Back", "Reload", "Inspect", "Playlist", "Translate"];
const SUBMENU_PROBES = ["Playlists", "Destination", "YouTube", "Settings", "Builder"];

/** Every variant starts from an explicit base: `chrome.storage.sync.set({})` is a no-op,
 * so an untouched key from a previous variant would otherwise leak into the next one. */
const BASE_SETTINGS = {
  disableContextMenu: false,
  disableContextSaved: false,
  disableContextBuilder: false,
};

const VARIANTS = [
  {
    name: "default",
    settings: {},
    present: ["My Playlists", "Destination", "Import YouTube links", "Add YouTube tabs to"],
    absent: ["Playlist Builder"],
    target: "#p",
  },
  {
    name: "saved-off",
    settings: { disableContextSaved: true },
    present: ["Playlist Builder", "Destination"],
    absent: ["My Playlists", "Import YouTube links"],
    target: "#p",
  },
  {
    name: "builder-off",
    settings: { disableContextBuilder: true },
    present: ["My Playlists", "New local playlist"],
    absent: ["Playlist Builder"],
    target: "#p",
  },
  {
    name: "menu-off",
    settings: { disableContextMenu: true },
    present: [],
    absent: ["Playlist Manager"],
    target: "#p",
    topLevelOnly: true,
    parentProbes: ["Back", "Reload", "Inspect"],
  },
  {
    name: "link-context",
    settings: {},
    present: ["Add this YouTube link to"],
    absent: [],
    target: "#link",
  },
];

module.exports = {
  FIXTURE,
  SCOPES,
  PARENT_PROBES,
  SUBMENU_PROBES,
  BASE_SETTINGS,
  VARIANTS,
};
