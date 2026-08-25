/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

import { getById, log, waitForGlobal } from "./utils.js";
import { state } from "./state.js";

/**
 * Update the target-selection UI (favorite/latest/custom/create buttons)
 * to reflect the current `state.activeTargetMode`.
 */
export function updateTargetUI() {
  getById("btn-target-fav").classList.toggle("active", state.activeTargetMode === "favorite");
  getById("btn-target-latest").classList.toggle("active", state.activeTargetMode === "latest");
  const select = getById("select-target-playlist");
  if (state.activeTargetMode === "custom") {
    select.classList.add("active");
  } else if (state.activeTargetMode === "create") {
    select.value = "__create_new__";
    select.classList.add("active");
  } else {
    select.value = "";
    select.classList.remove("active");
  }
}

/**
 * Populate the target-playlist dropdown and resolve the default target mode
 * from user settings.
 */
export async function initTargetData() {
  try {
    const getPlaylists = await waitForGlobal("getPlaylists", 10);

    if (!getPlaylists) {
      await log("WARN", "Popup: getPlaylists not available");
      return;
    }

    const playlists = await getPlaylists();
    const select = getById("select-target-playlist");

    // Sort by timestamp (newest first) - "My playlists" appears at top
    const sorted = [...playlists].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Show default playlist based on settings or default to latest
    const getSettings = await waitForGlobal("getSettings", 1);
    const settingsObj = getSettings ? await getSettings() : null;
    const defaultMode = settingsObj?.defaultQuickAddTarget || "latest";

    if (defaultMode === "create") {
      state.activeTargetMode = "create";
      state.selectedPlaylistId = null;
    } else if (defaultMode === "favorite") {
      state.activeTargetMode = "favorite";
      state.selectedPlaylistId = null;
    } else {
      state.activeTargetMode = "latest";
      state.selectedPlaylistId = null;
    }

    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "More...";
    select.appendChild(placeholder);
    const createNew = document.createElement("option");
    createNew.value = "__create_new__";
    createNew.textContent = "✚ Create new...";
    select.appendChild(createNew);
    sorted.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.title;
      select.appendChild(opt);
    });

    // Update UI to reflect the default selection
    updateTargetUI();
  } catch (e) {
    await log("ERROR", "Failed to init target data", e);
  }
}

/**
 * Load the saved default tab-scope preference into the dropdown.
 */
export async function loadDefaultTabScope() {
  try {
    const getSettings = await waitForGlobal("getSettings", 10);

    if (getSettings) {
      const settings = await getSettings();
      const defaultScope = settings.defaultTabScope || "all-this-window-include";
      getById("select-tab-scope").value = defaultScope;
    } else {
      getById("select-tab-scope").value = "all-this-window-include";
    }
  } catch {
    getById("select-tab-scope").value = "all-this-window-include";
  }
}
