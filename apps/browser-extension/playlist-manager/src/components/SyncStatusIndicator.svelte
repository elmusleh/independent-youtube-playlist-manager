<script lang="ts">
  import Fa from "svelte-fa";
  import { faCloud, faArrowsRotate, faFile } from "@fortawesome/free-solid-svg-icons";
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
      color: "var(--color-brand-warning)",
      spin: false,
      title: "This playlist is only stored on this device and not synced to YouTube.",
    },
    synced: {
      icon: faCloud,
      text: "Synced",
      color: "var(--color-brand-success)",
      spin: false,
      title: "This playlist is linked and up-to-date with your YouTube account.",
    },
    online: {
      icon: faYoutube,
      text: "YouTube Native",
      color: "var(--color-brand-danger)",
      spin: false,
      title: "This is a native YouTube playlist not managed by the extension.",
    },
    syncing: {
      icon: faArrowsRotate,
      text: "Syncing...",
      color: "var(--color-brand-primary)",
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
    gap: var(--space-2);
    background: rgba(0, 0, 0, 0.75);
    padding: var(--space-1);
    border-radius: 50%;
    z-index: 10;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all var(--transition-base) ease;
  }

  .sync-indicator.has-text {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--color-bg-hover);
    border: 1px solid var(--color-border-primary);
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
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    white-space: nowrap;
  }

  /* Sizes */
  .size-sm {
    width: var(--icon-btn-size);
    height: var(--icon-btn-size);
  }
  .size-sm.has-text {
    width: auto;
    height: var(--input-height);
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
    height: var(--touch-target-min);
  }
  .size-md :global(svg) {
    font-size: 14px;
  }

  .size-lg {
    width: var(--touch-target-min);
    height: var(--touch-target-min);
  }
  .size-lg.has-text {
    width: auto;
    height: var(--touch-target-comfortable);
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

  /* Touch target enforcement for mobile */
  @media (pointer: coarse), (max-width: 767px) {
    .size-sm {
      width: var(--touch-target-min);
      height: var(--touch-target-min);
    }
    .size-sm.has-text {
      height: var(--touch-target-min);
    }
    .size-md {
      width: var(--touch-target-min);
      height: var(--touch-target-min);
    }
    .size-md.has-text {
      height: var(--touch-target-comfortable);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .state-syncing .icon-wrapper {
      animation: none;
    }
  }
</style>
