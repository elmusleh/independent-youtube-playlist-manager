<script lang="ts">
  let {
    job,
    playlists,
    filteredPlaylists,
    searchQuery,
    selectedDestination,
    selectDestination,
    handleSearch,
  } = $props();

  const DESTINATION_TYPES = [
    {
      id: "favorite",
      label: "Favorite Playlist",
      icon: "faStar",
      description: "Your configured Watch Later playlist",
    },
    {
      id: "latest",
      label: "Latest Playlist",
      icon: "faClockRotateLeft",
      description: "Most recently modified playlist",
    },
    {
      id: "builder",
      label: "Playlist Builder",
      icon: "faListCheck",
      description: "Temporary builder for collecting videos",
    },
    {
      id: "new-local",
      label: "New Local Playlist",
      icon: "faPlus",
      description: "Create a new local playlist",
    },
    {
      id: "custom",
      label: "Choose Saved Playlist…",
      icon: "faFolderOpen",
      description: "Select from your saved playlists",
    },
  ];
</script>

<section class="destination-options">
  <h2>Quick Destinations</h2>
  <div class="destination-grid">
    {#each DESTINATION_TYPES as dest}
      <button
        class="destination-card {selectedDestination?.type === dest.id
          ? 'selected'
          : ''} {dest.id === 'custom' && !filteredPlaylists.length ? 'disabled' : ''}"
        onclick={() => selectDestination(dest.id)}
        disabled={dest.id === "custom" && !filteredPlaylists.length}
      >
        <i class="fa-solid {dest.icon} destination-icon"></i>
        <div class="destination-info">
          <span class="destination-label">{dest.label}</span>
          <span class="destination-desc">{dest.description}</span>
        </div>
        {#if selectedDestination?.type === dest.id}
          <i class="fa-solid fa-check check-mark"></i>
        {/if}
      </button>
    {/each}
  </div>
</section>

{#if selectedDestination?.type === "custom"}
  <section class="playlist-search">
    <h2>Saved Playlists</h2>
    <input
      type="text"
      class="search-input"
      placeholder="Search playlists…"
      bind:value={searchQuery}
      oninput={handleSearch}
    />
    {#if filteredPlaylists.length === 0}
      <p class="empty-state">
        No saved playlists found{searchQuery ? ` matching "${searchQuery}"` : ""}.
      </p>
    {:else}
      <div class="playlist-list">
        {#each filteredPlaylists as playlist}
          <button
            class="playlist-item {selectedDestination?.playlistId === playlist.id
              ? 'selected'
              : ''}"
            onclick={() => selectDestination("custom", playlist.id)}
          >
            <span class="playlist-title">{playlist.title}</span>
            <span class="playlist-meta">
              {playlist.videos?.length || 0} video{playlist.videos?.length !== 1 ? "s" : ""}
              {#if playlist.isLocal}
                <span class="badge local">Local</span>
              {:else if playlist.saved}
                <span class="badge synced">Synced</span>
              {/if}
            </span>
            {#if selectedDestination?.playlistId === playlist.id}
              <i class="fa-solid fa-check check-mark"></i>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .destination-options h2,
  .playlist-search h2 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
  }

  .destination-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }

  .destination-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 16px;
    border: 2px solid var(--border-color);
    border-radius: 12px;
    background: var(--background-color);
    color: var(--text-color);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s,
      box-shadow 0.15s;
    position: relative;
    min-height: 100px;
  }

  .destination-card:hover:not(.disabled) {
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px var(--primary-color, #3b82f6) 20;
  }

  .destination-card.selected {
    border-color: var(--primary-color);
    background: var(--primary-color, #3b82f6) 10;
  }

  .destination-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .destination-icon {
    font-size: 24px;
    color: var(--primary-color);
  }

  .destination-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .destination-label {
    font-weight: 600;
    font-size: 14px;
  }

  .destination-desc {
    font-size: 12px;
    color: var(--text-muted);
  }

  .check-mark {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 16px;
    color: var(--primary-color);
  }

  .playlist-search {
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--background-color);
    color: var(--text-color);
    font-size: 14px;
    margin-bottom: 12px;
  }

  .playlist-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .playlist-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--background-color);
    color: var(--text-color);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
    text-align: left;
    width: 100%;
  }

  .playlist-item:hover {
    border-color: var(--primary-color);
    background: var(--primary-color, #3b82f6) 05;
  }

  .playlist-item.selected {
    border-color: var(--primary-color);
    background: var(--primary-color, #3b82f6) 10;
  }

  .playlist-title {
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playlist-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge.local {
    background: var(--secondary-color, #6c757d) 20;
    color: var(--secondary-color, #6c757d);
  }

  .badge.synced {
    background: var(--success-color, #28a745) 20;
    color: var(--success-color, #28a745);
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--text-muted);
  }
</style>
