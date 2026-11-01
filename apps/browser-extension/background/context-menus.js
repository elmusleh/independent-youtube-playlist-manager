import { isAndroid, alert } from "./utils.js";
import { menuModel, staleMenuIds, ROOT, SCOPES } from "./context-menu-model.js";
import { cachedDestinations, requireDestinationEnabled } from "../shared/quick-add.js";
import { startCapture, scanPage, openCapture } from "./capture-controller.js";
import { createJob } from "./capture-jobs.js";
import { clickContext, linkCaptureVideoId } from "../shared/link-capture.js";
let reconciliation = Promise.resolve();
let generation = 0;
const lastModel = new Map();
let migrated = false;
async function createMenu(item) {
  // Both engines report create failures through runtime.lastError in the callback.
  await new Promise((resolve, reject) => {
    browser.contextMenus.create(item, () => {
      const error = browser.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}
async function reconcile(settings) {
  if (isAndroid() || !browser.contextMenus) return;
  // Remove only known obsolete entries from the previous multiplied menu model.
  if (!migrated)
    for (const legacy of [
      "yphContextCapture",
      "yphPlaylistBuilder",
      "yphPlaylistBuilderPage",
      "yphAddVideoToPlaylist",
      "yphAddVideoToPlaylistPage",
    ]) {
      try {
        await browser.contextMenus.remove(legacy);
      } catch {
        /* Absent after migration. */
      }
    }
  migrated = true;
  const desired = menuModel(settings, await cachedDestinations());
  if (!desired.length) {
    try {
      await browser.contextMenus.remove(ROOT);
    } catch {
      /* Already absent. */
    }
    lastModel.clear();
    if ((await rememberedMenuIds()).length) await rememberMenuIds([]);
    return;
  }
  for (const item of desired) {
    const { id, ...properties } = item;
    // `type` is fixed at creation; update() rejects it.
    delete properties.type;
    const signature = JSON.stringify(item);
    if (lastModel.get(id) === signature) continue;
    try {
      await browser.contextMenus.update(id, properties);
    } catch {
      await createMenu(item);
    }
    lastModel.set(id, signature);
  }
  // Anything the current model no longer contains (disabled group, stale scope)
  // is removed instead of being rebuilt wholesale. Menus survive service-worker
  // restarts, so the owned ids are persisted and not just kept in memory.
  const remembered = await rememberedMenuIds();
  const previous = new Set([...lastModel.keys(), ...remembered]);
  for (const id of staleMenuIds(desired, [...previous])) {
    try {
      await browser.contextMenus.remove(id);
    } catch {
      /* Already absent. */
    }
    lastModel.delete(id);
  }
  // Only persist on real change: Firefox refreshes on every menu open.
  const owned = desired.map((item) => item.id);
  if (remembered.length !== owned.length || remembered.some((id, index) => id !== owned[index]))
    await rememberMenuIds(owned);
}
const MENU_IDS_KEY = "yph_context_menu_ids";
async function rememberedMenuIds() {
  try {
    return (await browser.storage.local.get(MENU_IDS_KEY))[MENU_IDS_KEY] || [];
  } catch {
    return [];
  }
}
/** @param {string[]} ids */
async function rememberMenuIds(ids) {
  try {
    await browser.storage.local.set({ [MENU_IDS_KEY]: ids });
  } catch {
    /* Menu removal falls back to the in-memory model. */
  }
}
export function buildContextMenus(settings) {
  const next = reconciliation.then(async () => reconcile((await window.getSettings()) || settings));
  reconciliation = next.catch(() => {});
  return next;
}
async function showError(error) {
  await alert(error instanceof Error ? error.message : String(error));
}
async function dispatch(info, tab) {
  const id = String(info.menuItemId);
  if (!id.startsWith("yph:")) return;
  if (id === "yph:saved" || id === "yph:settings") {
    await browser.tabs.create({
      url: browser.runtime.getURL(
        `/editor/index.html#/${id === "yph:saved" ? "saved" : "settings"}`
      ),
    });
    return;
  }
  if (tab?.incognito) throw new Error("Capturing from private windows is disabled.");
  const settings = await window.getSettings();
  if (settings.disableContextMenu) throw new Error("The context menu is disabled.");
  if (id.startsWith("yph:scope:")) {
    const scope = id.slice("yph:scope:".length);
    if (!SCOPES.some(([value]) => value === scope)) throw new Error("Invalid tab scope.");
    const result = await startCapture({ scope, anchor: tab });
    if (!result.review)
      await alert(`Saved ${result.added} video(s); ${result.duplicates} already present.`, true);
  } else if (id.startsWith("yph:destination:")) {
    const destination = id.slice("yph:destination:".length);
    if (!["favorite", "latest", "builder", "new", "choose"].includes(destination))
      throw new Error("Unknown destination.");
    requireDestinationEnabled(destination, settings, "menu");
    if (destination === "choose") {
      await openCapture(
        await createJob({ operation: "destination", source: "menu", ids: [], tabs: [] })
      );
    } else {
      await window.storeObject("contextMenuDestination", destination);
      await buildContextMenus(await window.getSettings());
    }
  } else if (id === "yph:link") {
    const videoId = linkCaptureVideoId(clickContext(info), info, tab?.url);
    if (!videoId) throw new Error("This is not a YouTube video link.");
    await startCapture({ ids: [videoId], anchor: tab });
  } else if (id === "yph:import" || id === "yph:save-playlist") {
    requireDestinationEnabled("new", settings, "menu");
    if (id === "yph:save-playlist") {
      const source = new URL(info.pageUrl || tab.url);
      const playlistId = source.searchParams.get("list");
      if (
        !/^https?:$/.test(source.protocol) ||
        !(source.hostname === "youtube.com" || source.hostname.endsWith(".youtube.com")) ||
        !playlistId ||
        !/^[\w-]{10,100}$/.test(playlistId)
      )
        throw new Error("Open a YouTube playlist page to save its videos.");
      // A read-only public extractor; saving still goes through the same review page.
      const result = await browser.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        files: ["/content-scripts/injectors/get-playlist-video-ids.js"],
      });
      const current = await browser.tabs.get(tab.id);
      if (current.url !== tab.url || current.windowId !== tab.windowId)
        throw new Error("The playlist page changed. Open the menu again.");
      const ids = result[0]?.result?.map((item) => (typeof item === "string" ? item : item.id));
      if (!Array.isArray(ids) || !ids.length)
        throw new Error("No videos found. Open the playlist page and try again.");
      await openCapture(
        await createJob({
          operation: "capture",
          source: "menu",
          mode: "new",
          ids,
          tabs: [],
          position: "bottom",
          closeTabs: false,
        })
      );
    } else await scanPage(tab);
  }
}
if (!isAndroid() && browser.contextMenus) {
  browser.contextMenus.onClicked.addListener((info, tab) => {
    dispatch(info, tab).catch(showError);
  });
  browser.storage.onChanged.addListener((_changes, area) => {
    if (area !== "local" && area !== "sync") return;
    // Capture checkpoints/metadata do not affect menu labels.
    if (
      !Object.keys(_changes).some((key) =>
        [
          "yph_local_playlists",
          "yt_playlist_cache_v1",
          "contextMenuDestination",
          "watchLaterPlaylistId",
          "defaultQuickAddTarget",
          "disableContextMenu",
          "disableContextSaved",
          "disableContextBuilder",
        ].includes(key)
      )
    )
      return;
    window.getSettings().then(buildContextMenus).catch(showError);
  });
  browser.contextMenus.onShown?.addListener(async () => {
    const current = ++generation;
    try {
      await buildContextMenus(await window.getSettings());
      if (current === generation) await browser.contextMenus.refresh?.();
    } catch (error) {
      await showError(error);
    }
  });
}
