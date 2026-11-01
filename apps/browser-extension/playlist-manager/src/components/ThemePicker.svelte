<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faPalette,
    faChevronRight,
    faMoon,
    faSun,
    faLaptop,
    faCheck,
  } from "@fortawesome/free-solid-svg-icons";
  import { theme } from "../stores/theme.store.js";
  import type { ThemeChoice } from "../types/model.js";

  let {
    onClose = () => {},
    onSubmenuToggle = () => {},
  }: { onClose?: () => void; onSubmenuToggle?: (open: boolean) => void } = $props();

  let showThemeCard = $state(false);

  function getThemeLabel(t: ThemeChoice): string {
    if (t === "device") return "Device default";
    return t === "dark" ? "Dark" : "Light";
  }

  function toggleThemeCard(event: MouseEvent) {
    event.stopPropagation();
    const next = !showThemeCard;
    showThemeCard = next;
    onSubmenuToggle(next);
  }

  function selectTheme(choice: ThemeChoice, event: MouseEvent) {
    event.stopPropagation();
    theme.set(choice);
    showThemeCard = false;
    onSubmenuToggle(false);
    onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (showThemeCard && event.key === "Escape") {
      showThemeCard = false;
      onSubmenuToggle(false);
    }
  }

  $effect(() => {
    if (!showThemeCard) return;
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  // Close submenu when dropdown closes
  $effect(() => {
    if (!showThemeCard) return;
    return () => onSubmenuToggle(false);
  });
</script>

<button class="menu-item appearance-trigger" onclick={toggleThemeCard}>
  <div class="icon-box">
    <Fa icon={faPalette} fw />
  </div>
  <span>Appearance: {getThemeLabel($theme)}</span>
  <div class="chevron-right">
    <Fa icon={faChevronRight} size="xs" />
  </div>
</button>

{#if showThemeCard}
  <div class="theme-submenu" role="menu" aria-labelledby="theme-card-title">
    <div class="theme-card-header">
      <span id="theme-card-title">Appearance</span>
    </div>
    <div class="theme-options">
      <button
        class="theme-option"
        class:selected={$theme === "dark"}
        role="menuitemradio"
        aria-checked={$theme === "dark"}
        onclick={(e) => selectTheme("dark", e)}
      >
        <span class="opt-icon"><Fa icon={faMoon} fw /></span>
        <span>Dark</span>
        {#if $theme === "dark"}<span class="opt-check"><Fa icon={faCheck} /></span>{/if}
      </button>
      <button
        class="theme-option"
        class:selected={$theme === "light"}
        role="menuitemradio"
        aria-checked={$theme === "light"}
        onclick={(e) => selectTheme("light", e)}
      >
        <span class="opt-icon"><Fa icon={faSun} fw /></span>
        <span>Light</span>
        {#if $theme === "light"}<span class="opt-check"><Fa icon={faCheck} /></span>{/if}
      </button>
      <button
        class="theme-option"
        class:selected={$theme === "device"}
        role="menuitemradio"
        aria-checked={$theme === "device"}
        onclick={(e) => selectTheme("device", e)}
      >
        <span class="opt-icon"><Fa icon={faLaptop} fw /></span>
        <span>Device default</span>
        {#if $theme === "device"}<span class="opt-check"><Fa icon={faCheck} /></span>{/if}
      </button>
    </div>
  </div>
{/if}

<style>
  .appearance-trigger {
    position: relative;
  }

  /* Match the host dropdown's menu-item so the Appearance row reads the same
     as sibling entries (e.g. Keyboard shortcuts). */
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

  .icon-box {
    position: relative;
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .chevron-right {
    margin-left: auto;
    color: var(--text-muted);
    display: flex;
    align-items: center;
  }

  /* Submenu positioning - opens to the left of trigger in dropdown */
  .theme-submenu {
    position: absolute;
    top: 0;
    right: 100%;
    margin-right: 8px;
    min-width: 180px;
    background-color: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 2000;
    padding: 0;
    overflow: hidden;
    animation: scaleIn 0.1s ease-out;
    transform-origin: right center;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateX(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateX(0);
    }
  }

  :global([data-theme="dark"]) .theme-submenu {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    background-color: #282828;
  }

  .theme-card-header {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .theme-card-header span {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .theme-options {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
  }

  .theme-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background-color 0.1s ease;
  }

  .theme-option .opt-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    color: var(--text-muted);
  }

  .theme-option .opt-check {
    display: inline-flex;
    align-items: center;
    margin-left: auto;
    color: var(--primary-color);
    font-size: 12px;
  }

  .theme-option:hover {
    background-color: var(--hover-color);
  }

  .theme-option.selected {
    background-color: var(--active-bg-color);
    color: var(--primary-color);
    font-weight: 500;
  }

  .theme-option:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
  }

  /* Mobile: when dropdown is full-screen, submenu becomes bottom sheet */
  @media (max-width: 600px) {
    .theme-submenu {
      position: fixed;
      top: auto;
      right: auto;
      bottom: 0;
      left: 0;
      width: 100%;
      max-width: none;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
      z-index: 3000;
      margin-right: 0;
      transform-origin: bottom center;
      animation: slideUp 0.2s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(100%);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    :global([data-theme="dark"]) .theme-submenu {
      background-color: #1e1e1e;
    }
  }
</style>
