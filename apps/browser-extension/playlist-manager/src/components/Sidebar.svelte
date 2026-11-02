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
    faWandMagicSparkles,
    faGear,
    faKeyboard,
  } from "@fortawesome/free-solid-svg-icons";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";
  import Fa from "svelte-fa";
  import { router } from "svelte-spa-router";
  import { onDestroy } from "svelte";
  import type { Settings } from "../types/model";
  import Modal from "./Modal.svelte";

  const browser = (window as any).browser || (window as any).chrome;

  let settings: Settings | null = $state(null);
  let signedIn = $state(false);
  let gapCount = $state(0);
  let githubStars: string | null = $state(sessionStorage.getItem("yph_github_stars"));

  let { drawerOpen = false, onClose = () => {} }: { drawerOpen?: boolean; onClose?: () => void } =
    $props();

  function handleNavClick() {
    onClose();
  }

  async function fetchGithubStars() {
    try {
      if (githubStars) return;
      const res = await fetch(
        "https://api.github.com/repos/elmusleh/independent-youtube-playlist-manager"
      );
      const data = await res.json();
      if (data.stargazers_count !== undefined) {
        let stars = data.stargazers_count;
        githubStars = stars > 999 ? (stars / 1000).toFixed(1) + "k" : stars.toString();
        sessionStorage.setItem("yph_github_stars", githubStars || "");
      }
    } catch {
      // ignore
    }
  }

  async function loadSettings() {
    settings = await window.getSettings();
  }

  async function checkAuth() {
    signedIn = await window.isSignedIn();
  }

  /**
   * Number of cached entries that are not resolved (see `needsAttention` in
   * utils/metadata-completeness). Surfaced as a badge on the Data Manager nav
   * item; the summary's own counter keeps it identical to the Data Manager list.
   */
  let gapLoading = false;

  async function loadGapCount() {
    if (gapLoading) return;
    gapLoading = true;
    try {
      if (typeof window.getMetadataGapSummary !== "function") {
        gapCount = 0;
        return;
      }
      const summary = await window.getMetadataGapSummary();
      gapCount = summary.needsAttention;
    } catch {
      gapCount = 0;
    } finally {
      gapLoading = false;
    }
  }

  /**
   * Counting gaps means reading the whole metadata cache, so it is deferred
   * until the app is idle instead of competing with the first paint.
   */
  function scheduleGapCount() {
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => loadGapCount(), { timeout: 3000 });
    } else {
      setTimeout(loadGapCount, 1200);
    }
  }

  loadSettings();
  checkAuth();
  scheduleGapCount();
  fetchGithubStars();

  window.addEventListener("yph-metadata-changed", loadGapCount);

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
    window.removeEventListener("yph-metadata-changed", loadGapCount);
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

      <hr class="nav-divider" />

      {#if signedIn && settings && (settings.enableSubscriptions || settings.enableSearch || settings.enableWatchLater || settings.enableOpenById)}
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

  <div class="sidebar-bottom">
    <div class="sidebar-footer">
      <a
        href="#/metadata"
        class="sidebar-footer-link"
        class:active={isActive("/metadata", router.location, router.querystring || "")}
      >
        <Fa icon={faWandMagicSparkles} fw />
        <span>Data Manager</span>
        {#if gapCount > 0}
          <span
            class="nav-badge"
            title="{gapCount} incomplete entries"
            aria-label="{gapCount} incomplete {gapCount === 1 ? 'entry' : 'entries'}"
          >
            {gapCount > 99 ? "99+" : gapCount}
          </span>
        {/if}
      </a>
      <a href="#/settings" class="sidebar-footer-link">
        <Fa icon={faGear} fw />
        <span>Settings</span>
      </a>
      <a
        href="https://github.com/elmusleh/independent-youtube-playlist-manager"
        target="_blank"
        rel="noopener noreferrer"
        class="sidebar-footer-link github-link"
        title="GitHub Repository"
      >
        <Fa icon={faGithub} fw />
        <span>GitHub</span>
        {#if githubStars}
          <span class="stars-count"><Fa icon={faStar} class="star-icon" /> {githubStars}</span>
        {/if}
      </a>
    </div>
  </div>
</div>

<!-- Mobile drawer -->
{#if drawerOpen}
  <Modal display={drawerOpen} onclose={onClose} size="drawer" title="Navigation" showHeader={false}>
    <div class="mobile-drawer" class:open={drawerOpen}>
      <div class="drawer-header">
        <a
          href="#/"
          class="drawer-brand"
          onclick={handleNavClick}
          aria-label="Playlist Manager home"
        >
          <img src="../assets/icons/icon_128.png" alt="" width="32" height="32" />
          <span>Playlist Manager</span>
        </a>
        <button
          class="drawer-close"
          onclick={() => onClose()}
          aria-label="Close navigation"
          data-initial-focus
        >
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

          <hr class="nav-divider" />

          {#if signedIn && settings && (settings.enableSubscriptions || settings.enableSearch || settings.enableWatchLater || settings.enableOpenById)}
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

      <div class="sidebar-bottom">
        <div class="sidebar-footer">
          <a
            href="#/metadata"
            onclick={handleNavClick}
            class="sidebar-footer-link"
            class:active={isActive("/metadata", router.location, router.querystring || "")}
          >
            <Fa icon={faWandMagicSparkles} fw />
            <span>Data Manager</span>
            {#if gapCount > 0}
              <span
                class="nav-badge"
                title="{gapCount} incomplete entries"
                aria-label="{gapCount} incomplete {gapCount === 1 ? 'entry' : 'entries'}"
              >
                {gapCount > 99 ? "99+" : gapCount}
              </span>
            {/if}
          </a>
          <a href="#/settings" class="sidebar-footer-link" onclick={handleNavClick}>
            <Fa icon={faGear} fw />
            <span>Settings</span>
          </a>
          <a
            href="https://github.com/elmusleh/independent-youtube-playlist-manager"
            target="_blank"
            rel="noopener noreferrer"
            class="sidebar-footer-link github-link"
            title="GitHub Repository"
            onclick={handleNavClick}
          >
            <Fa icon={faGithub} fw />
            <span>GitHub</span>
            {#if githubStars}
              <span class="stars-count"><Fa icon={faStar} class="star-icon" /> {githubStars}</span>
            {/if}
          </a>
        </div>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .sidenav {
    z-index: 1;
    background-color: var(--sidebar-bg-color);
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-right: 1px solid var(--border-color);
    overflow: hidden;
  }

  .top-nav {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    min-height: 0;
  }

  .sidebar-bottom {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: auto;
    flex-shrink: 0;
  }

  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .sidebar-footer-link.github-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    margin-top: 4px;
    padding: 6px 8px;
    background-color: var(--hover-color);
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
    text-decoration: none;
  }

  .sidebar-footer-link.github-link:hover {
    background-color: var(--sidebar-bg-color);
    border-color: var(--color-brand-primary);
  }

  :global(.sidebar-footer-link.github-link .star-icon) {
    color: #f5c518;
    font-size: 12px;
  }

  .sidebar-footer-link.github-link .stars-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .sidebar-footer-link.active {
    background-color: var(--hover-color);
    font-weight: 600;
  }

  .nav-badge {
    margin-left: auto;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background-color: var(--color-brand-primary, var(--active-bg-color));
    color: var(--color-text-inverse, var(--active-text-color));
    font-size: 11px;
    font-weight: 700;
    line-height: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
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
      flex: 1;
      min-height: 0;
      width: 100%;
      background-color: var(--sidebar-bg-color);
      border-right: 1px solid var(--border-color);
      transition: transform 0.25s ease;
      padding: 0 0 max(8px, env(safe-area-inset-bottom));
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 8px 8px 16px;
      height: 56px;
      flex-shrink: 0;
      border-bottom: 1px solid var(--border-color);
    }

    .drawer-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      color: var(--text-color);
      text-decoration: none;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }

    .drawer-brand img {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .drawer-brand span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      min-height: 0;
      overflow-y: auto;
      padding: 0 8px;
      display: flex;
      flex-direction: column;
    }

    .drawer-nav .nav-group {
      flex: 0 0 auto;
      flex-direction: column;
    }

    .mobile-drawer .sidebar-bottom {
      flex-shrink: 0;
      margin-top: 0;
      padding: 0 8px;
    }

    .mobile-drawer .sidebar-footer-link:not(.github-link) {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 44px;
      padding: 0 16px;
      border-radius: 12px;
      color: var(--text-color);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      transition: background-color 0.15s ease;
    }

    .mobile-drawer .sidebar-footer-link:not(.github-link):hover {
      background-color: var(--hover-color);
    }

    .mobile-drawer .sidebar-footer-link:not(.github-link).active {
      background-color: var(--active-bg-color);
      color: var(--active-text-color);
      font-weight: 700;
    }

    .mobile-drawer .sidebar-footer-link svg {
      width: 20px !important;
      height: 20px !important;
      min-width: 20px;
    }
  }
</style>
