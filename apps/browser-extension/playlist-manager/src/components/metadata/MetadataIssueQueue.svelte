<script lang="ts">
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import { faRotateRight } from "@fortawesome/free-solid-svg-icons";
  import PaginationBar from "../PaginationBar.svelte";
  import SimpleButton from "../SimpleButton.svelte";
  import MetadataGapList from "./MetadataGapList.svelte";
  import MetadataUnavailableList from "./MetadataUnavailableList.svelte";
  import { clampPage } from "../../utils/pagination";
  import { PAGE_SIZES } from "../../services/settings-utils.js";
  import {
    clearSelected,
    collectOriginOptions,
    filterUnavailable,
    paginateQueue,
    selectAllVisible,
  } from "../../utils/metadata-queue";
  import type { NormalizedVideoMeta } from "../../types/model";

  type Tab = "gaps" | "unavailable";
  type Origin = { id: string; title: string };

  let {
    gaps,
    unavailable,
    retrying,
    origins,
    onRetry,
    onForget,
    onRetrySelected,
    bulkRetrying = false,
  }: {
    gaps: NormalizedVideoMeta[];
    unavailable: NormalizedVideoMeta[];
    retrying: Record<string, boolean>;
    origins: Record<string, Origin[]>;
    onRetry: (videoId: string) => void;
    onForget: (videoId: string) => void;
    onRetrySelected: (videoIds: string[]) => void;
    bulkRetrying?: boolean;
  } = $props();

  let activeTab = $state<Tab>("gaps");
  let reasonFilter = $state("all");
  let originFilter = $state("all");
  let pageSize = $state(10);
  let currentPage = $state(1);
  let selected = $state<Set<string>>(new Set());
  let restored = $state(false);

  const REASON_OPTIONS = [
    { id: "all", label: "All reasons" },
    { id: "deleted", label: "Deleted or unavailable" },
    { id: "private", label: "Private" },
    { id: "broken", label: "Unplayable" },
  ];

  let filteredUnavailable = $derived(
    filterUnavailable(unavailable, origins, reasonFilter, originFilter)
  );
  let originOptions = $derived(collectOriginOptions(origins));

  let activeItems = $derived(activeTab === "gaps" ? gaps : filteredUnavailable);
  let totalPages = $derived(Math.max(1, Math.ceil(activeItems.length / pageSize)));
  let safePage = $derived(clampPage(currentPage, totalPages));
  let pagedItems = $derived(paginateQueue(activeItems, safePage, pageSize));
  let filteredIds = $derived(filteredUnavailable.map((item) => item.videoId));
  let selectedFiltered = $derived(filteredIds.filter((id) => selected.has(id)));
  let allFilteredSelected = $derived(
    filteredIds.length > 0 && selectedFiltered.length === filteredIds.length
  );

  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
  });

  $effect(() => {
    if (restored && gaps.length === 0 && unavailable.length > 0) activeTab = "unavailable";
  });

  onMount(async () => {
    try {
      const [savedSize, savedTab, savedReason, savedOrigin] = await Promise.all([
        window.fetchObject("metadataPageSize", 10),
        window.fetchObject("metadataActiveTab", "gaps"),
        window.fetchObject("metadataReasonFilter", "all"),
        window.fetchObject("metadataOriginFilter", "all"),
      ]);
      const size = Number(savedSize);
      if (PAGE_SIZES.includes(size)) pageSize = size;
      if (savedTab === "gaps" || savedTab === "unavailable") activeTab = savedTab;
      if (REASON_OPTIONS.some((option) => option.id === savedReason)) reasonFilter = savedReason;
      if (typeof savedOrigin === "string") originFilter = savedOrigin;
    } catch {
      /* fall back to the defaults */
    } finally {
      restored = true;
    }
  });

  function selectTab(tab: Tab) {
    activeTab = tab;
    currentPage = 1;
    selected = new Set();
    window.storeObject("metadataActiveTab", tab).catch(() => {});
  }

  function changeReason(event: Event) {
    reasonFilter = (event.currentTarget as HTMLSelectElement).value;
    currentPage = 1;
    selected = new Set();
    window.storeObject("metadataReasonFilter", reasonFilter).catch(() => {});
  }

  function changeOrigin(event: Event) {
    originFilter = (event.currentTarget as HTMLSelectElement).value;
    currentPage = 1;
    selected = new Set();
    window.storeObject("metadataOriginFilter", originFilter).catch(() => {});
  }

  function toggleSelected(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function toggleAllFiltered() {
    selected = allFilteredSelected
      ? clearSelected(selected, filteredIds)
      : selectAllVisible(selected, filteredIds);
  }

  function changePage(event: { detail: { page: number } }) {
    currentPage = event.detail.page;
  }

  function changePageSize(size: number) {
    if (!Number.isFinite(size) || size === pageSize) return;
    const firstVisible = Math.min((safePage - 1) * pageSize, Math.max(activeItems.length - 1, 0));
    pageSize = size;
    currentPage = Math.floor(firstVisible / size) + 1;
    window.storeObject("metadataPageSize", size).catch(() => {});
  }
</script>

<div class="queue">
  <div class="queue-head">
    <div class="tabs" role="tablist" aria-label="Metadata issues">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "gaps"}
        class:active={activeTab === "gaps"}
        onclick={() => selectTab("gaps")}
      >
        Incomplete <span class="tab-count">{gaps.length}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "unavailable"}
        class:active={activeTab === "unavailable"}
        onclick={() => selectTab("unavailable")}
      >
        Unavailable <span class="tab-count">{unavailable.length}</span>
      </button>
    </div>

    {#if activeTab === "unavailable"}
      <div class="queue-actions">
        <label class="select-all">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            disabled={filteredUnavailable.length === 0}
            onchange={toggleAllFiltered}
          />
          Select all
        </label>
        <SimpleButton
          primary
          onclick={() => onRetrySelected(selectedFiltered)}
          disabled={bulkRetrying || selectedFiltered.length === 0}
        >
          <Fa icon={faRotateRight} />
          {bulkRetrying ? "Retrying…" : `Retry selected (${selectedFiltered.length})`}
        </SimpleButton>
      </div>
    {/if}
  </div>

  {#if activeTab === "unavailable"}
    <div class="filters">
      <label>
        <span>Reason</span>
        <select value={reasonFilter} onchange={changeReason}>
          {#each REASON_OPTIONS as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Playlist</span>
        <select value={originFilter} onchange={changeOrigin}>
          <option value="all">All playlists</option>
          {#each originOptions as origin (origin.id)}
            <option value={origin.id}>{origin.title}</option>
          {/each}
        </select>
      </label>
    </div>
  {/if}

  {#if activeItems.length === 0}
    <p class="empty">
      {#if activeTab === "gaps"}
        Nothing is missing — every cached entry is resolved.
      {:else if reasonFilter !== "all" || originFilter !== "all"}
        No unavailable videos match these filters.
      {:else}
        No deleted, private, or unplayable videos are cached.
      {/if}
    </p>
  {:else}
    {#if activeTab === "gaps"}
      <MetadataGapList gaps={pagedItems} {retrying} {onRetry} />
    {:else}
      <MetadataUnavailableList
        items={pagedItems}
        {retrying}
        {origins}
        {onRetry}
        {onForget}
        {selected}
        onToggleSelect={toggleSelected}
      />
    {/if}

    <PaginationBar
      totalItems={activeItems.length}
      {pageSize}
      currentPage={safePage}
      onPageChange={changePage}
      onPageSizeChange={changePageSize}
      pageSizeId="metadata-page-size"
      pageSizeLabel="Videos per page"
    />
  {/if}
</div>

<style>
  .queue-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3, 12px);
    flex-wrap: wrap;
    margin-bottom: var(--space-3, 12px);
  }

  .tabs {
    display: inline-flex;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: var(--radius-card, 10px);
    background-color: var(--color-bg-subtle, transparent);
  }

  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2, 8px);
    min-height: 36px;
    padding: 0 var(--space-3, 12px);
    border: none;
    border-radius: calc(var(--radius-card, 10px) - 3px);
    background: transparent;
    color: var(--color-text-secondary, var(--text-muted));
    font: inherit;
    font-size: var(--font-size-sm, 13px);
    cursor: pointer;
  }

  .tabs button:hover {
    color: var(--color-text-primary);
  }

  .tabs button.active {
    background-color: var(--color-bg-elevated, var(--background-color));
    color: var(--color-text-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .tabs button:focus-visible {
    outline: 2px solid var(--color-brand-primary, var(--primary-color));
    outline-offset: 2px;
  }

  .tab-count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background-color: var(--color-bg-hover, rgba(127, 127, 127, 0.16));
    font-size: 11px;
    line-height: 20px;
    text-align: center;
  }

  .queue-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    flex-wrap: wrap;
  }

  .select-all {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-secondary, var(--text-muted));
    white-space: nowrap;
  }

  .select-all input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--color-brand-primary, var(--primary-color));
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 8px);
    margin-bottom: var(--space-3, 12px);
  }

  .filters label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2, 8px);
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-secondary, var(--text-muted));
    white-space: nowrap;
  }

  .filters select {
    height: 36px;
    max-width: 220px;
    padding: 0 var(--space-2, 8px);
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: var(--radius-card, 10px);
    background-color: var(--color-bg-elevated, var(--background-color));
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--font-size-sm, 13px);
  }

  .filters select:focus-visible {
    outline: 2px solid var(--color-brand-primary, var(--primary-color));
    outline-offset: 2px;
  }

  .empty {
    margin: 0;
    padding: var(--space-4, 16px);
    border: 1px dashed var(--color-border-secondary, var(--border-color));
    border-radius: var(--radius-card, 10px);
    color: var(--color-text-secondary, var(--text-muted));
    font-size: var(--font-size-sm, 13px);
    text-align: center;
  }

  @media (max-width: 600px) {
    .queue-head {
      align-items: stretch;
    }

    .tabs {
      width: 100%;
    }

    .tabs button {
      flex: 1;
      justify-content: center;
    }

    .queue-actions {
      width: 100%;
      justify-content: space-between;
    }

    .filters label,
    .filters select {
      width: 100%;
      max-width: none;
    }
  }
</style>
