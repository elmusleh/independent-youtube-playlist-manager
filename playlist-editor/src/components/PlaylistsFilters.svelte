<script lang="ts">
  import { get } from "svelte/store";
  import { getPlaylistsSorter } from "../services/playlists-sorter.js";
  import {
    playlistsSearch,
    playlistsSorting,
  } from "../stores/playlists-filters.js";
  import type { Playlist, PlaylistsSorting } from "../types/model.js";

  let { playlists = $bindable([]), filteredPlaylists = $bindable([]) }: {
    playlists: Playlist[];
    filteredPlaylists: Playlist[];
  } = $props();

  let sortBy = $state(get(playlistsSorting));
  let search = $state(get(playlistsSearch));

  $effect(() => {
    filteredPlaylists = playlists.sort(getPlaylistsSorter(sortBy));
    const keywords = search
      .split(/\s+/)
      .filter((k) => k.length)
      .map((k) => k.toLowerCase());
    if (keywords.length) {
      filteredPlaylists = filteredPlaylists.filter((playlist) =>
        keywords.every((k) => playlist.title.toLowerCase().includes(k)),
      );
    }
  });

  const sortOptions: Record<PlaylistsSorting, string> = {
    "date-created-desc": "Date created (descending)",
    "date-created-asc": "Date created (ascending)",
    "title-az": "Title (A -> Z)",
    "title-za": "Title (Z -> A)",
  };

  function sortingChanged() {
    playlistsSorting.set(sortBy);
  }

  function searchChanged() {
    playlistsSearch.set(search);
  }
</script>

<aside>
  <div class="count-wrapper">
    <h2>
      {filteredPlaylists.length} playlist{filteredPlaylists.length > 1
        ? "s"
        : ""}
    </h2>
  </div>
  <div class="search-wrapper">
    <label>
      <span>Search</span>
      <input aria-label="Filter playlists"
        type="text"
        placeholder="Filter playlists..."
        bind:value={search}
        oninput={searchChanged}
      />
    </label>
  </div>
  <div class="sort-wrapper">
    <label>
      <span>Sort by</span>
      <select bind:value={sortBy} onchange={sortingChanged}>
        {#each Object.entries(sortOptions) as [value, label]}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
  </div>
</aside>

<style>
  aside {
    padding: 1rem 0;
    position: sticky;
    top: 0;
    background-color: var(--background-color);
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    z-index: 10;
    box-sizing: border-box;
  }

  .count-wrapper h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .search-wrapper,
  .sort-wrapper {
    flex: 1 1 100%;
    min-width: 0;
    width: 100%;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    width: 100%;
  }

  label span {
    white-space: nowrap;
    font-weight: 500;
  }

  input,
  select {
    flex: 1;
    margin: 0 !important;
  }

  @media (max-width: 768px) {
    aside {
      flex-direction: column;
      align-items: stretch;
      position: static;
      gap: 12px;
    }

    .count-wrapper h2 {
      text-align: center;
    }

    .search-wrapper,
    .sort-wrapper {
      width: 100%;
    }
  }
</style>
