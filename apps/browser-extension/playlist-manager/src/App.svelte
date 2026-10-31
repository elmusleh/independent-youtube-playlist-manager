<script>
  import Router, { push } from "svelte-spa-router";
  import Header from "./components/Header.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import PlaylistEditor from "./components/PlaylistEditor.svelte";
  import { wrap } from "svelte-spa-router/wrap";
  import New from "./views/New.svelte";
  import Builder from "./views/Builder.svelte";
  import Saved from "./views/Saved.svelte";
  import Share from "./views/Share.svelte";
  import Settings from "./views/Settings.svelte";
  import DeveloperSetup from "./views/DeveloperSetup.svelte";
  import Logs from "./views/Logs.svelte";
  import Manage from "./views/Manage.svelte";
  import History from "./views/History.svelte";
  import FavoritePlaylist from "./views/FavoritePlaylist.svelte";
  import PlaylistView from "./views/PlaylistView.svelte";
  import Shortcuts from "./views/Shortcuts.svelte";
  import Subscriptions from "./views/Subscriptions.svelte";
  import Search from "./views/Search.svelte";
  import OpenById from "./views/OpenById.svelte";
  import MetadataManager from "./views/MetadataManager.svelte";
  import ConfirmationModal from "./components/ConfirmationModal.svelte";
  import ToastContainer from "./components/ToastContainer.svelte";
  import "./stores/shortcuts";
  import { logger } from "./services/logger";

  const browser = window.browser || window.chrome;

  // Handle resume-sync messages from background script
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.cmd === "resume-sync") {
      handleResumeSync(request.localPlaylistId, request.alarmName)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ error: error.message }));
      return true; // Keep channel open for async response
    }
  });

  async function handleResumeSync(localPlaylistId, alarmName) {
    try {
      // Check if signed in
      const signedIn = await window.isSignedIn();
      if (!signedIn) {
        return { error: "not_signed_in" };
      }

      // Check auto-retry setting
      const settings = await window.getSettings();
      if (!settings.autoRetryEnabled) {
        return { error: "auto_retry_disabled" };
      }

      // Get sync state
      const syncState = await window.getSyncState(localPlaylistId);
      if (!syncState || syncState.remainingVideoIds.length === 0) {
        return { error: "no_sync_state" };
      }

      // Get the playlist
      const playlist = await window.getPlaylist(localPlaylistId);
      if (!playlist) {
        await window.clearSyncState(localPlaylistId);
        return { error: "playlist_not_found" };
      }

      // Perform the sync
      await window.savePlaylist(playlist, {
        syncToYoutube: true,
        resumeFromState: syncState,
      });

      // Check if complete
      const isComplete = await window.isSyncComplete(localPlaylistId);
      if (isComplete) {
        await browser.alarms.clear(alarmName);
        window.success(`Playlist "${playlist.title}" fully synced to YouTube!`);
        return { success: true, complete: true };
      } else {
        // Still pending - will be rescheduled by storage-service
        return { success: true, complete: false };
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.error("Resume sync failed:", e);
      return { error: errorMsg };
    }
  }

  // Helper function to redirect legacy /editor URLs to /playlist preserving params
  function handleEditorRedirect(event) {
    const hash = location.hash;
    if (hash.startsWith("#/editor")) {
      // Transform #/editor?id=xxx to #/playlist?id=xxx
      const newHash = hash.replace("#/editor", "#/playlist");
      event.preventDefault();
      location.hash = newHash;
    }
  }

  const routes = {
    "/capture": wrap({ asyncComponent: () => import("./views/Capture.svelte") }),
    "/new": New,
    "/playlist-builder": Builder,
    "/saved": Saved,
    "/favorite": FavoritePlaylist,
    "/playlist": PlaylistView,
    "/editor": PlaylistView,
    "/share": Share,
    "/settings": Settings,
    "/shortcuts": Shortcuts,
    "/api-setup": DeveloperSetup,
    "/logs": Logs,
    "/manage": Manage,
    "/history": History,
    "/subscriptions": Subscriptions,
    "/search": Search,
    "/open-by-id": OpenById,
    "/metadata": MetadataManager,
    "/*": Saved,
  };

  let mobileMenuOpen = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  function handleLayoutChange(event) {
    if (!event.matches) closeMobileMenu();
  }
  const mobileLayout = window.matchMedia("(max-width: 768px)");
  mobileLayout.addEventListener("change", handleLayoutChange);

  import { onDestroy } from "svelte";
  onDestroy(() => {
    mobileLayout.removeEventListener("change", handleLayoutChange);
  });
</script>

<svelte:window on:hashchange={handleEditorRedirect} />

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<div id="app">
  <Header isMenuOpen={mobileMenuOpen} onToggleMenu={toggleMobileMenu} />
  <div class="content-wrapper">
    <Sidebar drawerOpen={mobileMenuOpen} onClose={closeMobileMenu} />
    <div class="router-outlet">
      <Router {routes} />
    </div>
  </div>
  <ConfirmationModal />
  <ToastContainer />
</div>

<style>
  :global(html),
  :global(body) {
    width: 100%;
    margin: 0;
    padding: 0;
    scrollbar-gutter: stable;
    background-color: var(--background-color);
  }

  :global(*) {
    box-sizing: border-box;
  }

  :global(img),
  :global(video) {
    max-width: 100%;
    height: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(*) {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }

  #app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    max-width: 100%;
  }

  .content-wrapper {
    display: flex;
    flex: 1;
    position: relative;
    padding-top: var(--app-header-height);
  }

  /* Fixed sidebar for desktop */
  :global(.sidenav) {
    width: 240px;
    height: calc(100vh - var(--app-header-height));
    height: calc(100dvh - var(--app-header-height));
    position: fixed;
    top: var(--app-header-height);
    left: 0;
    flex-shrink: 0;
    overflow-y: auto;
  }

  .router-outlet {
    flex: 1;
    min-width: 0;
    background-color: var(--background-color);
    display: flex;
    flex-direction: column;
    margin-left: 240px; /* Account for fixed sidebar on desktop */
  }

  :global(.view-body) {
    min-height: clamp(100px, 15vh, 250px);
  }

  @media (max-width: 768px) {
    .content-wrapper {
      flex-direction: column;
    }

    :global(.sidenav) {
      display: none; /* Hide fixed sidebar on mobile; drawer is inside Sidebar component */
    }

    .router-outlet {
      flex: 1;
      width: 100%;
      margin-left: 0; /* Reset margin for mobile */
      margin-top: 0; /* No horizontal sidebar offset */
    }
  }

  /* Improved tablet layout (769px - 1023px) */
  @media (min-width: 769px) and (max-width: 1023px) {
    :global(.sidenav) {
      width: 220px;
    }
    .router-outlet {
      margin-left: 220px;
    }
  }

  /* Large desktop (1440px+) - wider sidebar for more content */
  @media (min-width: 1440px) {
    :global(.sidenav) {
      width: 280px;
    }
    .router-outlet {
      margin-left: 280px;
    }
  }
</style>
