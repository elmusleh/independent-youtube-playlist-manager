<script lang="ts">
  import { onDestroy } from "svelte";
  import Fa from "svelte-fa";
  import { faStar } from "@fortawesome/free-solid-svg-icons";
  import PlaylistCard from "../components/PlaylistCard.svelte";
  import PlaylistSkeleton from "../components/skeletons/PlaylistSkeleton.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import { resolveFavoritePlaylists, MAX_VISIBLE_FAVORITES } from "../services/favorites";

  let favorites: import("../services/favorites").FavoritePlaylistInfo[] = $state([]);
  let loading = $state(true);

  async function loadFavorites() {
    loading = true;
    try {
      const settings = await window.getSettings();
      favorites = await resolveFavoritePlaylists(settings.favoritePlaylistIds);
    } catch {
      favorites = [];
    } finally {
      loading = false;
    }
  }

  loadFavorites();

  // Refresh on settings change
  function handleStorageChange(changes: any, area: string) {
    if (area === "sync" && "favoritePlaylistIds" in changes) {
      loadFavorites();
    }
  }

  const browser = (window as any).browser || (window as any).chrome;
  browser.storage.onChanged.addListener(handleStorageChange);
  onDestroy(() => {
    browser.storage.onChanged.removeListener(handleStorageChange);
  });
</script>

<main class="view-scroll-container">
  <div class="view-body">
    <div class="view-header">
      <h1 class="view-title"><Fa icon={faStar} /> Favorites</h1>
      <p class="view-subtitle">
        Pinned playlists for quick access. Drag to reorder in <a
          href="#/settings"
          class="settings-link">Settings</a
        >.
      </p>
    </div>

    {#if loading}
      <div class="loading-state">
        {#each Array(6) as _}
          <PlaylistSkeleton />
        {/each}
      </div>
    {:else if favorites.length === 0}
      <EmptyState
        icon={faStar}
        title="No Favorites Pinned"
        message="Star playlists in Saved or Manage to pin them here for quick access."
        actionLabel="Browse Playlists"
        actionHref="#/saved"
      />
    {:else}
      <div class="favorites-grid">
        {#each favorites as fav (fav.id)}
          <PlaylistCard
            id={fav.id}
            title={fav.title}
            thumbnailUrl={fav.thumbnailUrl}
            videoCount={fav.videoCount}
            isLocal={fav.isLocal}
            status={fav.isLocal ? "local" : "online"}
            showFavoriteBadge
            onOpen={() => (location.hash = `#/playlist?id=${fav.id}`)}
          />
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  .view-header {
    margin-bottom: 24px;
  }

  .view-title {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 700;
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .view-subtitle {
    margin: 0;
    color: var(--text-muted);
    font-size: 15px;
  }

  .settings-link {
    color: var(--primary-color);
    text-decoration: none;
  }

  .settings-link:hover {
    text-decoration: underline;
  }

  .loading-state {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  .favorites-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  @media (max-width: 768px) {
    .favorites-grid {
      grid-template-columns: 1fr;
    }

    .view-title {
      font-size: 22px;
    }
  }
</style>
