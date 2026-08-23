<script lang="ts">
  let { rows = 5 } = $props();
</script>

<div class="playlist-skeleton">
  {#each Array(rows) as _}
    <div class="skeleton-row">
      <div class="skeleton-icon shimmer"></div>
      <div class="skeleton-thumb shimmer"></div>
      <div class="skeleton-info">
        <div class="skeleton-line title shimmer"></div>
        <div class="skeleton-line meta shimmer"></div>
      </div>
      <div class="skeleton-btns">
        <div class="skeleton-btn circular shimmer"></div>
        <div class="skeleton-btn circular shimmer"></div>
      </div>
    </div>
  {/each}
</div>

<style>
  .playlist-skeleton {
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
    background: var(--background-color);
  }

  .skeleton-row {
    display: flex;
    padding: 0.5em 1em;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .skeleton-row:last-child {
    border-bottom: none;
  }

  .skeleton-icon {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: var(--hover-color);
    flex-shrink: 0;
  }

  .skeleton-thumb {
    width: 120px;
    height: 65px;
    border-radius: 4px;
    background: var(--hover-color);
    flex-shrink: 0;
  }

  .skeleton-info {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 0.5em;
  }

  .skeleton-line {
    background: var(--hover-color);
    border-radius: 4px;
  }

  .skeleton-line.title {
    width: 60%;
    height: 16px;
  }

  .skeleton-line.meta {
    width: 30%;
    height: 12px;
  }

  .skeleton-btns {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .skeleton-btn.circular {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--hover-color);
  }

  /* Shimmer effect from SkeletonCard.svelte */
  .shimmer {
    position: relative;
    overflow: hidden;
  }

  .shimmer::after {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0,
      rgba(255, 255, 255, 0.05) 20%,
      rgba(255, 255, 255, 0.1) 60%,
      rgba(255, 255, 255, 0)
    );
    animation: shimmer 2s infinite;
    content: "";
  }

  :global([data-theme="light"]) .shimmer::after {
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0,
      rgba(0, 0, 0, 0.02) 20%,
      rgba(0, 0, 0, 0.05) 60%,
      rgba(255, 255, 255, 0)
    );
  }

  @keyframes shimmer {
    100% {
      transform: translateX(100%);
    }
  }

  @media (max-width: 768px) {
    .skeleton-thumb {
      width: 80px;
      height: 45px;
    }
    .skeleton-line.title {
      width: 80%;
    }
  }
</style>
