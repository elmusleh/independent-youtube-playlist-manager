<script lang="ts">
  import SimpleButton from "./SimpleButton.svelte";
  import type { Video } from "../types/model.js";
  import { requestConfirm } from "../stores/confirmation.js";
  import Fa from "svelte-fa";
  import {
    faGripVertical,
    faTrash,
    faArrowUpRightFromSquare,
    faPlay,
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
    if (event.key === "Enter" || event.key === " ") {
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
    <div class="thumbnail-wrapper">
      <img alt={video.title || "Video thumbnail"} src={video.thumbnailUrl} />
      {#if video.isLive}
        <span class="status-badge live-badge">LIVE</span>
      {:else if video.isPrivate}
        <span class="status-badge private-badge">Private</span>
      {:else if video.isDeleted}
        <span class="status-badge deleted-badge">Deleted</span>
      {:else if video.duration || video.durationSeconds}
        <span class="duration-badge">{formatDuration(video.duration || video.durationSeconds)}</span
        >
      {/if}
    </div>
  {/if}
  <div class="video-details">
    {#if !video.title}
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
  .playlist-video {
    display: flex;
    padding: 0.5em 1em;
    cursor: pointer;
    align-items: center;
    gap: 8px;
    position: relative;
    user-select: none;
  }

  .playlist-video:hover {
    background-color: var(--hover-color);
  }

  .playlist-video.is-selected {
    background-color: var(--active-bg-color);
  }

  .playlist-video.is-active {
    background-color: var(--primary-color);
    color: #fff;
  }

  .drag-handle {
    width: 24px;
    height: 24px;
    color: var(--text-muted);
    cursor: grab;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .playlist-video:hover .drag-handle {
    opacity: 1;
  }

  .check-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    flex-shrink: 0;
  }

  .check-cell input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary-color);
  }

  .thumbnail-wrapper {
    position: relative;
    display: inline-block;
    width: 120px;
    height: 65px;
    flex-shrink: 0;
  }

  .thumbnail-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }

  .duration-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 11px;
    font-weight: 500;
    padding: 2px 4px;
    border-radius: 4px;
    line-height: 1;
    pointer-events: none;
  }

  .status-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 4px;
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
    border-radius: 4px;
  }

  .skeleton-title {
    height: 16px;
    width: 75%;
    margin-bottom: 6px;
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

  .video-details {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 0.5em;
    font-size: 14px;
    min-width: 0;
  }

  .video-details > span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .video-title {
    font-weight: bold;
    font-size: 15px;
    margin-bottom: 2px;
  }

  .video-channel {
    color: var(--text-muted);
  }

  .video-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .video-stats {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0.8;
  }

  .stat-separator {
    margin: 0 2px;
    opacity: 0.6;
  }

  .video-btns {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-left: 10px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.2s;
    gap: 4px;
  }

  .video-link-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text-muted);
    text-decoration: none;
    transition: all 0.2s;
  }

  .video-link-btn:hover {
    background: var(--hover-color);
    color: var(--primary-color);
  }

  .playlist-video:hover .video-btns {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .playlist-video {
      padding: 0.5em;
      gap: 10px;
    }

    .thumbnail-wrapper {
      width: 80px;
      height: 45px;
    }

    .duration-badge {
      font-size: 10px;
      padding: 1px 3px;
      bottom: 2px;
      right: 2px;
    }

    .video-details {
      font-size: 13px;
    }

    .video-title {
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
  }

  @media (max-width: 480px) {
    .video-link-btn {
      width: 28px;
      height: 28px;
    }
  }
</style>
