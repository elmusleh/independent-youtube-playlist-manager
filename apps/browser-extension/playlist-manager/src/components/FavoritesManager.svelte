<script lang="ts">
  import { push } from "svelte-spa-router";
  import SimpleButton from "./SimpleButton.svelte";
  import Fa from "svelte-fa";
  import { faStar, faGripLines } from "@fortawesome/free-solid-svg-icons";
  import type { Settings } from "../types/model";
  import { StatusManager } from "../services/status-manager.svelte";
  import { logger } from "../services/logger";
  import {
    toggleFavorite,
    persistFavoriteIds,
    moveFavorite,
    resolveFavoritePlaylists,
    type FavoritePlaylistInfo,
  } from "../services/favorites";

  const {
    settings,
    save,
    status,
    signedIn,
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
    status: StatusManager;
    signedIn: boolean;
  } = $props();

  let playlists: FavoritePlaylistInfo[] = $state([]);
  let allPlaylists: FavoritePlaylistInfo[] = $state([]);
  let loadingPlaylists = $state(false);

  async function loadPlaylists() {
    loadingPlaylists = true;
    try {
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          "[SETTINGS] Loading playlists for favorites management"
        );
      const resolved = await resolveFavoritePlaylists(settings?.favoritePlaylistIds ?? []);
      playlists = resolved;
      // Also load all available playlists for adding
      const local = await window.getLocalPlaylists();
      const account = signedIn ? await window.getAccountPlaylists() : [];
      allPlaylists = [
        ...local.map((p) => ({
          id: p.id,
          title: p.title || "Untitled Playlist",
          videoCount: p.videos?.length ?? 0,
          isLocal: true,
          thumbnailUrl: p.videos?.[0]
            ? (window.videoService?.getVideoThumbnailUrl?.(p.videos[0]) ?? undefined)
            : undefined,
        })),
        ...account.map((p) => ({
          id: p.id,
          title: p.title,
          videoCount: p.videoCount,
          isLocal: false,
          thumbnailUrl: p.thumbnailUrl ?? undefined,
        })),
      ].filter((entry, index, arr) => arr.findIndex((e) => e.id === entry.id) === index);
    } catch (e) {
      logger.error("Failed to load playlists for favorites:", e);
    } finally {
      loadingPlaylists = false;
    }
  }

  loadPlaylists();

  // Update playlists when favorites change
  $effect(() => {
    settings?.favoritePlaylistIds;
    resolveFavoritePlaylists(settings?.favoritePlaylistIds ?? []).then((resolved) => {
      playlists = resolved;
    });
  });

  function isFavorite(id: string) {
    return settings?.favoritePlaylistIds?.includes(id) ?? false;
  }

  async function toggle(id: string) {
    const nextIds = toggleFavorite(settings?.favoritePlaylistIds ?? [], id);
    await persistFavoriteIds(nextIds);
    if (settings) settings.favoritePlaylistIds = nextIds;
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", `[SETTINGS] Toggled favorite: ${id}`);
    window.success(nextIds.includes(id) ? "Added to favorites" : "Removed from favorites");
  }

  async function move(id: string, direction: -1 | 1) {
    const ids = settings?.favoritePlaylistIds ?? [];
    const next = moveFavorite(ids, ids.indexOf(id), direction);
    await persistFavoriteIds(next);
    if (settings) settings.favoritePlaylistIds = next;
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", `[SETTINGS] Reordered favorite: ${id}`);
  }
</script>

<!-- Pinned Favorites -->
<section class="card">
  <h3><Fa icon={faStar} /> Pinned Favorites</h3>
  <p class="sub-text">
    These playlists appear in the sidebar for quick access. Drag to reorder; click the star to
    unpin.
  </p>
  {#if loadingPlaylists}
    <p class="loading">Loading playlists...</p>
  {:else if playlists.length === 0}
    <div class="empty-favorites">
      <Fa icon={faStar} class="empty-icon" />
      <p>No favorites pinned yet.</p>
      <p class="hint">Star a playlist in Saved or Manage to pin it here.</p>
    </div>
  {:else}
    <div class="favorites-list">
      {#each playlists as fav (fav.id)}
        <div class="favorite-item">
          <button class="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">
            <Fa icon={faGripLines} />
          </button>
          <div class="fav-info">
            {#if fav.thumbnailUrl}
              <img class="fav-thumb" src={fav.thumbnailUrl} alt="" />
            {:else}
              <div class="fav-thumb placeholder"><Fa icon={faStar} /></div>
            {/if}
            <div class="fav-details">
              <span class="fav-title">{fav.title}</span>
              <span class="fav-meta">{fav.videoCount} video{fav.videoCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div class="fav-actions">
            <SimpleButton
              secondary
              onclick={() => move(fav.id, -1)}
              disabled={playlists[0]?.id === fav.id}
              title="Move up"
            >
              <Fa icon={faStar} class="move-up" />
            </SimpleButton>
            <SimpleButton
              secondary
              onclick={() => move(fav.id, 1)}
              disabled={playlists[playlists.length - 1]?.id === fav.id}
              title="Move down"
            >
              <Fa icon={faStar} class="move-down" />
            </SimpleButton>
            <button
              class="fav-remove"
              onclick={() => toggle(fav.id)}
              aria-label="Remove from favorites"
              title="Remove from favorites"
            >
              <span class:filled={true}>
                <Fa icon={faStar} />
              </span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .empty-favorites {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 48px;
    color: var(--color-brand-warning);
    margin-bottom: 16px;
  }

  .hint {
    font-size: 14px;
    margin-top: 8px;
  }

  .favorites-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .favorite-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--hover-color);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .drag-handle {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: grab;
    padding: 8px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .drag-handle:hover {
    background: var(--border-color);
    color: var(--text-color);
  }

  .fav-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .fav-thumb {
    width: 48px;
    height: 27px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .fav-thumb.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--border-color);
    color: var(--text-muted);
  }

  .fav-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .fav-title {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fav-meta {
    font-size: 13px;
    color: var(--text-muted);
  }

  .fav-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .fav-actions :global(.btn) {
    min-width: 32px;
    min-height: 32px;
    padding: 4px;
  }

  .fav-remove {
    background: none;
    border: none;
    color: var(--color-brand-warning);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
  }

  .fav-remove:hover {
    background-color: rgba(var(--color-brand-warning-rgb, 255, 193, 7), 0.15);
  }

  .fav-remove :global(svg.filled) {
    color: var(--color-brand-warning);
  }

  .add-more-section {
    margin-top: 16px;
  }
</style>
