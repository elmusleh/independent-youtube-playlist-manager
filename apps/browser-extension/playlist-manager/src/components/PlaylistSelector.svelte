<script lang="ts">
  import type { Playlist } from "../types/model.js";
  import PlaylistPreview from "./PlaylistPreview.svelte";
  import PlaylistsFilters from "./PlaylistsFilters.svelte";

  let { playlists }: { playlists: Playlist[] } = $props();
  let filteredPlaylists = $state([] as Playlist[]);

  let disableThumbnails = $state(false);
  window.getSettings().then((settings) => {
    disableThumbnails = settings.disableThumbnails;
  }).catch(async (e) => {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[PLAYLIST-SELECTOR] Failed to load settings:", e);
    if (window.logSystemEvent) await window.logSystemEvent("ERROR", `[PLAYLIST-SELECTOR] Failed to load settings: ${errMsg}`);
  });
</script>

<div class="selector-container">
  {#if playlists.length > 0}
    <div class="filters-wrapper">
      <PlaylistsFilters bind:playlists bind:filteredPlaylists />
    </div>
  {/if}

  <div class="playlist-grid">
    {#each filteredPlaylists as playlist (playlist.id)}
      <PlaylistPreview {playlist} {disableThumbnails} />
    {:else}
      <div class="empty-state">
        <p>No playlists found. Create a new one to get started!</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .selector-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .filters-wrapper {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 12px;
  }

  .playlist-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 20px;
    width: 100%;
    padding: 20px;
    box-sizing: border-box;
  }

  @media (max-width: 580px) {
    .playlist-grid {
      justify-content: flex-start;
      padding: 16px;
    }
  }

  @media (max-width: 768px) {
    .empty-state {
      padding: 24px 0;
    }
  }

  .empty-state {
    width: 100%;
    text-align: center;
    padding: 48px 0;
    color: var(--text-muted);
    font-size: 16px;
  }
</style>
