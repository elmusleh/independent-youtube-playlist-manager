// Svelte 5 SSR bypass for browser extensions
// This must be at the very top before any Svelte code loads
if (typeof window !== "undefined") {
  (window as any).__svelte = (window as any).__svelte || {};
  (window as any).__svelte.v = (window as any).__svelte.v || new Set();
  (window as any).__svelte.v.add("5");
}

// 1. Synchronously import and register all background services onto window
import "./services/utils.js";
import "./services/youtube-auth.js";
import "./services/youtube-api.js";
import "./services/storage-service.js";
import "./services/sync-state-service.js";
import "./services/video-service.js";

import { mount } from "svelte";
import App from "./App.svelte";
import { initTheme } from "./stores/theme.store.js";
import { initPlaylistsFilters } from "./stores/playlists-filters.js";

try {
  initPlaylistsFilters();
  initTheme();

  if (typeof window !== "undefined" && !window.location.pathname.includes("popup")) {
    mount(App, {
      target: document.body,
    });
  }
} catch (e) {
  const errMsg = e instanceof Error ? e.message : String(e);
  console.error("[MAIN] Failed to mount application:", e);
  if (window.logSystemEvent) {
    window.logSystemEvent("ERROR", `[MAIN] Failed to mount application: ${errMsg}`);
  }
}

export default {};
