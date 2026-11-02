<script lang="ts">
  import SkeletonCard from "./SkeletonCard.svelte";
  import EmptyState from "./EmptyState.svelte";

  interface Props {
    loading?: boolean;
    empty?: boolean;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyIcon?: any;
    emptyActionLabel?: string;
    emptyActionHref?: string;
    emptyActionOnClick?: () => void;
    children?: import("svelte").Snippet;
  }

  const {
    loading = false,
    empty = false,
    emptyTitle = "No Playlists",
    emptyMessage = "No playlists found.",
    emptyIcon,
    emptyActionLabel,
    emptyActionHref,
    emptyActionOnClick,
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
  <EmptyState
    icon={emptyIcon}
    title={emptyTitle}
    message={emptyMessage}
    actionLabel={emptyActionLabel}
    actionHref={emptyActionHref}
    actionOnClick={emptyActionOnClick}
  />
{:else}
  <div class="playlist-grid">
    {@render children?.()}
  </div>
{/if}

<style>
  .playlist-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card-min-width, 280px)), 1fr));
    gap: 20px;
    padding: 20px 0;
    align-items: stretch;
  }

  @media (max-width: 768px) {
    .playlist-grid {
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 12px 0;
    }
  }
</style>
