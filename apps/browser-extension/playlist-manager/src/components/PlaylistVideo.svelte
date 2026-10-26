<script lang="ts">
  import SimpleButton from "./SimpleButton.svelte";
  import ArchivedThumbnail from "./ArchivedThumbnail.svelte";
  import type { Video } from "../types/model.js";
  import { requestConfirm } from "../stores/confirmation.js";
  import Fa from "svelte-fa";
  import {
    faGripVertical,
    faTrash,
    faArrowUpRightFromSquare,
    faPlay,
    faSpinner,
  } from "@fortawesome/free-solid-svg-icons";

  let {
    video,
    active,
    disableThumbnails = false,
    selectable = false,
    selected = false,
    playlistId = undefined,
    ondelete,
    ontoggleSelect,
    onplayfromhere,
    onmove,
    canMoveUp = false,
    canMoveDown = false,
  }: {
    video: Video;
    active: boolean;
    disableThumbnails?: boolean;
    selectable?: boolean;
    selected?: boolean;
    playlistId?: string | undefined;
    ondelete?: (video: Video) => void;
    ontoggleSelect?: (video: Video) => void;
    onplayfromhere?: (video: Video) => void;
    onmove?: (direction: -1 | 1) => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
  } = $props();

  function videoClicked() {
    if (selectable) {
      toggleSelect();
      return;
    }

    let url = video.url;
    if (playlistId && playlistId.startsWith("local-")) {
      url += `#yph_local_list=${playlistId}`;
    }

    window.open(url, "_blank");
  }

  function toggleSelect(e?: Event) {
    if (e) e.stopPropagation();
    if (ontoggleSelect) ontoggleSelect(video);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      videoClicked();
    }
  }

  function requestDeleteVideo(e: Event) {
    e.stopPropagation();
    requestConfirm({
      title: "Remove video?",
      message: `Are you sure you want to remove "${video.title}"?`,
      color: "danger",
      onConfirm: () => deleteVideo(),
    });
  }

  function deleteVideo() {
    if (ondelete) ondelete(video);
  }

  function formatDuration(duration: string | number | undefined): string {
    if (!duration) return "";
    if (duration === "LIVE") return "LIVE";
    let seconds = 0;

    if (typeof duration === "string" && duration.startsWith("PT")) {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const h = parseInt(match[1] || "0", 10);
        const m = parseInt(match[2] || "0", 10);
        const s = parseInt(match[3] || "0", 10);
        seconds = h * 3600 + m * 60 + s;
      }
    } else if (typeof duration === "number") {
      seconds = duration;
    }

    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatViews(views: number | undefined): string {
    if (views === undefined || views === null) return "";
    if (views >= 1000000000) return (views / 1000000000).toFixed(1) + "B views";
    if (views >= 1000000) return (views / 1000000).toFixed(1) + "M views";
    if (views >= 1000) return (views / 1000).toFixed(1) + "K views";
    return views + " views";
  }

  function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 30) return `${diffDays} days ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch (e) {
      return "";
    }
  }
</script>

<div
  class="playlist-video"
  class:is-active={active}
  class:is-selected={selected}
  onclick={videoClicked}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
>
  {#if selectable}
    <div class="check-cell">
      <input
        aria-label="Select video"
        type="checkbox"
        checked={selected}
        onchange={() => toggleSelect()}
        onclick={(e) => e.stopPropagation()}
      />
    </div>
  {:else}
    <div class="drag-handle" title="Drag to reorder">
      <Fa icon={faGripVertical} />
    </div>
  {/if}
  {#if !disableThumbnails}
    <div class="thumbnail-wrapper" class:is-enriching={video.isEnriching && !video.title}>
      <ArchivedThumbnail
        alt={video.title || "Video thumbnail"}
        src={video.thumbnailUrl}
        videoId={video.videoId}
      />
      {#if video.isLive}
        <span class="status-badge live-badge">LIVE</span>
      {:else if video.isPrivate}
        <span class="status-badge private-badge">Private</span>
      {:else if video.isDeleted}
        <span class="status-badge deleted-badge">Deleted</span>
      {:else if video.durationISO || video.duration || video.durationSeconds}
        <span class="duration-badge"
          >{formatDuration(video.durationISO || video.duration || video.durationSeconds)}</span
        >
      {/if}
    </div>
  {/if}
  <div class="video-details">
    {#if !video.title && video.isEnriching}
      <div class="loading-info">
        <Fa icon={faSpinner} spin /> Loading video info...
      </div>
      <div class="skeleton-shimmer skeleton-title"></div>
      <div class="skeleton-shimmer skeleton-channel"></div>
    {:else if !video.title}
      <div class="skeleton-shimmer skeleton-title"></div>
      <div class="skeleton-shimmer skeleton-channel"></div>
    {:else}
      <span class="video-title" title={video.title}>{video.title}</span>
      <div class="video-meta">
        <span class="video-channel" title={video.channel}>{video.channel}</span>
        {#if video.viewCount || video.publishedAt}
          <span class="video-stats">
            <span class="stat-separator">•</span>
            {#if video.viewCount}
              <span>{formatViews(video.viewCount)}</span>
            {/if}
            {#if video.viewCount && video.publishedAt}
              <span class="stat-separator">•</span>
            {/if}
            {#if video.publishedAt}
              <span>{formatDate(video.publishedAt)}</span>
            {/if}
          </span>
        {/if}
      </div>
    {/if}
  </div>
  {#if !selectable}
    <div class="video-btns">
      {#if onmove}
        <button
          type="button"
          class="move-btn"
          aria-label="Move video up"
          disabled={!canMoveUp}
          onclick={(e) => {
            e.stopPropagation();
            onmove?.(-1);
          }}>↑</button
        >
        <button
          type="button"
          class="move-btn"
          aria-label="Move video down"
          disabled={!canMoveDown}
          onclick={(e) => {
            e.stopPropagation();
            onmove?.(1);
          }}>↓</button
        >
      {/if}
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        class="video-link-btn"
        title="Open in new tab (Ctrl+Click or Middle Click)"
        onclick={(e) => e.stopPropagation()}
      >
        <Fa icon={faArrowUpRightFromSquare} fw />
      </a>
      {#if onplayfromhere}
        <SimpleButton
          onclick={(e) => {
            e.stopPropagation();
            onplayfromhere(video);
          }}
          title="Play from here"><Fa icon={faPlay} fw /></SimpleButton
        >
      {/if}
      <SimpleButton onclick={requestDeleteVideo} title="Delete video"
        ><Fa icon={faTrash} fw /></SimpleButton
      >
    </div>
  {/if}
</div>

<style>
  .move-btn {
    width: var(--icon-btn-size);
    min-height: var(--icon-btn-size);
    padding: 0;
    margin: 0;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .move-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .move-btn:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  .playlist-video {
    display: flex;
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    align-items: center;
    gap: var(--space-2);
    position: relative;
    user-select: none;
    min-height: var(--touch-target-min);
  }

  .playlist-video:hover {
    background-color: var(--color-bg-hover);
  }

  .playlist-video.is-selected {
    background-color: var(--color-bg-active);
  }

  .playlist-video.is-active {
    background-color: var(--color-brand-primary);
    color: var(--color-text-inverse);
  }

  .drag-handle {
    width: var(--icon-btn-size);
    height: var(--icon-btn-size);
    color: var(--color-text-muted);
    cursor: grab;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--transition-base);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .playlist-video:hover .drag-handle {
    opacity: 1;
  }

  .check-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-btn-size);
    flex-shrink: 0;
  }

  .check-cell input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-brand-primary);
  }

  .thumbnail-wrapper {
    position: relative;
    display: inline-block;
    width: var(--row-thumb-width);
    height: var(--row-thumb-height);
    flex-shrink: 0;
  }

  .thumbnail-wrapper :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: var(--radius-sm);
    display: block;
  }

  .duration-badge {
    position: absolute;
    bottom: var(--space-1);
    right: var(--space-1);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    padding: var(--space-0) var(--space-1);
    border-radius: var(--radius-sm);
    line-height: 1;
    pointer-events: none;
  }

  .status-badge {
    position: absolute;
    bottom: var(--space-1);
    right: var(--space-1);
    color: white;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    padding: var(--space-0) var(--space-1);
    border-radius: var(--radius-sm);
    line-height: 1;
    pointer-events: none;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .live-badge {
    background-color: #e50914;
    animation: pulse-live 2s infinite;
  }

  .private-badge {
    background-color: #4a5568;
  }

  .deleted-badge {
    background-color: #c53030;
  }

  @keyframes pulse-live {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      rgba(150, 150, 150, 0.1) 25%,
      rgba(150, 150, 150, 0.25) 50%,
      rgba(150, 150, 150, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-sm);
  }

  .skeleton-title {
    height: 16px;
    width: 75%;
    margin-bottom: var(--space-2);
  }

  .skeleton-channel {
    height: 12px;
    width: 40%;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .thumbnail-wrapper.is-enriching :global(img) {
    opacity: 0.35;
    filter: blur(1px);
  }

  .loading-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin-bottom: var(--space-2);
  }

  .video-details {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 var(--space-2);
    font-size: var(--font-size-md);
    min-width: 0;
  }

  .video-details > span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .video-title {
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-md);
    margin-bottom: var(--space-1);
  }

  .video-channel {
    color: var(--color-text-muted);
  }

  .video-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .video-stats {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    opacity: 0.8;
  }

  .stat-separator {
    margin: 0 var(--space-1);
    opacity: 0.6;
  }

  .video-btns {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-left: var(--space-3);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--transition-base);
    gap: var(--space-1);
  }

  .video-link-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-btn-size);
    height: var(--icon-btn-size);
    border-radius: 50%;
    color: var(--color-text-muted);
    text-decoration: none;
    transition: all var(--transition-base);
  }

  .video-link-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-brand-primary);
  }

  .video-link-btn:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  .playlist-video:hover .video-btns {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .playlist-video {
      display: grid;
      grid-template-columns: var(--icon-btn-size) minmax(0, var(--row-thumb-width-mobile)) minmax(
          0,
          1fr
        );
      padding: var(--space-2);
      gap: var(--space-3);
    }

    .thumbnail-wrapper {
      grid-column: 2;
      width: var(--row-thumb-width-mobile);
      height: var(--row-thumb-height-mobile);
    }

    .duration-badge {
      font-size: 10px;
      padding: 1px 3px;
      bottom: 2px;
      right: 2px;
    }

    .video-details {
      grid-column: 3;
      font-size: var(--font-size-sm);
    }

    .video-details > .video-title {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .drag-handle,
    .video-btns {
      opacity: 1;
    }
    .video-btns {
      grid-column: 1 / -1;
      justify-content: flex-end;
      width: 100%;
    }
    .video-link-btn,
    .move-btn {
      min-width: var(--touch-target-min);
    }
  }

  @media (max-width: 480px) {
    .video-link-btn {
      width: var(--icon-btn-size);
      height: var(--icon-btn-size);
    }
  }

  /* Touch target enforcement for mobile */
  @media (pointer: coarse), (max-width: 767px) {
    .move-btn,
    .video-link-btn,
    .playlist-video .video-btns > * {
      min-width: var(--touch-target-min);
      min-height: var(--touch-target-min);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-shimmer {
      animation: none;
    }
    .live-badge {
      animation: none;
    }
  }
</style>
