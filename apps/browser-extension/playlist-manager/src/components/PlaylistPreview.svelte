<script lang="ts">
  import { faPlay, faFile } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
  import type { Playlist } from "../types/model.js";

  const videoService = window.videoService;

  let { playlist, disableThumbnails = false }: { playlist: Playlist; disableThumbnails?: boolean } =
    $props();
  const videos = $derived(playlist.videos);

  async function previewClicked() {
    videoService.openPlaylistEditor(playlist);
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
</script>

<button type="button" class="playlist-card" onclick={previewClicked}>
  <div class="thumbnail-container">
    {#if !disableThumbnails && videos.length > 0}
      <img
        alt={playlist.title}
        class="main-thumbnail"
        src={videoService.getVideoThumbnailUrl(videos[0])}
        loading="lazy"
        decoding="async"
      />
    {:else}
      <div class="placeholder-thumbnail">
        <Fa icon={faPlay} size="2x" />
      </div>
    {/if}
    <div class="overlay">
      <div class="count-badge">
        <span class="count">{playlist.videos.length}</span>
        <Fa icon={faPlay} size="sm" />
      </div>
      <div class="play-all">
        <Fa icon={faPlay} />
        <span>PLAY ALL</span>
      </div>
    </div>
    {#if playlist.isLocal}
      <div class="local-badge" title="Stored locally (Offline)">
        <Fa icon={faFile} size="xs" />
        <span>OFFLINE</span>
      </div>
    {/if}
  </div>
  <div class="details">
    <h3 class="title" title={playlist.title}>{playlist.title}</h3>
    <div class="metadata">
      <span>Updated {formatDate(playlist.timestamp)}</span>
      <span class="view-playlist">VIEW FULL PLAYLIST</span>
    </div>
  </div>
</button>

<style>
  .playlist-card {
    display: flex;
    flex-direction: column;
    flex: 1 1 250px;
    max-width: 320px;
    cursor: pointer;
    gap: 12px;
    transition: transform 0.2s;
    box-sizing: border-box;
    align-self: flex-start;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    font: inherit;
    color: inherit;
  }

  @media (max-width: 580px) {
    .playlist-card {
      max-width: 100%;
      flex: 1 1 100%;
    }
  }

  .playlist-card:hover .play-all {
    opacity: 1;
  }

  .thumbnail-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    overflow: hidden;
    background-color: #272727;
  }

  .main-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-thumbnail {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #606060;
  }

  .overlay {
    position: absolute;
    top: 0;
    right: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .thumbnail-container:hover .overlay {
    opacity: 1;
  }

  .count-badge {
    position: absolute;
    right: 8px;
    bottom: 8px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .play-all {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .local-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: #ff9800;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 9px;
    font-weight: 800;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metadata {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .view-playlist {
    font-weight: 500;
    margin-top: 4px;
    color: var(--text-muted);
  }

  .view-playlist:hover {
    color: var(--text-color);
  }
</style>
