<script lang="ts">
  import { onMount } from "svelte";
  import PaginationBar from "../PaginationBar.svelte";
  import MetadataGapList from "./MetadataGapList.svelte";
  import MetadataUnavailableList from "./MetadataUnavailableList.svelte";
  import MetadataQueueToolbar from "./MetadataQueueToolbar.svelte";
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

  function setReason(value: string) {
    reasonFilter = value;
    currentPage = 1;
    selected = new Set();
    window.storeObject("metadataReasonFilter", reasonFilter).catch(() => {});
  }

  function setOrigin(value: string) {
    originFilter = value;
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
  <MetadataQueueToolbar
    gapsCount={gaps.length}
    unavailableCount={unavailable.length}
    {activeTab}
    {reasonFilter}
    {originFilter}
    reasonOptions={REASON_OPTIONS}
    {originOptions}
    filteredCount={filteredUnavailable.length}
    selectedCount={selectedFiltered.length}
    allSelected={allFilteredSelected}
    {bulkRetrying}
    onTab={selectTab}
    onReason={setReason}
    onOrigin={setOrigin}
    onToggleAll={toggleAllFiltered}
    onRetrySelected={() => onRetrySelected(selectedFiltered)}
  />

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
  .empty {
    margin: 0;
    padding: var(--space-4, 16px);
    border: 1px dashed var(--color-border-secondary, var(--border-color));
    border-radius: var(--radius-card, 10px);
    color: var(--color-text-secondary, var(--text-muted));
    font-size: var(--font-size-sm, 13px);
    text-align: center;
  }
</style>
