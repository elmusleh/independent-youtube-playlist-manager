<script lang="ts">
  import Fa from "svelte-fa";
  import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";

  interface BadgeInfo {
    label: string;
    color: string;
    title: string;
    textColor: string;
  }

  interface Props {
    category?: string;
    title?: string;
    clickable?: boolean;
    overlay?: boolean;
    status?: "local" | "synced" | "online" | "syncing";
    onclick?: () => void;
  }

  const {
    category,
    title: titleProp,
    clickable = false,
    overlay = false,
    status,
    onclick,
  }: Props = $props();

  function getBadge(category?: string): BadgeInfo | null {
    switch (category) {
      case "local":
        return {
          label: "Local",
          color: "var(--color-brand-primary)",
          title: "Stored only on this device; not synced to YouTube.",
          textColor: "#ffffff",
        };
      case "youtube":
        return {
          label: "YouTube",
          color: "var(--color-brand-danger)",
          title: "Managed/imported YouTube playlist.",
          textColor: "#ffffff",
        };
      case "liked":
        return {
          label: "Liked",
          color: "var(--color-brand-pink)",
          title: "Your Liked Videos playlist.",
          textColor: "#000000",
        };
      case "uploaded":
        return {
          label: "Uploaded",
          color: "var(--color-brand-purple)",
          title: "Your uploaded videos playlist.",
          textColor: "#ffffff",
        };
      case "account":
        return {
          label: "Account",
          color: "var(--color-brand-warning)",
          title: "Native YouTube playlist on your account.",
          textColor: "#000000",
        };
      default:
        return null;
    }
  }

  const badge = $derived(getBadge(category));
  const resolvedTitle = $derived(titleProp || badge?.title || "");
</script>

{#if status === "syncing"}
  <div
    class="category-badge overlay"
    style="background-color: var(--color-brand-primary); color: #ffffff"
    title="Currently syncing changes with YouTube."
    role="status"
    aria-label="Syncing"
  >
    <Fa icon={faArrowsRotate} spin fw />
  </div>
{:else if badge}
  {#if clickable && onclick}
    <button
      type="button"
      class="category-badge"
      class:overlay
      style="background-color: {badge.color}; color: {badge.textColor}"
      title={resolvedTitle}
      aria-label="{badge.label}: {resolvedTitle}"
      {onclick}
    >
      {badge.label}
    </button>
  {:else}
    <div
      class="category-badge"
      class:overlay
      style="background-color: {badge.color}; color: {badge.textColor}"
      title={resolvedTitle}
      aria-label="{badge.label}: {resolvedTitle}"
      role="img"
    >
      {badge.label}
    </div>
  {/if}
{/if}

<style>
  .category-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    color: #ffffff;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.4;
    border: none;
    cursor: inherit;
  }

  button.category-badge {
    cursor: pointer;
  }

  button.category-badge:hover {
    filter: brightness(1.08);
  }

  .category-badge.overlay {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    z-index: 2;
  }

  button.category-badge:focus-visible {
    outline: 2px solid var(--color-border-focus, #fff);
    outline-offset: 2px;
  }
</style>
