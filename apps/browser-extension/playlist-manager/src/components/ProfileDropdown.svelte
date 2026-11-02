<script lang="ts">
  import {
    faRightFromBracket,
    faRightToBracket,
    faPlus,
    faKeyboard,
    faGear,
    faTerminal,
    faShareFromSquare,
    faFileLines,
    faCommentMedical,
    faComments,
    faEllipsisVertical,
    faKey,
    faStar,
  } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
  import { push } from "svelte-spa-router";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";
  import ThemePicker from "./ThemePicker.svelte";
  import ChannelInfoCard from "./ChannelInfoCard.svelte";

  let {
    signedIn = false,
    userProfile = null,
    channelInfo = { title: "User", thumbnail: "", handle: "" },
    missingCredentials = false,
    githubStars = null,
    onSignOut = () => {},
    onSignIn = () => {},
  }: {
    signedIn?: boolean;
    userProfile?: { title: string; thumbnail: string; handle?: string } | null;
    channelInfo?: { title: string; thumbnail: string; handle?: string };
    missingCredentials?: boolean;
    githubStars?: string | null;
    onSignOut?: () => void;
    onSignIn?: () => void;
  } = $props();

  let open = $state(false);
  let themeSubmenuOpen = $state(false);

  function toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    open = !open;
  }

  function closeDropdown() {
    open = false;
    themeSubmenuOpen = false;
  }

  function setThemeSubmenuOpen(value: boolean) {
    themeSubmenuOpen = value;
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
      "https://github.com/elmusleh/independent-youtube-playlist-manager/issues",
      "_blank"
    );
  }

  function openDiscussions(event: MouseEvent) {
    event.stopPropagation();
    closeDropdown();
    window.open("https://github.com/elmusleh/independent-youtube-playlist-manager/discussions");
  }

  function openReleaseNotes(event: MouseEvent) {
    event.stopPropagation();
    closeDropdown();
    window.open(
      "https://github.com/elmusleh/independent-youtube-playlist-manager/releases",
      "_blank"
    );
  }

  function handleAuthAction(event: MouseEvent) {
    event.stopPropagation();
    closeDropdown();
    if (signedIn) {
      onSignOut();
    } else {
      onSignIn();
    }
  }

  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (open && !target.closest(".profile-container") && !target.closest(".theme-submenu")) {
      closeDropdown();
    } else if (
      themeSubmenuOpen &&
      target.closest(".dropdown-menu") &&
      !target.closest(".theme-submenu")
    ) {
      // Clicked in dropdown but outside theme submenu - close theme submenu only
      setThemeSubmenuOpen(false);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      closeDropdown();
    }
  }

  $effect(() => {
    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<div class="profile-container">
  <button
    class="avatar-btn"
    class:logged-in={signedIn && (channelInfo.thumbnail || userProfile)}
    class:icon-only={!signedIn || (!channelInfo.thumbnail && !userProfile)}
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
      <span class="user-name">{userProfile?.title || channelInfo.title}</span>
    {:else}
      <Fa icon={faEllipsisVertical} size="lg" />
    {/if}
  </button>

  {#if open}
    <div class="dropdown-menu" role="menu" tabindex="-1" onkeydown={(e) => e.stopPropagation()}>
      {#if signedIn}
        <ChannelInfoCard {signedIn} />

        <div class="menu-section">
          <button class="menu-item auth-action" onclick={handleAuthAction}>
            <div class="icon-box">
              <Fa icon={faRightFromBracket} fw />
            </div>
            <span>Sign out</span>
          </button>
        </div>

        <div class="divider"></div>
      {/if}

      {#if !signedIn}
        <div class="menu-section compact-only-auth">
          <button class="menu-item auth-action" onclick={handleAuthAction}>
            <div class="icon-box">
              <Fa icon={faRightToBracket} fw />
            </div>
            <span>Sign in</span>
          </button>
        </div>
        <div class="divider compact-only-auth"></div>
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
        <button class="menu-item" onclick={(e) => navigateTo("/shortcuts", e)}>
          <div class="icon-box"><Fa icon={faKeyboard} fw /></div>
          <span>Keyboard shortcuts</span>
        </button>
      </div>

      <div class="menu-section">
        <button class="menu-item" onclick={(e) => navigateTo("/api-setup", e)}>
          <div class="icon-box">
            <Fa icon={faKey} fw />
            {#if missingCredentials}
              <div class="warning-badge" title="OAuth Client ID missing">!</div>
            {/if}
          </div>
          <span>API Setup</span>
        </button>
      </div>

      <div class="menu-section">
        <ThemePicker onClose={closeDropdown} onSubmenuToggle={setThemeSubmenuOpen} />
      </div>

      <div class="divider"></div>

      <div class="menu-section">
        <button class="menu-item" onclick={(e) => navigateTo("/logs", e)}>
          <div class="icon-box"><Fa icon={faTerminal} fw /></div>
          <span>System Logs</span>
        </button>
        <button class="menu-item" onclick={openReleaseNotes}>
          <div class="icon-box"><Fa icon={faFileLines} fw /></div>
          <span>Release notes</span>
        </button>
        <button class="menu-item" onclick={openFeedback}>
          <div class="icon-box"><Fa icon={faCommentMedical} fw /></div>
          <span>Send feedback</span>
        </button>
        <button class="menu-item" onclick={openDiscussions}>
          <div class="icon-box"><Fa icon={faComments} fw /></div>
          <span>Discussions</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .avatar-btn {
    background: none;
    border: none;
    cursor: pointer;
    height: var(--touch-target-min);
    min-height: var(--touch-target-min);
    margin: 0;
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

  .avatar-btn.logged-in:hover,
  .avatar-btn.icon-only:hover {
    background-color: var(--bg-secondary);
  }

  .avatar-btn.icon-only {
    width: var(--header-control-size);
    min-width: var(--header-control-size);
    height: var(--header-control-size);
    border-radius: 50%;
    justify-content: center;
    padding: 0;
  }

  .avatar-btn.icon-only :global(svg) {
    width: var(--header-icon-size);
    height: var(--header-icon-size);
    flex-shrink: 0;
  }

  .avatar-btn .avatar {
    width: var(--icon-btn-size);
    min-width: var(--icon-btn-size);
    height: var(--icon-btn-size);
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
    height: var(--touch-target-min);
    min-height: var(--touch-target-min);
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

  /* The header keeps its dedicated Sign in button at >=1024px.
     Below that the header button is hidden, so Sign in moves into this menu. */
  .compact-only-auth {
    display: none;
  }

  @media (max-width: 1023px) {
    .compact-only-auth {
      display: block;
    }
  }

  .menu-item:hover {
    background-color: var(--hover-color);
  }

  .icon-box {
    position: relative;
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .icon-box .warning-badge {
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
  }

  .divider {
    height: 1px;
    background: var(--border-color);
    margin: 8px 16px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .avatar {
      width: 28px;
      height: 28px;
    }

    .avatar-btn.logged-in {
      height: var(--touch-target-min);
      min-height: var(--touch-target-min);
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
      width: var(--header-control-size);
      min-width: var(--header-control-size);
      height: var(--header-control-size);
    }
  }

  @media (max-width: 600px) {
    .dropdown-menu {
      position: fixed;
      top: var(--app-header-height);
      right: 0;
      left: 0;
      width: 100%;
      border-radius: 0;
      max-height: calc(100dvh - var(--app-header-height));
      height: auto;
      overflow-y: auto;
      border: none;
    }
  }

  @media (max-width: 480px) {
    .mobile-only-menu-item {
      display: flex;
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
</style>
