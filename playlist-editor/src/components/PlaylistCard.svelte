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
        return { label: "Local", color: "#06b6d4" };
      case "youtube":
        return { label: "YouTube", color: "#ef4444" };
      case "liked":
        return { label: "Liked", color: "#ec4899" };
      case "uploaded":
        return { label: "Uploaded", color: "#8b5cf6" };
      case "account":
        return { label: "Account", color: "#f59e0b" };
      default:
        return null;
    }
  }

  const badge = $derived(getCategoryBadge(category));
</script>

<div class="playlist-card">
  <button
    type="button"
    class="playlist-thumbnail"
    onclick={onOpen}
    aria-label="Open {title}"
  >
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
    flex: 0 1 300px;
    max-width: 300px;
    border-radius: 12px;
    overflow: hidden;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    transition:
      box-shadow 0.2s,
      transform 0.2s;
    display: flex;
    flex-direction: column;
  }

  .playlist-card:hover {
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
    transform: translateY(-3px);
  }

  .playlist-thumbnail {
    position: relative;
    aspect-ratio: 16 / 9;
    width: 100%;
    background: #1a1a1a;
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
    color: #555;
  }

  .view-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .playlist-thumbnail:hover .view-overlay {
    opacity: 1;
  }

  .view-overlay-text {
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.45);
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.25);
  }

  .video-count-overlay {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 5px;
    z-index: 1;
  }

  .playlist-details {
    padding: 12px;
  }

  .playlist-title-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 10px;
  }

  .playlist-title {
    margin: 0;
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 700;
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
    color: var(--text-color);
    padding: 0;
    text-align: left;
  }

  .status-overlay {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
  }

  .favorite-overlay {
    position: absolute;
    bottom: 8px;
    left: 8px;
    z-index: 3;
  }

  .favorite-badge {
    background: rgba(255, 193, 7, 0.92);
    color: #111;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  }

  .fav-star-inline {
    color: #ffc107;
    font-size: 13px;
    flex-shrink: 0;
    padding-top: 3px;
    pointer-events: none;
  }

  .category-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    z-index: 2;
  }

  .playlist-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .playlist-card {
      flex: 1 1 100%;
      max-width: 100%;
    }

    .playlist-actions {
      gap: 6px;
    }

    .playlist-actions :global(.btn span) {
      font-size: 12px;
    }
  }
</style>
