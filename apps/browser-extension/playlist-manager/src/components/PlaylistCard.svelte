<script lang="ts">
  import Fa from "svelte-fa";
  import { faListUl, faStar } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "./SimpleButton.svelte";
  import SyncStatusIndicator from "./SyncStatusIndicator.svelte";
  import type { Playlist } from "../types/model";

  interface Action {
    label: string;
    icon?: any;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  }

  interface Props {
    id: string;
    title: string;
    thumbnailUrl?: string;
    videoCount: number;
    isTagged?: boolean;
    isLocal?: boolean;
    status?: "syncing" | "synced" | "local" | "online";
    showFavoriteBadge?: boolean;
    onOpen: () => void;
    actions?: Action[];
    category?: string;
  }

  const {
    id,
    title,
    thumbnailUrl,
    videoCount,
    isTagged = false,
    isLocal = false,
    status = isLocal ? "local" : isTagged ? "synced" : "online",
    showFavoriteBadge = false,
    onOpen,
    actions = [],
    category,
  }: Props = $props();

  function getCategoryBadge(category?: string) {
    switch (category) {
      case "local":
        return { label: "Local", color: "var(--color-brand-primary)" };
      case "youtube":
        return { label: "YouTube", color: "var(--color-brand-danger)" };
      case "liked":
        return { label: "Liked", color: "var(--color-brand-pink)" };
      case "uploaded":
        return { label: "Uploaded", color: "var(--color-brand-purple)" };
      case "account":
        return { label: "Account", color: "var(--color-brand-warning)" };
      default:
        return null;
    }
  }

  const badge = $derived(getCategoryBadge(category));
</script>

<div class="playlist-card">
  <button type="button" class="playlist-thumbnail" onclick={onOpen} aria-label="Open {title}">
    {#if thumbnailUrl}
      <img src={thumbnailUrl} alt={title} class="thumbnail-img" />
    {:else}
      <div class="thumbnail-placeholder">
        <Fa icon={faListUl} size="2x" />
      </div>
    {/if}
    <div class="view-overlay" aria-hidden="true">
      <span class="view-overlay-text">View Full Playlist</span>
    </div>
    <div class="video-count-overlay" aria-hidden="true">
      <Fa icon={faListUl} fw />
      {videoCount}
    </div>
    <div class="status-overlay">
      <SyncStatusIndicator {status} size="sm" />
    </div>
    {#if showFavoriteBadge}
      <div class="favorite-overlay">
        <div class="favorite-badge"><Fa icon={faStar} fw /></div>
      </div>
    {/if}
    {#if badge}
      <div class="category-badge" style="background-color: {badge.color}">
        {badge.label}
      </div>
    {/if}
  </button>
  <div class="playlist-details">
    <div class="playlist-title-row">
      <button class="playlist-title" onclick={onOpen}>
        {title || "Untitled Playlist"}
      </button>
      {#if showFavoriteBadge}
        <span class="fav-star-inline" title="Favorite Playlist" aria-label="Favorite Playlist">
          <Fa icon={faStar} fw />
        </span>
      {/if}
    </div>
    <div class="playlist-actions">
      {#each actions as action}
        <SimpleButton
          secondary
          onclick={action.onClick}
          disabled={action.disabled}
          title={action.label}
        >
          {#if action.icon}
            <Fa icon={action.icon} fw />
          {/if}
          <span>{action.loading ? "Loading…" : action.label}</span>
        </SimpleButton>
      {/each}
    </div>
  </div>
</div>

<style>
  .playlist-card {
    flex: 0 1 var(--card-min-width);
    max-width: var(--card-min-width);
    border-radius: var(--radius-card);
    overflow: hidden;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    transition:
      box-shadow var(--transition-base),
      transform var(--transition-base);
    display: flex;
    flex-direction: column;
  }

  .playlist-card:hover {
    box-shadow: var(--color-shadow-lg);
    transform: translateY(-4px);
  }

  .playlist-thumbnail {
    position: relative;
    aspect-ratio: 16 / 9;
    width: 100%;
    background: var(--color-bg-secondary);
    cursor: pointer;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    padding: 0;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-placeholder {
    color: var(--color-text-muted);
  }

  .view-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity var(--transition-base) ease;
  }

  .playlist-thumbnail:hover .view-overlay {
    opacity: 1;
  }

  .view-overlay-text {
    color: var(--color-text-inverse);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    background: rgba(0, 0, 0, 0.45);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    border: 1px solid rgba(255, 255, 255, 0.25);
  }

  .video-count-overlay {
    position: absolute;
    bottom: var(--space-2);
    right: var(--space-2);
    background: rgba(0, 0, 0, 0.85);
    color: var(--color-text-inverse);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    z-index: 1;
  }

  .playlist-details {
    padding: var(--space-3);
  }

  .playlist-title-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .playlist-title {
    margin: 0;
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-bold);
    line-height: 1.4;
    height: 40px;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    background: none;
    border: none;
    color: var(--color-text-primary);
    padding: 0;
    text-align: left;
  }

  .status-overlay {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    z-index: 2;
  }

  .favorite-overlay {
    position: absolute;
    bottom: var(--space-2);
    left: var(--space-2);
    z-index: 3;
  }

  .favorite-badge {
    background: var(--color-brand-warning);
    color: var(--color-text-inverse);
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    box-shadow: var(--color-shadow-md);
  }

  .fav-star-inline {
    color: var(--color-brand-warning);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
    padding-top: 3px;
    pointer-events: none;
  }

  .category-badge {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    color: var(--color-text-inverse);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    z-index: 2;
  }

  .playlist-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .playlist-card {
      flex: 1 1 100%;
      max-width: 100%;
    }

    .playlist-actions {
      gap: var(--space-2);
    }

    .playlist-actions :global(.btn span) {
      font-size: var(--font-size-sm);
    }
  }

  /* Touch target enforcement for mobile */
  @media (pointer: coarse), (max-width: 767px) {
    .playlist-actions :global(.btn) {
      min-height: var(--touch-target-comfortable);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .playlist-card {
      transition: none;
    }
    .playlist-card:hover {
      transform: none;
    }
    .view-overlay {
      transition: none;
    }
  }
</style>
