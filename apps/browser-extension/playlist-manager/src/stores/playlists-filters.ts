import { writable } from "svelte/store";
import type { PlaylistsSorting } from "../types/model.js";

const playlistsSortingStorageKey = "playlistsSorting";
const defaultPlaylistsSorting: PlaylistsSorting = "date-created-desc";

export const playlistsSorting = writable<PlaylistsSorting>(defaultPlaylistsSorting);
export const playlistsSearch = writable("");
export const historySearch = writable("");
export const manageSearch = writable("");
export const editorSearch = writable("");

let isInitialized = false;

export function initPlaylistsFilters() {
  if (isInitialized) return;
  isInitialized = true;

  if (typeof window !== "undefined" && typeof window.fetchObject === "function") {
    window
      .fetchObject(playlistsSortingStorageKey, defaultPlaylistsSorting)
      .then((savedSorting: any) => {
        if (savedSorting) {
          playlistsSorting.set(savedSorting);
        }
        playlistsSorting.subscribe((sorting) => {
          if (typeof window.storeObject === "function") {
            window.storeObject(playlistsSortingStorageKey, sorting);
          }
        });
      })
      .catch(async (e) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("[PLAYLISTS-FILTERS] Failed to load sorting preference:", e);
        if (window.logSystemEvent) {
          await window.logSystemEvent(
            "ERROR",
            `[PLAYLISTS-FILTERS] Failed to load sorting preference: ${errMsg}`
          );
        }
      });
  }
}
