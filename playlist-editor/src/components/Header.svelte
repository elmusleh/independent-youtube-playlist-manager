<script lang="ts">
  import {
    faSignInAlt,
    faSignOutAlt,
    faUserCircle,
    faSearch,
    faPlus,
    faCircleUser,
    faGear,
    faRightFromBracket,
    faRightToBracket,
    faChevronRight,
    faArrowLeft,
    faCheck,
    faCommentMedical,
    faBell,
    faGlobe,
    faShieldHalved,
    faKeyboard,
    faQuestionCircle,
    faArrowRight,
    faBuilding,
    faTv,
    faCreditCard,
    faEllipsisVertical,
    faKey,
    faTerminal,
    faPalette,
    faFileLines,
    faXmark,
    faStar,
    faShareFromSquare,
    faComments,
    faArrowUpRightFromSquare,
    faBars,
  } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
  import { router, push } from "svelte-spa-router";
  import { onDestroy } from "svelte";
  import { requestConfirm } from "../stores/confirmation";
  import {
    playlistsSearch,
    historySearch,
    manageSearch,
    editorSearch,
  } from "../stores/playlists-filters";
  import { theme } from "../stores/theme.store.js";
  import type { ThemeChoice } from "../types/model.js";
  import { faSupportnow, faGithub } from "@fortawesome/free-brands-svg-icons";
  import ReleaseNotesModal from "./ReleaseNotesModal.svelte";
  import NotificationBell from "./NotificationBell.svelte";

  const browser = (window as any).browser || (window as any).chrome;

  let { isMenuOpen = false, onToggleMenu = () => {} }: { isMenuOpen?: boolean; onToggleMenu?: () => void } = $props();

  let signedIn = $state(false);
  let userProfile: {
    title: string;
    thumbnail: string;
    handle?: string;
  } | null = $state(null);
  let loadingAuth = $state(false);
  let open = $state(false);
  let channelInfo = $state({ title: "User", thumbnail: "", handle: "" });
  let missingCredentials = $state(false);
  let showReleaseNotes = $state(false);
  let showThemeCard = $state(false);
  let githubStars: string | null = $state(
    sessionStorage.getItem("yph_github_stars"),
  );
  let myChannelLoading = $state(false);
  let myChannelInfo: any = $state(null);
  let myChannelError = $state("");
  let myChannelLoaded = $state(false);

  async function fetchGithubStars() {
    try {
      if (githubStars) return;
      const res = await fetch(
        "https://api.github.com/repos/el-musleh/youtube-playlist-helper",
      );
      const data = await res.json();
      if (data.stargazers_count !== undefined) {
        let stars = data.stargazers_count;
        githubStars =
          stars > 999 ? (stars / 1000).toFixed(1) + "k" : stars.toString();
        sessionStorage.setItem("yph_github_stars", githubStars || "");
      }
    } catch (e) {
      console.error("Failed to fetch GitHub stars", e);
    }
  }

  function getThemeLabel(t: ThemeChoice): string {
    if (t === "device") return "Device theme";
    return t === "dark" ? "Dark" : "Light";
  }

  function toggleThemeCard(event: MouseEvent) {
    event.stopPropagation();
    showThemeCard = !showThemeCard;
  }

  function closeThemeCard() {
    showThemeCard = false;
  }

  function selectTheme(choice: ThemeChoice, event: MouseEvent) {
    event.stopPropagation();
    theme.set(choice);
    closeThemeCard();
  }

  async function checkCredentials() {
    try {
      const result = await browser.storage.local.get("custom_yt_credentials");
      const creds = result.custom_yt_credentials || {
        clientId: "",
        apiKey: "",
      };
      missingCredentials = !creds.clientId || !creds.apiKey;
      if (window.logSystemEvent && missingCredentials)
        await window.logSystemEvent(
          "INFO",
          "[HEADER] Missing custom API credentials",
        );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      missingCredentials = true;
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[HEADER] Failed to check credentials: ${errMsg}`,
        );
    }
  }

  checkCredentials();

  async function checkAuth() {
    const cachedSignedIn = !!(window as any)._isSignedIn;
    if (cachedSignedIn) {
      signedIn = true;
      loadChannelInfo();
    } else {
      try {
        const status = await window.isSignedIn();
        signedIn = status;
        (window as any)._isSignedIn = signedIn;
        if (signedIn) {
          loadChannelInfo();
        }
      } catch (e) {
        signedIn = false;
        (window as any)._isSignedIn = false;
      }
    }
  }

  async function loadChannelInfo() {
    try {
      const cached = await window.getUserProfile();
      if (cached && cached.thumbnail) {
        channelInfo = { ...channelInfo, ...cached };
      }
      channelInfo = { ...channelInfo, ...(await window.ytGetMyChannel()) };
    } catch (e) {
      console.error("Failed to load channel info", e);
    }
  }

  function toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    open = !open;
  }

  function closeDropdown() {
    open = false;
  }

  async function handleAuthAction(event: MouseEvent) {
    event.stopPropagation();
    closeDropdown();
    if (signedIn) {
      await window.revokeYouTubeToken();
      signedIn = false;
      push("/");
    } else {
      try {
        const result = await browser.storage.local.get("custom_yt_credentials");
        const creds = result.custom_yt_credentials;
        if (!creds?.clientId || !creds?.apiKey) {
          closeDropdown();
          if (window.info) window.info("Please fill in your API credentials first.");
          push("/api-setup");
          return;
        }
        await window.signIn();
        // Check if actually signed in by verifying token exists
        signedIn = await window.isSignedIn();
        console.log("ProfileDropdown: signIn completed, signedIn =", signedIn);
      } catch (e) {
        const code = (e as any)?.code;
        if (code === "credentials_missing") {
          if (window.info) window.info("Please fill in your API credentials first.");
          push("/api-setup");
        } else {
          console.error("Sign in failed", e);
          if (window.error) window.error("Sign-in failed. Please try again.");
        }
      }
    }
  }

  function navigateTo(path: string, event: MouseEvent) {
    event.stopPropagation();
    closeDropdown();
    push(path);
  }

  function openFeedback(event: MouseEvent) {
    event.stopPropagation();
    closeDropdown();
    window.open(
      "https://github.com/el-musleh/youtube-playlist-helper/issues",
      "_blank",
    );
  }

  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    const clickedOutsideProfile = !target.closest(".profile-container");
    const clickedOutsideThemeCard = !target.closest(".theme-card");

    // Close theme card if click is outside
    if (showThemeCard && clickedOutsideThemeCard) {
      closeThemeCard();
    }

    // Close dropdown if click is outside profile container
    if (open && clickedOutsideProfile) {
      closeDropdown();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      closeDropdown();
    }
    if (showThemeCard && event.key === "Escape") {
      closeThemeCard();
    }
  }

  // Only show search bar on specific views
  let isSavedView = $derived(
    router.location === "/saved" || router.location === "/",
  );
  let isHistoryView = $derived(router.location === "/history");
  let isManageView = $derived(router.location === "/manage");
  let isEditorView = $derived(router.location.startsWith("/editor"));
  let showSearchBar = $derived(
    isSavedView || isHistoryView || isManageView || isEditorView,
  );

  // Dynamic placeholder based on current view
  let searchPlaceholder = $derived(
    isSavedView || isManageView
      ? "Search playlists…"
      : isHistoryView
        ? "Search watch history…"
        : isEditorView
          ? "Search videos…"
          : "Search…",
  );

  // Local search value that syncs with the appropriate store
  let searchValue = $state("");

  // Sync search value with the appropriate store based on current view
  $effect(() => {
    if (isSavedView) {
      searchValue = $playlistsSearch;
    } else if (isHistoryView) {
      searchValue = $historySearch;
    } else if (isManageView) {
      searchValue = $manageSearch;
    } else if (isEditorView) {
      searchValue = $editorSearch;
    }
  });

  // Update the store when searchValue changes
  function handleSearchInput() {
    if (isSavedView) {
      playlistsSearch.set(searchValue);
    } else if (isHistoryView) {
      historySearch.set(searchValue);
    } else if (isManageView) {
      manageSearch.set(searchValue);
    } else if (isEditorView) {
      editorSearch.set(searchValue);
    }
  }

  async function loadProfile() {
    if (signedIn) {
      try {
        const profile = await window.ytGetMyChannel();
        userProfile = profile;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("Failed to load user profile:", e);
        if (window.logSystemEvent)
          await window.logSystemEvent(
            "ERROR",
            `[HEADER] Failed to load user profile: ${errMsg}`,
          );
      }
    } else {
      userProfile = null;
    }
  }

  async function loadMyChannel() {
    if (myChannelLoading || myChannelLoaded) return;
    myChannelLoading = true;
    myChannelError = "";
    try {
      const params = new URLSearchParams({
        part: "snippet,statistics,contentDetails",
        mine: "true",
      });
      const data = await (window as any).ytFetch(`/channels?${params}`);
      myChannelInfo = data.items?.[0] || null;
      myChannelLoaded = true;

      if (!myChannelInfo) {
        myChannelError = "Could not find your channel information.";
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to load channel info:", e);
      myChannelError = "Failed to load channel information.";
    } finally {
      myChannelLoading = false;
    }
  }

  async function init() {
    // Fetch GitHub stars count
    fetchGithubStars();

    // Give auth service a moment to initialize if needed
    let attempts = 0;
    while (typeof window.isSignedIn !== "function" && attempts < 20) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    try {
      if (typeof window.isSignedIn === "function") {
        signedIn = await window.isSignedIn();
        if (signedIn) {
          await loadProfile();
          await loadMyChannel();
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[HEADER] Init failed:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[HEADER] Init failed: ${errMsg}`);
    }
  }

  const handleAuthChange = async (e: any) => {
    signedIn = e.detail.isSignedIn;
    if (signedIn) {
      await loadProfile();
      await loadMyChannel();
    } else {
      userProfile = null;
      myChannelInfo = null;
      myChannelLoaded = false;
    }
  };

  window.addEventListener("yt-auth-changed", handleAuthChange);
  window.addEventListener("click", handleWindowClick);
  window.addEventListener("keydown", handleKeydown);
  init();

  onDestroy(() => {
    window.removeEventListener("yt-auth-changed", handleAuthChange);
    window.removeEventListener("click", handleWindowClick);
    window.removeEventListener("keydown", handleKeydown);
  });

  async function handleAuthClick() {
    if (loadingAuth) return;

    if (signedIn) {
      requestConfirm({
        title: "Sign Out?",
        message: "You will need to log in again to sync playlists.",
        color: "danger",
        onConfirm: async () => {
          if (typeof window.revokeYouTubeToken === "function") {
            loadingAuth = true;
            try {
              await window.revokeYouTubeToken();
              signedIn = false;
              userProfile = null;
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              console.error("[HEADER] Sign-out failed:", e);
              if (window.logSystemEvent)
                await window.logSystemEvent(
                  "ERROR",
                  `[HEADER] Sign-out failed: ${errMsg}`,
                );
            } finally {
              loadingAuth = false;
            }
          }
        },
      });
    } else {
      if (typeof window.signIn === "function") {
        loadingAuth = true;
        try {
          await window.signIn();
          signedIn = await window.isSignedIn();
          if (signedIn) await loadProfile();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const code = (err as any)?.code;
          if (code === "credentials_missing") {
            if (window.info) window.info("Please fill in your API credentials first.");
            push("/api-setup");
          } else {
            console.error("Sign in failed:", err);
            if (window.logSystemEvent)
              await window.logSystemEvent(
                "ERROR",
                `[HEADER] Sign-in failed: ${errMsg}`,
              );
            if (window.error) window.error("Sign-in failed. Please try again.");
          }
        } finally {
          loadingAuth = false;
        }
      }
    }
  }
</script>

<header>
  <div class="container">
    <div class="left">
      <button
        class="menu-toggle"
        onclick={() => onToggleMenu()}
        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={isMenuOpen}
      >
        <Fa icon={isMenuOpen ? faXmark : faBars} size="lg" />
      </button>
      <div
        class="logo"
        onclick={() => push("/")}
        onkeydown={(e) => (e.key === "Enter" || e.key === " ") && push("/")}
        role="button"
        tabindex="0"
        aria-label="Go to home"
      >
        <img
          alt="YPH Logo"
          src="../icons/icon_128.png"
          class="brand-logo"
          width="32"
          height="32"
        />
        <div class="brand-info">
          <span class="brand-name">Playlist Manager</span>
          <span class="version">v{browser.runtime.getManifest().version}</span>
        </div>
      </div>
    </div>

    <div class="center" class:hidden={!showSearchBar}>
      <div class="search-container">
        <input
          aria-label="Search"
          type="text"
          placeholder={searchPlaceholder}
          bind:value={searchValue}
          oninput={handleSearchInput}
        />
        <button class="search-btn" aria-label="Search">
          <Fa icon={faSearch} />
        </button>
      </div>
    </div>

    <div class="right">
      <button
        class="create-btn create-btn-create-color"
        onclick={() => push("/new")}
      >
        <Fa icon={faPlus} fw />
        <span>New Playlist</span>
      </button>

      <NotificationBell disabled={!signedIn} />

      <div class="profile-container">
        <button
          class="avatar-btn"
          class:logged-in={signedIn && (channelInfo.thumbnail || userProfile)}
          class:icon-only={!signedIn ||
            (!channelInfo.thumbnail && !userProfile)}
          onclick={toggleDropdown}
          title="Account"
        >
          {#if signedIn && (channelInfo.thumbnail || userProfile)}
            <img
              alt={userProfile?.title || channelInfo.title}
              src={userProfile?.thumbnail || channelInfo.thumbnail}
              class="avatar"
              width="32"
              height="32"
            />
            <span class="user-name"
              >{userProfile?.title || channelInfo.title}</span
            >
          {:else}
            <Fa icon={faEllipsisVertical} size="lg" />
          {/if}
        </button>

        {#if open}
          <div
            class="dropdown-menu"
            role="menu"
            tabindex="-1"
            onkeydown={(e) => e.stopPropagation()}
          >
            {#if signedIn}
              <div class="my-channel-section">
                {#if myChannelLoading}
                  <div class="channel-loading">Loading channel info...</div>
                {:else if myChannelError}
                  <div class="channel-error">
                    <p>{myChannelError}</p>
                    <button class="retry-btn" onclick={loadMyChannel}
                      >Retry</button
                    >
                  </div>
                {:else if myChannelInfo}
                  <div class="channel-info">
                    <div class="channel-header">
                      <img
                        src={myChannelInfo.snippet.thumbnails?.medium?.url}
                        alt={myChannelInfo.snippet.title}
                        class="channel-avatar"
                      />
                      <div class="channel-meta">
                        <h3>{myChannelInfo.snippet.title}</h3>
                        <p class="handle">{myChannelInfo.snippet.customUrl}</p>
                        <a
                          href="https://youtube.com/{myChannelInfo.snippet
                            .customUrl}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="yt-link"
                        >
                          View on YouTube <Fa
                            icon={faArrowUpRightFromSquare}
                            size="xs"
                          />
                        </a>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <div class="menu-section">
                <button
                  class="menu-item auth-action"
                  onclick={handleAuthAction}
                >
                  <div class="icon-box">
                    <Fa icon={faRightFromBracket} fw />
                  </div>
                  <span>Sign out</span>
                </button>
              </div>

              <div class="divider"></div>
            {/if}

            <div class="menu-section mobile-only-menu-item">
              <a href="#/new" class="menu-item" onclick={closeDropdown}>
                <div class="icon-box">
                  <Fa icon={faPlus} fw />
                </div>
                <span>New Playlist</span>
              </a>
            </div>

            <div class="divider mobile-only-menu-item"></div>

            <div class="menu-section">
              <button
                class="menu-item appearance-trigger"
                onclick={toggleThemeCard}
              >
                <div class="icon-box">
                  <Fa icon={faPalette} fw />
                </div>
                <span>Appearance: {getThemeLabel($theme)}</span>
                <div class="chevron-right">
                  <Fa icon={faChevronRight} size="xs" />
                </div>
              </button>
              <button
                class="menu-item"
                onclick={(e) => navigateTo("/shortcuts", e)}
              >
                <div class="icon-box"><Fa icon={faKeyboard} fw /></div>
                <span>Keyboard shortcuts</span>
              </button>
            </div>

            {#if showThemeCard}
              <div
                class="theme-card"
                role="dialog"
                aria-labelledby="theme-card-title"
              >
                <div class="theme-card-header">
                  <span id="theme-card-title">Appearance</span>
                </div>
                <div class="theme-options">
                  <button
                    class="theme-option"
                    class:selected={$theme === "dark"}
                    onclick={(e) => selectTheme("dark", e)}
                  >
                    <span>Dark</span>
                  </button>
                  <button
                    class="theme-option"
                    class:selected={$theme === "light"}
                    onclick={(e) => selectTheme("light", e)}
                  >
                    <span>Light</span>
                  </button>
                  <button
                    class="theme-option"
                    class:selected={$theme === "device"}
                    onclick={(e) => selectTheme("device", e)}
                  >
                    <span>Device default</span>
                  </button>
                </div>
              </div>
            {/if}

            <div class="divider"></div>

            <div class="menu-section">
              <button
                class="menu-item"
                onclick={(e) => navigateTo("/api-setup", e)}
              >
                <div class="icon-box">
                  <Fa icon={faKey} fw />
                  {#if missingCredentials}
                    <div class="warning-badge" title="API credentials missing">
                      !
                    </div>
                  {/if}
                </div>
                <span>API Setup</span>
              </button>
              <button
                class="menu-item"
                onclick={(e) => navigateTo("/settings", e)}
              >
                <div class="icon-box"><Fa icon={faGear} fw /></div>
                <span>Settings</span>
              </button>
              <button class="menu-item" onclick={(e) => navigateTo("/logs", e)}>
                <div class="icon-box"><Fa icon={faTerminal} fw /></div>
                <span>System Logs</span>
              </button>
            </div>

            <div class="divider"></div>

            <div class="menu-section">
              <button
                class="menu-item"
                onclick={(e) => navigateTo("/share", e)}
              >
                <div class="icon-box"><Fa icon={faShareFromSquare} fw /></div>
                <span>Share</span>
              </button>
              <button
                class="menu-item"
                onclick={(e) => {
                  e.stopPropagation();
                  closeDropdown();
                  showReleaseNotes = true;
                }}
              >
                <div class="icon-box"><Fa icon={faFileLines} fw /></div>
                <span>Release notes</span>
              </button>
              <button class="menu-item" onclick={openFeedback}>
                <div class="icon-box"><Fa icon={faCommentMedical} fw /></div>
                <span>Send feedback</span>
              </button>
              <button
                class="menu-item"
                onclick={(e) => {
                  e.stopPropagation();
                  closeDropdown();
                  window.open(
                    "https://github.com/el-musleh/youtube-playlist-helper/discussions",
                  );
                }}
              >
                <div class="icon-box"><Fa icon={faComments} fw /></div>
                <span>Discussions</span>
              </button>
            </div>
            <div class="divider"></div>

            <div class="menu-section">
              <a
                href="https://github.com/el-musleh/youtube-playlist-helper"
                target="_blank"
                rel="noopener noreferrer"
                class="menu-item"
                title="GitHub Repository"
              >
                <div class="icon-box"><Fa icon={faGithub} size="lg" /></div>
                {#if githubStars}
                  <span class="stars-count"
                    ><Fa icon={faStar} size="xs" /> {githubStars}</span
                  >
                {/if}
                <span>GitHub Repository</span>
              </a>
            </div>
          </div>
        {/if}
      </div>

      {#if !signedIn}
        <button
          class="sign-in-btn"
          onclick={handleAuthClick}
          disabled={loadingAuth}
        >
          <Fa icon={faCircleUser} fw />
          <span>{loadingAuth ? "Wait..." : "Sign in"}</span>
        </button>
      {/if}
    </div>
  </div>
</header>

<ReleaseNotesModal bind:display={showReleaseNotes} />

<style>
  header {
    height: 56px;
    background-color: var(--background-color);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    width: 100%;
  }

  .container {
    width: 100%;
    margin: 0;
    padding: 0 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .left {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 8px;
  }

  .menu-toggle {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    color: var(--text-color);
    padding: 0;
    margin: 0;
    flex-shrink: 0;
    transition: background-color 0.2s ease;
  }

  .menu-toggle:hover {
    background-color: var(--hover-color);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    user-select: none;
  }

  .brand-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .brand-info {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    gap: 4px;
  }

  .brand-name {
    font-family: "YouTube Sans", "Roboto", sans-serif;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.5px;
    color: var(--text-color);
  }

  .version {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 400;
  }

  .center {
    flex: 1;
    display: flex;
    justify-content: center;
    max-width: 720px;
    padding: 0 40px;
    transition: opacity 0.2s ease;
  }

  .center.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .search-container {
    display: flex;
    align-items: center;
    width: 100%;
    height: 40px;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 40px;
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .search-container:focus-within {
    border-color: var(--primary-color);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .search-container input {
    flex: 1;
    height: 100%;
    padding: 0 16px;
    border: none;
    background: transparent;
    color: var(--text-color);
    font-size: 16px;
    outline: none;
    margin: 0;
  }

  .search-container input:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
  }

  .search-btn {
    width: 64px;
    height: 100%;
    background: var(--hover-color);
    border: none;
    border-left: 1px solid var(--border-color);
    color: var(--text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
  }

  .search-btn:hover {
    background: var(--bg-secondary);
  }

  .right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .user-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stars-count {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
    border-left: 1px solid var(--border-color);
    padding-left: 8px;
    margin-left: 4px;
  }

  .sign-in-btn {
    height: 34px;
    padding: 0 14px;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 40px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
    color: #3ea6ff;
    transition: all 0.2s ease;
  }

  .sign-in-btn:hover {
    background-color: rgba(62, 166, 255, 0.1);
    border-color: #3ea6ff;
  }

  .sign-in-btn:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  /* Divider styling */
  .divider {
    height: 1px;
    background: var(--border-color);
    margin: 8px 16px;
    flex-shrink: 0;
  }

  /* Warning badge styling */
  .warning-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 14px;
    height: 14px;
    background: #f44336;
    color: white;
    font-size: 10px;
    font-weight: 700;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--background-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .create-btn {
    height: 34px;
    padding: 0 14px;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 40px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .create-btn-create-color {
    background-color: #606060;
    color: #fff;
  }

  .create-btn-create-color:hover {
    background-color: #4a4a4a;
  }

  @media (max-width: 768px) {
    header {
      height: 52px;
    }

    .container {
      padding: 0 12px;
    }

    .menu-toggle {
      display: flex;
    }

    .brand-name,
    .version {
      display: none;
    }

    .brand-info {
      display: none;
    }

    .logo {
      gap: 8px;
    }

    .brand-logo {
      width: 28px;
      height: 28px;
    }

    .center {
      padding: 0 8px;
    }

    .search-container {
      height: 36px;
    }

    .search-btn {
      width: 48px;
    }

    .search-container input {
      font-size: 14px;
      padding: 0 12px;
    }

    .create-btn span {
      display: none;
    }

    .create-btn {
      width: 34px;
      height: 34px;
      padding: 0;
      justify-content: center;
    }

    .user-name {
      display: none;
    }

    .avatar {
      width: 28px;
      height: 28px;
    }

    .avatar-btn.logged-in {
      height: 32px;
      padding-left: 2px;
      padding-right: 8px;
      border-radius: 16px;
    }

    .avatar-btn.logged-in .avatar {
      width: 28px;
      height: 28px;
    }

    .avatar-btn.logged-in .user-name {
      display: none;
    }

    .avatar-btn.icon-only {
      width: 32px;
      height: 32px;
    }
  }

  @media (max-width: 480px) {
    .mobile-only-menu-item {
      display: flex;
    }

    .center {
      padding: 0 4px;
      flex: 0 1 auto;
      min-width: 0;
    }

    .search-container {
      height: 32px;
    }

    .search-btn {
      width: 36px;
    }

    .search-container input {
      font-size: 13px;
      padding: 0 8px;
    }

    .stars-count {
      display: none;
    }

    .avatar-btn.logged-in {
      height: 30px;
      padding-left: 0;
      padding-right: 6px;
    }

    .avatar-btn.logged-in .avatar {
      width: 26px;
      height: 26px;
    }

    .avatar-btn.icon-only {
      width: 30px;
      height: 30px;
    }
  }

  .profile-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .avatar-btn {
    background: none;
    border: none;
    cursor: pointer;
    height: 34px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-color);
    transition: background-color 0.2s ease;
  }

  .avatar-btn.logged-in {
    padding-left: 4px;
    padding-right: 12px;
    border-radius: 17px;
  }

  .avatar-btn.logged-in:hover {
    background-color: var(--bg-secondary);
  }

  .avatar-btn.icon-only {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    justify-content: center;
    padding: 0;
  }

  .avatar-btn.icon-only:hover {
    background-color: var(--bg-secondary);
  }

  .avatar-btn .avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
  }

  .avatar-btn .user-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .dropdown-menu {
    position: absolute;
    top: 40px;
    right: 0;
    width: 300px;
    background-color: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    padding: 8px 0;
    display: flex;
    flex-direction: column;
    transform-origin: top right;
    animation: scaleIn 0.15s ease-out;
  }

  :global([data-theme="dark"]) .dropdown-menu {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    background-color: #282828;
  }

  .menu-section {
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    flex-direction: column;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 16px;
    height: 40px;
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .mobile-only-menu-item {
    display: none;
  }

  .menu-item:hover {
    background-color: var(--hover-color);
  }

  .icon-box {
    width: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
  }

  .icon-box {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .appearance-trigger {
    position: relative;
  }

  .chevron-right {
    margin-left: auto;
    color: var(--text-muted);
    display: flex;
    align-items: center;
  }

  .theme-card {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    background-color: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 2000;
    padding: 0;
    overflow: hidden;
  }

  :global([data-theme="dark"]) .theme-card {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    background-color: #282828;
  }

  .theme-card-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .theme-card-header span {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }

  .theme-options {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
  }

  .theme-option {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background-color 0.15s ease;
  }

  .theme-option:hover {
    background-color: var(--hover-color);
  }

  .theme-option.selected {
    background-color: var(--active-bg-color);
  }

  @media (max-width: 600px) {
    .dropdown-menu {
      position: fixed;
      top: 56px;
      right: 0;
      left: 0;
      width: 100%;
      border-radius: 0;
      height: calc(100vh - 56px);
      border: none;
    }

    .theme-card {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      max-width: 280px;
      border-radius: 12px;
      max-height: 60vh;
      overflow-y: auto;
    }
  }

  :global([data-theme="dark"]) .warning-badge {
    border-color: #282828;
  }

  .my-channel-section {
    padding: 16px;
    border-top: 1px solid var(--border-color);
  }

  .channel-loading,
  .channel-error {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
  }

  .channel-error p {
    margin-bottom: 8px;
  }

  .retry-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  .channel-info {
    background: var(--background-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .channel-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .channel-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
  }

  .channel-meta h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .channel-meta .handle {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .yt-link {
    color: #3ea6ff;
    text-decoration: none;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .yt-link:hover {
    text-decoration: underline;
  }
</style>
