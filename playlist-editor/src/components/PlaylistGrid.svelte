<script lang="ts">
  import SkeletonCard from "./SkeletonCard.svelte";
  import EmptyState from "./EmptyState.svelte";

  interface Props {
    loading?: boolean;
    empty?: boolean;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyIcon?: any;
    children?: import("svelte").Snippet;
  }

  const {
    loading = false,
    empty = false,
    emptyTitle = "No Playlists",
    emptyMessage = "No playlists found.",
    emptyIcon,
    children,
  }: Props = $props();
</script>

{#if loading}
  <div class="playlist-grid">
    {#each Array(6) as _}
      <SkeletonCard />
    {/each}
  </div>
{:else if empty}
  <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />
{:else}
  <div class="playlist-grid">
    {@render children?.()}
  </div>
{/if}

<style>
  .playlist-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    padding: 20px 0;
  }

  @media (max-width: 768px) {
    .playlist-grid {
      gap: 12px;
      padding: 12px 0;
    }
  }
</style>
