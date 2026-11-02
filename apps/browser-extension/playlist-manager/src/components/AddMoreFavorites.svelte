<script lang="ts">
  import { resolveFavoritePlaylists, type FavoritePlaylistInfo } from "../services/favorites";
  import { faStar } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";

  interface Props {
    playlists: FavoritePlaylistInfo[];
    onToggle: (id: string) => void;
  }

  let { playlists, onToggle }: Props = $props();
</script>

<div class="add-more-grid">
  {#each playlists as fav (fav.id)}
    <div class="add-more-item">
      {#if fav.thumbnailUrl}
        <img class="add-more-thumb" src={fav.thumbnailUrl} alt="" />
      {:else}
        <div class="add-more-thumb placeholder"><Fa icon={faStar} /></div>
      {/if}
      <div class="add-more-info">
        <span class="add-more-title">{fav.title}</span>
        <span class="add-more-meta">{fav.videoCount} video{fav.videoCount !== 1 ? "s" : ""}</span>
      </div>
      <button
        class="add-more-toggle"
        onclick={() => onToggle(fav.id)}
        aria-label="Add to favorites"
        title="Add to favorites"
      >
        <Fa icon={faStar} />
      </button>
    </div>
  {/each}
</div>

<style>
  .add-more-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
    gap: 12px;
  }

  .add-more-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--hover-color);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .add-more-thumb {
    width: 48px;
    height: 27px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .add-more-thumb.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--border-color);
    color: var(--text-muted);
  }

  .add-more-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .add-more-title {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .add-more-meta {
    font-size: 13px;
    color: var(--text-muted);
  }

  .add-more-toggle {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    min-width: 36px;
    min-height: 36px;
    transition:
      color 0.15s ease,
      background-color 0.15s ease;
  }

  .add-more-toggle:hover {
    background-color: var(--hover-color);
    color: var(--color-brand-warning);
  }

  @media (max-width: 768px) {
    .add-more-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
