<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faSearch,
    faArrowUpRightFromSquare,
    faListUl,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import SkeletonCard from "../components/SkeletonCard.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import AuthPlaceholder from "../components/AuthPlaceholder.svelte";

  let signedIn = $state(false);
  const status = new StatusManager();
  let query = $state("");
  let results: {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    publishedAt: string;
  }[] = $state([]);

  async function checkAuth() {
    signedIn = await window.isSignedIn();
  }

  async function handleSearch() {
    if (!query.trim()) return;
    await status.refresh(async () => {
      results = await window.youtubeSearch(query);
    });
  }

  function openVideo(videoId: string) {
    const base = location.href.split("#")[0].split("?")[0];
    location.href = `${base}?id=${encodeURIComponent(videoId)}#/editor`;
  }

  let searchMessage = $derived(
    `No videos found for "${query}". Try a different search term.`,
  );

  checkAuth();
</script>

<main>
  <div class="view-header">
    <div class="top-left">
      <ViewHeader
        icon={faSearch}
        title="YouTube Search"
        count={results.length}
      />
    </div>
    <div class="btn-group right-align">
      {#if query && results.length > 0}
        <SimpleButton secondary onclick={() => { query = ""; results = []; }} title="Clear search">
          <Fa icon={faXmark} fw />
          <span>Clear</span>
        </SimpleButton>
      {/if}
      <SaveStatus
        onclick={handleSearch}
        {status}
        title="Refresh"
      />
    </div>
  </div>

  <div class="view-body">
    {#if !signedIn}
      <AuthPlaceholder />
    {:else}
      <div class="search-bar">
        <input
          type="text"
          bind:value={query}
          placeholder="Search for videos..."
          onkeydown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button class="search-btn" onclick={handleSearch} disabled={status.refreshing}>
          <Fa icon={faSearch} />
        </button>
      </div>

      {#if status.refreshing}
        <div class="playlist-grid">
          {#each Array(6) as _}
            <SkeletonCard />
          {/each}
        </div>
      {:else if results.length === 0 && query}
        <EmptyState
          icon={faSearch}
          title="No Results Found"
          message={searchMessage}
        />
      {:else}
        <div class="playlist-grid">
          {#each results as video}
            <div class="playlist-card">
              <button
                type="button"
                class="playlist-thumbnail"
                onclick={() => openVideo(video.videoId)}
              >
                {#if video.thumbnail}
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    class="thumbnail-img"
                  />
                {:else}
                  <div class="thumbnail-placeholder">
                    <Fa icon={faListUl} size="2x" />
                  </div>
                {/if}
                <div class="view-overlay">
                  <span class="view-overlay-text">View Video</span>
                </div>
              </button>
              <div class="playlist-details">
                <button
                  class="playlist-title"
                  onclick={() => openVideo(video.videoId)}
                >
                  {video.title}
                </button>
                <div class="playlist-meta">{video.channelTitle}</div>
                <div class="playlist-actions">
                  <SimpleButton
                    secondary
                    onclick={() => openVideo(video.videoId)}
                    title="Open in Editor"
                  >
                    <Fa icon={faArrowUpRightFromSquare} fw />
                    <span>Open</span>
                  </SimpleButton>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</main>

<style>

  .search-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }

  .search-bar input {
    flex: 1;
    height: 42px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-color);
  }

  .search-btn {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    border: none;
    background: #3ea6ff;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .playlist-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    padding: 20px 0;
  }

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

  .playlist-details {
    padding: 12px;
  }

  .playlist-title {
    margin: 0 0 4px 0;
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
    text-align: left;
    width: 100%;
    padding: 0;
  }

  .playlist-meta {
    font-size: 12px;
    opacity: 0.6;
    margin-bottom: 10px;
    color: var(--text-color);
  }

  .playlist-actions {
    display: flex;
  }


</style>
