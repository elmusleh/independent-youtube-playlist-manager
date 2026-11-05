<script lang="ts">
  import PaginationNav from "./PaginationNav.svelte";
  import { PAGE_SIZES } from "../services/settings-utils.js";

  let {
    totalItems = 0,
    pageSize = 20,
    currentPage = 1,
    onPageChange,
    onPageSizeChange,
    pageSizeId = "page-size",
    pageSizeLabel = "Per page",
    pageSizeOptions = PAGE_SIZES,
    showPageSize = true,
  }: {
    totalItems?: number;
    pageSize?: number;
    currentPage?: number;
    onPageChange?: (event: { detail: { page: number } }) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeId?: string;
    pageSizeLabel?: string;
    pageSizeOptions?: readonly number[];
    showPageSize?: boolean;
  } = $props();

  function handlePageSizeChange(event: Event) {
    const size = Number((event.currentTarget as HTMLSelectElement).value);
    if (!Number.isFinite(size) || size === pageSize) return;
    onPageSizeChange?.(size);
  }
</script>

<div class="pagination-bar">
  {#if showPageSize}
    <div class="page-size-control">
      <label class="page-size-label" for={pageSizeId}>{pageSizeLabel}</label>
      <select id={pageSizeId} value={pageSize} onchange={handlePageSizeChange}>
        {#if !pageSizeOptions.includes(pageSize)}
          <option value={pageSize}>{pageSize}</option>
        {/if}
        {#each pageSizeOptions as size}
          <option value={size}>{size}</option>
        {/each}
      </select>
    </div>
  {/if}

  {#if totalItems > pageSize}
    <PaginationNav {totalItems} {pageSize} {currentPage} onsetpage={onPageChange} />
  {/if}
</div>

<style>
  .pagination-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: wrap;
  }

  .page-size-control {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .page-size-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .page-size-control select {
    height: 36px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    color: var(--text-color);
    font-size: 13px;
    font-weight: 500;
    outline: none;
    cursor: pointer;
  }

  .page-size-control select:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .pagination-bar {
      gap: 8px;
      margin-top: 16px;
    }

    .page-size-control select {
      height: var(--touch-target-min);
    }
  }
</style>
