<script lang="ts">
  import { faPlus, faCircleUser, faXmark, faBars } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
  import { push } from "svelte-spa-router";
  import { onDestroy } from "svelte";
  import { requestConfirm } from "../stores/confirmation";
  import ReleaseNotesModal from "./ReleaseNotesModal.svelte";
  import NotificationBell from "./NotificationBell.svelte";
  import HeaderSearchBar from "./HeaderSearchBar.svelte";
  import ProfileDropdown from "./ProfileDropdown.svelte";
  import { logger } from "../services/logger";

  const browser = (window as any).browser || (window as any).chrome;

  let {
    isMenuOpen = false,
    onToggleMenu = () => {},
  }: { isMenuOpen?: boolean; onToggleMenu?: () => void } = $props();

  let signedIn = $state(false);
  let userProfile: {
    title: string;
    thumbnail: string;
    handle?: string;
  } | null = $state(null);
  let loadingAuth = $state(false);
  let channelInfo = $state({ title: "User", thumbnail: "", handle: "" });
  let missingCredentials = $state(false);
  let showReleaseNotes = $state(false);
  let githubStars: string | null = $state(sessionStorage.getItem("yph_github_stars"));

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
    } catch (e) {
      logger.error("Failed to fetch GitHub stars", e);
    }
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
        await window.logSystemEvent("INFO", "[HEADER] Missing custom API credentials");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      missingCredentials = true;
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[HEADER] Failed to check credentials: ${errMsg}`);
    }
  }

  checkCredentials();

  async function loadChannelInfo() {
    try {
      const cached = await window.getUserProfile();
      if (cached && cached.thumbnail) {
        channelInfo = { ...channelInfo, ...cached };
      }
      channelInfo = { ...channelInfo, ...(await window.ytGetMyChannel()) };
    } catch (e) {
      logger.error("Failed to load channel info", e);
    }
  }

  function handleDropdownSignOut() {
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
            logger.error("[HEADER] Sign-out failed:", e);
            if (window.logSystemEvent)
              await window.logSystemEvent("ERROR", `[HEADER] Sign-out failed: ${errMsg}`);
          } finally {
            loadingAuth = false;
          }
        }
      },
    });
  }

  async function handleDropdownSignIn() {
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
          logger.error("Sign in failed:", err);
          if (window.logSystemEvent)
            await window.logSystemEvent("ERROR", `[HEADER] Sign-in failed: ${errMsg}`);
          if (window.error) window.error("Sign-in failed. Please try again.");
        }
      } finally {
        loadingAuth = false;
      }
    }
  }

  async function loadProfile() {
    if (signedIn) {
      try {
        const profile = await window.ytGetMyChannel();
        userProfile = profile;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        logger.error("Failed to load user profile:", e);
        if (window.logSystemEvent)
          await window.logSystemEvent("ERROR", `[HEADER] Failed to load user profile: ${errMsg}`);
      }
    } else {
      userProfile = null;
    }
  }

  async function init() {
    fetchGithubStars();
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
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error("[HEADER] Init failed:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[HEADER] Init failed: ${errMsg}`);
    }
  }

  const handleAuthChange = async (e: any) => {
    signedIn = e.detail.isSignedIn;
    if (signedIn) {
      await loadProfile();
    } else {
      userProfile = null;
    }
  };

  window.addEventListener("yt-auth-changed", handleAuthChange);
  init();

  onDestroy(() => {
    window.removeEventListener("yt-auth-changed", handleAuthChange);
  });

  async function handleAuthClick() {
    if (loadingAuth) return;
    if (signedIn) {
      handleDropdownSignOut();
    } else {
      await handleDropdownSignIn();
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
          src="../assets/icons/icon_128.png"
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

    <HeaderSearchBar />

    <div class="right">
      <button class="create-btn create-btn-create-color" onclick={() => push("/new")}>
        <Fa icon={faPlus} fw />
        <span>New Playlist</span>
      </button>

      <NotificationBell disabled={!signedIn} />

      <ProfileDropdown
        {signedIn}
        {userProfile}
        {channelInfo}
        {missingCredentials}
        {githubStars}
        onSignOut={handleDropdownSignOut}
        onSignIn={handleDropdownSignIn}
        onToggleReleaseNotes={() => (showReleaseNotes = true)}
      />

      {#if !signedIn}
        <button class="sign-in-btn" onclick={handleAuthClick} disabled={loadingAuth}>
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

  .right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
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

    .create-btn span {
      display: none;
    }

    .create-btn {
      width: 34px;
      height: 34px;
      padding: 0;
      justify-content: center;
    }
  }
</style>
