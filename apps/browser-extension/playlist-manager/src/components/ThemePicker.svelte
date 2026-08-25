<script lang="ts">
  import Fa from "svelte-fa";
  import { faPalette, faChevronRight } from "@fortawesome/free-solid-svg-icons";
  import { theme } from "../stores/theme.store.js";
  import type { ThemeChoice } from "../types/model.js";

  let { onClose = () => {} }: { onClose?: () => void } = $props();

  let showThemeCard = $state(false);

  function getThemeLabel(t: ThemeChoice): string {
    if (t === "device") return "Device theme";
    return t === "dark" ? "Dark" : "Light";
  }

  function toggleThemeCard(event: MouseEvent) {
    event.stopPropagation();
    showThemeCard = !showThemeCard;
  }

  function selectTheme(choice: ThemeChoice, event: MouseEvent) {
    event.stopPropagation();
    theme.set(choice);
    showThemeCard = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (showThemeCard && event.key === "Escape") {
      showThemeCard = false;
    }
  }

  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
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
  <div class="theme-card" role="dialog" aria-labelledby="theme-card-title">
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

<style>
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
</style>
