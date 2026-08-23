<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faCloud,
    faArrowsRotate,
    faFile,
  } from "@fortawesome/free-solid-svg-icons";
  import { faYoutube } from "@fortawesome/free-brands-svg-icons";

  let {
    status = "local",
    size = "sm",
    showText = false,
  }: {
    status: "local" | "synced" | "online" | "syncing";
    size?: "sm" | "md" | "lg";
    showText?: boolean;
  } = $props();

  const statusMap = {
    local: {
      icon: faFile,
      text: "Local (Offline)",
      color: "#ff9800",
      spin: false,
      title: "This playlist is only stored on this device and not synced to YouTube.",
    },
    synced: {
      icon: faCloud,
      text: "Synced",
      color: "#4caf50",
      spin: false,
      title: "This playlist is linked and up-to-date with your YouTube account.",
    },
    online: {
      icon: faYoutube,
      text: "YouTube Native",
      color: "#ff0000",
      spin: false,
      title: "This is a native YouTube playlist not managed by [YPH].",
    },
    syncing: {
      icon: faArrowsRotate,
      text: "Syncing...",
      color: "var(--primary-color)",
      spin: true,
      title: "Currently syncing changes with YouTube...",
    },
  };

  let current = $derived(statusMap[status]);
</script>

<div
  class="sync-indicator state-{status} size-{size}"
  class:has-text={showText}
  title={current.title}
>
  <div class="icon-wrapper" style="color: {current.color}">
    <Fa icon={current.icon} spin={current.spin} fw />
  </div>
  {#if showText}
    <span class="status-text">{current.text}</span>
  {/if}
</div>

<style>
  .sync-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.75);
    padding: 4px;
    border-radius: 50%;
    z-index: 10;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.2s ease;
  }

  .sync-indicator.has-text {
    padding: 4px 10px;
    border-radius: 20px;
    background: var(--hover-color);
    border: 1px solid var(--border-color);
  }

  :global([data-theme="dark"]) .sync-indicator.has-text {
    background: rgba(255, 255, 255, 0.05);
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .status-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
    white-space: nowrap;
  }

  /* Sizes */
  .size-sm {
    width: 24px;
    height: 24px;
  }
  .size-sm.has-text {
    width: auto;
    height: 28px;
  }
  .size-sm :global(svg) {
    font-size: 11px;
  }

  .size-md {
    width: 32px;
    height: 32px;
  }
  .size-md.has-text {
    width: auto;
    height: 36px;
  }
  .size-md :global(svg) {
    font-size: 14px;
  }

  .size-lg {
    width: 40px;
    height: 40px;
  }
  .size-lg.has-text {
    width: auto;
    height: 44px;
  }
  .size-lg :global(svg) {
    font-size: 18px;
  }

  /* State specific adjustments */
  .state-syncing .icon-wrapper {
    animation: rotate 2s linear infinite;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
