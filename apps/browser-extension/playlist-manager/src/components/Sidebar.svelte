<script lang="ts">
  import {
    faListUl,
    faBoxArchive,
    faClockRotateLeft,
    faStar,
    faUsers,
    faClock,
    faLink,
    faSearch,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
  import { router } from "svelte-spa-router";
  import { onDestroy } from "svelte";
  import type { Settings } from "../types/model";

  const browser = (window as any).browser || (window as any).chrome;

  let settings: Settings | null = $state(null);
  let signedIn = $state(false);

  let { drawerOpen = false, onClose = () => {} }: { drawerOpen?: boolean; onClose?: () => void } =
    $props();

  function handleNavClick() {
    onClose();
  }

  async function loadSettings() {
    settings = await window.getSettings();
  }

  async function checkAuth() {
    signedIn = await window.isSignedIn();
  }

  loadSettings();
  checkAuth();

  const handleAuthChange = (e: any) => {
    signedIn = e.detail.isSignedIn;
  };

  window.addEventListener("yt-auth-changed", handleAuthChange);

  // Pass reactive values as arguments to ensure the function re-runs
  // whenever the location or querystring changes.
  function isActive(path: string, loc: string, qs: string, checkWL = false) {
    if (checkWL) {
      return loc === path && qs.includes("id=WL");
    }
    if (path === "/editor" && qs.includes("id=WL")) {
      return false;
    }
    // Treat root "/" as "/saved" for All Playlists
    if (path === "/saved") {
      return loc === "" || loc === "/" || loc === "/saved" || loc === "/saved/";
    }
    return loc === path || loc === path + "/";
  }

  function handleStorageChange(
    changes: Record<string, { oldValue?: any; newValue?: any }>,
    area: string
  ) {
    if (area === "sync") {
      loadSettings();
    }

    if (area === "local" && "yt_auth_token_cache" in changes) {
      checkAuth();
    }
  }

  browser.storage.onChanged.addListener(handleStorageChange);
  onDestroy(() => {
    browser.storage.onChanged.removeListener(handleStorageChange);
    window.removeEventListener("yt-auth-changed", handleAuthChange);
  });
</script>

<!-- Desktop sidebar -->
<div class="sidenav desktop-sidenav">
  <div class="top-nav">
    <div class="nav-group">
      <a
        href="#/saved"
        class:active={isActive("/saved", router.location, router.querystring || "")}
      >
        <Fa icon={faListUl} fw />
        <span>All Playlists</span>
      </a>
      <a
        href="#/favorite"
        class:active={isActive("/favorite", router.location, router.querystring || "")}
      >
        <Fa icon={faStar} fw />
        <span>Favorite Playlist</span>
      </a>
      <a
        href="#/history"
        class:active={isActive("/history", router.location, router.querystring || "")}
      >
        <Fa icon={faClockRotateLeft} fw />
        <span>Watch History</span>
      </a>
      <a
        href="#/manage"
        class:active={isActive("/manage", router.location, router.querystring || "")}
      >
        <Fa icon={faBoxArchive} fw />
        <span>Manage Playlists</span>
      </a>

      {#if signedIn && settings && (settings.enableSubscriptions || settings.enableSearch || settings.enableWatchLater || settings.enableOpenById)}
        <hr class="nav-divider" />

        {#if settings.enableSubscriptions}
          <a
            href="#/subscriptions"
            class:active={isActive("/subscriptions", router.location, router.querystring || "")}
          >
            <Fa icon={faUsers} fw />
            <span>Subscriptions</span>
          </a>
        {/if}

        {#if settings.enableSearch}
          <a
            href="#/search"
            class:active={isActive("/search", router.location, router.querystring || "")}
          >
            <Fa icon={faSearch} fw />
            <span>YouTube Search</span>
          </a>
        {/if}

        {#if settings.enableWatchLater}
          <a
            href="#/editor?id=WL"
            class:active={isActive("/editor", router.location, router.querystring || "", true)}
          >
            <Fa icon={faClock} fw />
            <span>Watch Later</span>
          </a>
        {/if}

        {#if settings.enableOpenById}
          <a
            href="#/open-by-id"
            class:active={isActive("/open-by-id", router.location, router.querystring || "")}
          >
            <Fa icon={faLink} fw />
            <span>Open by ID</span>
          </a>
        {/if}

        <hr class="nav-divider" />
      {/if}
    </div>
  </div>
</div>

<!-- Mobile drawer -->
{#if drawerOpen}
  <div class="mobile-drawer" class:open={drawerOpen}>
    <div class="drawer-header">
      <button class="drawer-close" onclick={() => onClose()} aria-label="Close navigation">
        <Fa icon={faXmark} size="lg" />
      </button>
    </div>
    <div class="drawer-nav">
      <div class="nav-group">
        <a
          href="#/saved"
          onclick={handleNavClick}
          class:active={isActive("/saved", router.location, router.querystring || "")}
        >
          <Fa icon={faListUl} fw />
          <span>All Playlists</span>
        </a>
        <a
          href="#/favorite"
          onclick={handleNavClick}
          class:active={isActive("/favorite", router.location, router.querystring || "")}
        >
          <Fa icon={faStar} fw />
          <span>Favorite Playlist</span>
        </a>
        <a
          href="#/history"
          onclick={handleNavClick}
          class:active={isActive("/history", router.location, router.querystring || "")}
        >
          <Fa icon={faClockRotateLeft} fw />
          <span>Watch History</span>
        </a>
        <a
          href="#/manage"
          onclick={handleNavClick}
          class:active={isActive("/manage", router.location, router.querystring || "")}
        >
          <Fa icon={faBoxArchive} fw />
          <span>Manage Playlists</span>
        </a>

        {#if signedIn && settings && (settings.enableSubscriptions || settings.enableSearch || settings.enableWatchLater || settings.enableOpenById)}
          <hr class="nav-divider" />

          {#if settings.enableSubscriptions}
            <a
              href="#/subscriptions"
              onclick={handleNavClick}
              class:active={isActive("/subscriptions", router.location, router.querystring || "")}
            >
              <Fa icon={faUsers} fw />
              <span>Subscriptions</span>
            </a>
          {/if}

          {#if settings.enableSearch}
            <a
              href="#/search"
              onclick={handleNavClick}
              class:active={isActive("/search", router.location, router.querystring || "")}
            >
              <Fa icon={faSearch} fw />
              <span>YouTube Search</span>
            </a>
          {/if}

          {#if settings.enableWatchLater}
            <a
              href="#/editor?id=WL"
              onclick={handleNavClick}
              class:active={isActive("/editor", router.location, router.querystring || "", true)}
            >
              <Fa icon={faClock} fw />
              <span>Watch Later</span>
            </a>
          {/if}

          {#if settings.enableOpenById}
            <a
              href="#/open-by-id"
              onclick={handleNavClick}
              class:active={isActive("/open-by-id", router.location, router.querystring || "")}
            >
              <Fa icon={faLink} fw />
              <span>Open by ID</span>
            </a>
          {/if}

          <hr class="nav-divider" />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sidenav {
    height: 100%;
    z-index: 1;
    background-color: var(--sidebar-bg-color);
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-right: 1px solid var(--border-color);
  }

  .top-nav {
    flex-grow: 1;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sidenav a,
  .drawer-nav a {
    padding: 0 16px;
    height: 44px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: 16px;
    transition: all 0.15s ease;
    border-radius: 12px;
    white-space: nowrap;
  }

  .nav-divider {
    border: 0;
    border-top: 1px solid var(--border-color);
    margin: 8px 16px;
    opacity: 0.6;
  }

  .sidenav a:hover,
  .drawer-nav a:hover {
    background-color: var(--hover-color);
  }

  .sidenav a.active,
  .drawer-nav a.active {
    background-color: var(--active-bg-color);
    color: var(--active-text-color);
    font-weight: 700;
  }

  :global(.sidenav a svg),
  :global(.drawer-nav a svg) {
    width: 20px !important;
    height: 20px !important;
    min-width: 20px;
  }

  /* Mobile drawer */
  .mobile-drawer {
    display: none;
  }

  @media (max-width: 768px) {
    .desktop-sidenav {
      display: none;
    }

    .mobile-drawer {
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 0;
      width: 260px;
      height: 100vh;
      background-color: var(--sidebar-bg-color);
      border-right: 1px solid var(--border-color);
      z-index: 999;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      padding: 8px 0;
    }

    .mobile-drawer.open {
      transform: translateX(0);
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 8px 16px;
      height: 52px;
      flex-shrink: 0;
    }

    .drawer-close {
      background: none;
      border: none;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-color);
      padding: 0;
      transition: background-color 0.2s ease;
    }

    .drawer-close:hover {
      background-color: var(--hover-color);
    }

    .drawer-nav {
      flex: 1;
      overflow-y: auto;
      padding: 0 8px;
    }

    .drawer-nav .nav-group {
      flex-direction: column;
    }
  }
</style>
