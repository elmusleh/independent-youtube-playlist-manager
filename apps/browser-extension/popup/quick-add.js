/* eslint-disable no-console */
/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

import { getById, getErrorMessage, alert } from "./utils.js";
import { getActiveTab } from "./tabs.js";
import { state } from "./state.js";
import { scopeAliases } from "../shared/quick-add.js";

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

// ---------------------------------------------------------------------------
// Smart playlist naming
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<string>}
 */
export async function getSmartDefaultPlaylistName() {
  const dateStr = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  try {
    const activeTab = await getActiveTab();
    if (activeTab && activeTab.title) {
      let title = activeTab.title.trim();
      title = title.replace(/\s*[-–—]\s*YouTube$/i, "");
      title = title.replace(/^\(\d+\)\s*/, "");

      if (title) {
        if (title.length > 40) {
          title = title.substring(0, 37) + "...";
        }
        return `${title} (${dateStr})`;
      }
    }
  } catch (e) {
    console.warn("Failed to get smart playlist name:", e);
  }

  return `Playlist (${dateStr})`;
}

// The popup is a UI adapter. Capture, destination writes and closure live in the worker.
async function sendCapture(args) {
  const button = getById("btn-execute-add");
  if (button) button.disabled = true;
  try {
    const response = await browser.runtime.sendMessage({ cmd: "capture", action: "start", args });
    if (!response?.ok) throw new Error(response?.error || "Capture could not be started.");
    if (!response.result.review)
      await alert(
        `Saved ${response.result.added} video(s); ${response.result.duplicates} already present.`,
        true
      );
    window.close();
  } catch (error) {
    await alert(getErrorMessage(error));
  } finally {
    if (button) button.disabled = false;
  }
}
function mode() {
  return state.activeTargetMode === "create"
    ? "new"
    : state.activeTargetMode === "custom"
      ? state.selectedPlaylistId
      : state.activeTargetMode;
}
export async function addVideosToResolvedPlaylist(videoIds) {
  return sendCapture({ ids: videoIds, mode: mode() });
}
export async function executeQuickAddByScope(scope) {
  const tab = await getActiveTab();
  if (!tab || tab.incognito) return alert("Select a non-private webpage first.");
  const selectedScope = scopeAliases[scope] || scope;
  return sendCapture({
    ids: [],
    scope: selectedScope,
    anchorId: tab.id,
    anchorUrl: tab.url,
    mode: mode(),
  });
}
