<script lang="ts">
  import { clampPage, getPageItems } from "../utils/pagination";
  let {
    totalItems = 0,
    pageSize = 10,
    currentPage = 1,
    onsetpage,
  }: {
    totalItems?: number;
    pageSize?: number;
    currentPage?: number;
    onsetpage?: (event: { detail: { page: number } }) => void;
  } = $props();
  let width = $state(0);
  const totalPages = $derived(Math.max(1, Math.ceil(totalItems / pageSize)));
  const page = $derived(clampPage(currentPage, totalPages));
  const items = $derived(getPageItems(totalPages, page, width < 440 ? 5 : 7));
  function selectPage(next: number) {
    const target = clampPage(next, totalPages);
    if (target !== page) onsetpage?.({ detail: { page: target } });
  }
</script>

<nav aria-label="Pagination" bind:clientWidth={width}>
  <div class="pages">
    <button
      type="button"
      aria-label="Previous page"
      disabled={page === 1}
      onclick={() => selectPage(page - 1)}>‹</button
    >
    {#each items as item, index (`${item}-${index}`)}
      {#if item === "ellipsis"}
        <span class="ellipsis" aria-hidden="true">…</span>
      {:else}
        <button
          type="button"
          aria-label={`Page ${item}`}
          aria-current={item === page ? "page" : undefined}
          onclick={() => selectPage(item)}>{item}</button
        >
      {/if}
    {/each}
    <button
      type="button"
      aria-label="Next page"
      disabled={page === totalPages}
      onclick={() => selectPage(page + 1)}>›</button
    >
  </div>
</nav>

<style>
  nav {
    flex: 1 1 100%;
    min-width: 0;
    max-width: 100%;
    container-type: inline-size;
  }
  .pages {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  button,
  .ellipsis {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 6px 10px;
    margin: 0;
    font: inherit;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: var(--text-color);
  }
  button {
    width: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--background-color);
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--hover-color);
  }
  button[aria-current="page"] {
    font-weight: 700;
    border-color: currentColor;
    background: var(--hover-color);
  }
  button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .ellipsis {
    min-width: 16px;
    padding-inline: 0;
  }
  @container (max-width: 360px) {
    .pages {
      gap: 2px;
    }
    button {
      min-width: 44px;
      padding-inline: 6px;
    }
  }
</style>
