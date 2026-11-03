<script lang="ts">
  import { push } from "svelte-spa-router";
  import SimpleButton from "./SimpleButton.svelte";
  import ListRow from "./common/ListRow.svelte";
  import PaginationBar from "./PaginationBar.svelte";
  import CategoryBadge from "./CategoryBadge.svelte";
  import Fa from "svelte-fa";
  import { faThumbTack, faArrowUp, faArrowDown, faPencil } from "@fortawesome/free-solid-svg-icons";
  import { faGripVertical } from "@fortawesome/free-solid-svg-icons";
  import type { Settings } from "../types/model";
  import { StatusManager } from "../services/status-manager.svelte";
  import { paginate } from "svelte-paginate";
  import { clampPage } from "../utils/pagination";
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
  let searchValue = $state("");
  let draggingIndex = $state(-1);
  let dragOverIndex = $state(-1);
  let playlistsPerPage = $state(20);
  let currentPage = $state(1);
  let filteredPlaylists = $derived(
    searchValue.trim()
      ? playlists.filter((p) => p.title.toLowerCase().includes(searchValue.toLowerCase()))
      : playlists
  );

  let paginatedPlaylists = $derived(
    paginate({
      items: filteredPlaylists,
      pageSize: playlistsPerPage,
      currentPage,
    }) as FavoritePlaylistInfo[]
  );

  $effect(() => {
    const validPage = clampPage(
      currentPage,
      Math.ceil(filteredPlaylists.length / playlistsPerPage) || 1
    );
    if (validPage !== currentPage) currentPage = validPage;
  });

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

  function handleDragStart(e: DragEvent, index: number) {
    if (searchValue.trim()) return;
    draggingIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (searchValue.trim()) return;
    e.preventDefault();
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = -1;
  }

  async function handleDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    dragOverIndex = -1;
    if (searchValue.trim()) return;
    if (draggingIndex === -1 || draggingIndex === targetIndex) {
      draggingIndex = -1;
      return;
    }
    const newList = [...playlists];
    const [removed] = newList.splice(draggingIndex, 1);
    newList.splice(targetIndex, 0, removed);
    playlists = newList;
    const nextIds = newList.map((p) => p.id);
    await persistFavoriteIds(nextIds);
    if (settings) settings.favoritePlaylistIds = nextIds;
    draggingIndex = -1;
  }
</script>

<!-- Pinned -->
<div class="pinned-list-wrapper">
  <p class="sub-text">
    These playlists appear in the sidebar for quick access. Use arrows to reorder; click the pin to
    unpin.
  </p>
  {#if playlists.length > 0}
    <div class="search-sort-bar">
      <div class="search-box">
        <input
          type="text"
          placeholder="Search pinned playlists..."
          bind:value={searchValue}
          aria-label="Search pinned playlists"
        />
      </div>
      <span class="select-label">{filteredPlaylists.length} pinned</span>
    </div>
  {/if}
  {#if loadingPlaylists}
    <div class="skeleton-list">
      {#each Array(5) as _}
        <div class="skeleton-row">
          <div class="skeleton-thumb"></div>
          <div class="skeleton-text">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line meta"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if playlists.length === 0}
    <div class="empty-favorites">
      <Fa icon={faThumbTack} class="empty-icon" />
      <p>No pinned playlists yet.</p>
      <p class="hint">Pin a playlist from the Manage page to see it here.</p>
      <a class="btn primary" href="#/manage">Browse all playlists</a>
    </div>
  {:else}
    <div class="list-container">
      <div class="playlist-list">
        {#each paginatedPlaylists as fav, index (fav.id)}
          <ListRow
            draggable={filteredPlaylists.length === playlists.length &&
              filteredPlaylists.length <= playlistsPerPage}
            dragging={draggingIndex === index}
            dragOver={dragOverIndex === index}
            {index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {#snippet content()}
              <div
                class="thumb-container"
                role="button"
                tabindex="-1"
                onclick={() => (location.hash = `#/playlist?id=${fav.id}`)}
              >
                {#if fav.thumbnailUrl}
                  <img class="thumb" src={fav.thumbnailUrl} alt="" loading="lazy" />
                {:else}
                  <div class="thumb thumb-empty">
                    <Fa icon={faThumbTack} />
                  </div>
                {/if}
                <div class="thumb-overlay">
                  <Fa icon={faPencil} />
                </div>
              </div>
              <div
                class="row-content"
                role="button"
                tabindex="-1"
                onclick={() => (location.hash = `#/playlist?id=${fav.id}`)}
              >
                <div class="row-title-line">
                  <span class="row-title">{fav.title}</span>
                </div>
                <div class="row-meta">
                  <span class="row-count"
                    >{fav.videoCount} video{fav.videoCount !== 1 ? "s" : ""}</span
                  >
                  <CategoryBadge
                    category={fav.isLocal
                      ? "local"
                      : fav.id === "LIKED"
                        ? "liked"
                        : fav.id === "UPLOADS"
                          ? "uploaded"
                          : "account"}
                  />
                  {#if fav.timestamp}
                    <span class="row-date">{new Date(fav.timestamp).toLocaleDateString()}</span>
                  {/if}
                </div>
              </div>
            {/snippet}
            {#snippet actions()}
              <SimpleButton
                secondary
                onclick={(e) => {
                  e.stopPropagation();
                  move(fav.id, -1);
                }}
                disabled={playlists[0]?.id === fav.id}
                title="Move up"
              >
                <Fa icon={faArrowUp} />
              </SimpleButton>
              <SimpleButton
                secondary
                onclick={(e) => {
                  e.stopPropagation();
                  move(fav.id, 1);
                }}
                disabled={playlists[playlists.length - 1]?.id === fav.id}
                title="Move down"
              >
                <Fa icon={faArrowDown} />
              </SimpleButton>
              <button
                class="action-btn"
                onclick={(e) => {
                  e.stopPropagation();
                  toggle(fav.id);
                }}
                aria-label="Unpin from sidebar"
                title="Unpin from sidebar"
              >
                <span class="filled">
                  <Fa icon={faThumbTack} />
                </span>
              </button>
            {/snippet}
          </ListRow>
        {/each}
      </div>
    </div>
    {#if filteredPlaylists.length > playlistsPerPage}
      <PaginationBar
        totalItems={filteredPlaylists.length}
        pageSize={playlistsPerPage}
        {currentPage}
        onPageChange={(e: any) => (currentPage = e?.detail?.page ?? currentPage)}
        onPageSizeChange={(n) => (playlistsPerPage = n)}
        pageSizeId="pinned-page-size"
        pageSizeLabel="Pinned per page"
      />
    {/if}
  {/if}
</div>

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

  .add-more-section {
    margin-top: 16px;
  }

  .search-sort-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 200px;
  }

  .search-box input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--hover-color);
    color: var(--text-color);
    font-size: 14px;
  }

  .select-label {
    color: var(--text-muted);
    font-size: 13px;
    white-space: nowrap;
  }

  .thumb-container {
    position: relative;
    width: 56px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
  }

  .thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
  }

  .thumb.thumb-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--border-color);
    color: var(--text-muted);
  }

  .thumb-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .thumb-container:hover .thumb-overlay {
    opacity: 1;
  }

  .row-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 4px;
    cursor: pointer;
  }

  .row-title-line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .row-title {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 13px;
    color: var(--text-muted);
  }

  .row-count {
    white-space: nowrap;
  }

  .row-date {
    white-space: nowrap;
  }

  .empty-favorites .btn.primary {
    margin-top: 12px;
    display: inline-block;
    padding: 8px 16px;
    border-radius: 8px;
    background: var(--color-brand-primary);
    color: #fff;
    text-decoration: none;
  }

  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .skeleton-thumb {
    width: 56px;
    height: 32px;
    border-radius: 4px;
    background: var(--border-color);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .skeleton-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .skeleton-line {
    height: 12px;
    border-radius: 4px;
    background: var(--border-color);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .skeleton-line.title {
    width: 60%;
  }

  .skeleton-line.meta {
    width: 30%;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  .loading {
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
  }
</style>
