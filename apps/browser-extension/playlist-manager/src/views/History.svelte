<script lang="ts">
  import { onDestroy } from "svelte";
  import Fa from "svelte-fa";
  import {
    faClockRotateLeft,
    faXmark,
    faPlay,
    faSearch,
    faFileExport,
    faFileImport,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../components/SimpleButton.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import ViewHeader from "../components/ViewHeader.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import ErrorState from "../components/ErrorState.svelte";
  import SkeletonCard from "../components/SkeletonCard.svelte";
  import { paginate } from "svelte-paginate";
  import PaginationNav from "../components/PaginationNav.svelte";
  import { historySearch } from "../stores/playlists-filters";
  import { requestConfirm } from "../stores/confirmation";

  const browser = (window as any).browser || (window as any).chrome;
  const HISTORY_KEY = "local_yt_history";

  interface HistoryItem {
    videoId: string;
    title: string;
    channel?: string;
    timestamp: number;
    duration: number;
    isCompleted: boolean;
    lastWatchedAt: number;
  }

  let historyArray: HistoryItem[] = $state([]);
  let loading = $state(true);
  let errorMessage = $state<string | null>(null);
  const status = new StatusManager();

  async function refresh() {
    await status.refresh(async () => {
      await loadInitialData();
    });
  }
  let currentPage = $state(1);
  let pageSize = $state(100);

  // 1. Initialization: Fetch initial data directly at top level
  const loadInitialData = async () => {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        "[HISTORY-VIEW] Loading watch history",
      );
    try {
      const data = await browser.storage.local.get(HISTORY_KEY);
      parseAndSortHistory(data[HISTORY_KEY]);

      const settings = await window.getSettings();
      pageSize = settings.defaultPageSize;

      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[HISTORY-VIEW] Loaded ${historyArray.length} history entries`,
        );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to load history:", e);
      errorMessage = errMsg;
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[HISTORY-VIEW] Failed to load history: ${errMsg}`,
        );
    } finally {
      loading = false;
    }
  };

  function parseAndSortHistory(historyObj: Record<string, any> | undefined) {
    if (!historyObj) {
      historyArray = [];
      return;
    }
    historyArray = Object.entries(historyObj)
      .map(([videoId, details]: [string, any]) => ({
        videoId,
        ...details,
      }))
      .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt); // Descending (newest first)
  }

  loadInitialData();

  // 2. Reactivity & Cleanup: Listen for updates
  function handleStorageChange(changes: Record<string, any>, area: string) {
    if (area === "local" && changes[HISTORY_KEY]) {
      parseAndSortHistory(changes[HISTORY_KEY].newValue);
    }
  }

  browser.storage.onChanged.addListener(handleStorageChange);

  onDestroy(() => {
    browser.storage.onChanged.removeListener(handleStorageChange);
  });

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function getProgressWidth(item: HistoryItem): string {
    if (!item.duration || item.duration === 0) return "0%";
    return `${Math.min(100, (item.timestamp / item.duration) * 100)}%`;
  }

  function getDateLabel(timestamp: number): string {
    const date = new Date(timestamp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

    if (date >= today) return "Today";
    if (date >= yesterday) return "Yesterday";
    if (date >= startOfWeek) return "This Week";

    const lastWeek = new Date(startOfWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    if (date >= lastWeek) return "Last Week";

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (date >= startOfMonth) return "Earlier this Month";

    return date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  let filteredHistory = $derived(
    historyArray.filter((item) => {
      if (!$historySearch) return true;
      const q = $historySearch.toLowerCase();
      return (
        (item.title || "").toLowerCase().includes(q) ||
        (item.channel || "").toLowerCase().includes(q)
      );
    }),
  );

  let paginatedHistory = $derived(
    paginate({
      items: filteredHistory,
      pageSize,
      currentPage,
    }) as HistoryItem[],
  );

  let groupedHistory = $derived(
    paginatedHistory.reduce(
      (groups, item) => {
        const label = getDateLabel(item.lastWatchedAt);
        if (!groups[label]) groups[label] = [];
        groups[label].push(item);
        return groups;
      },
      {} as Record<string, HistoryItem[]>,
    ),
  );

  let groupOrder = $derived(Object.keys(groupedHistory));

  function updatePaginationPage(e: any) {
    currentPage = e.detail.page;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function exportHistory() {
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", "[HISTORY-VIEW] Exporting watch history");
    try {
      const data = await browser.storage.local.get(HISTORY_KEY);
      const historyObj = data[HISTORY_KEY] || {};
      const blob = new Blob([JSON.stringify(historyObj, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "yph-watch-history.json";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          "[HISTORY-VIEW] Watch history exported successfully",
        );
      window.success("History exported successfully");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to export history:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[HISTORY-VIEW] Export failed: ${errMsg}`,
        );
      window.error("Export failed");
    }
  }

  function importHistory() {
    const fi = document.getElementById(
      "HistoryImportInput",
    ) as HTMLInputElement;
    fi.onchange = () => {
      const file = fi.files?.[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const importedData = JSON.parse(fr.result as string);
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "INFO",
              "[HISTORY-VIEW] Importing watch history from file",
            );
          await browser.storage.local.set({ [HISTORY_KEY]: importedData });
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "INFO",
              "[HISTORY-VIEW] Watch history imported successfully",
            );
          window.success("History imported successfully");
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error("Failed to import history:", e);
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "ERROR",
              `[HISTORY-VIEW] Import failed: ${errMsg}`,
            );
          window.error("File is incorrectly formatted");
        }
        fi.value = "";
      };
      fr.readAsText(file);
    };
    fi.click();
  }
</script>

<main>
  <div class="view-header">
    <div class="top-left">
      <ViewHeader
        icon={faClockRotateLeft}
        title="Watch History"
        count={historyArray.length}
      />
    </div>
    <div class="btn-group right-align">
      {#if historyArray.length > 0}
        <SimpleButton secondary onclick={exportHistory} title="Export watch history">
          <Fa icon={faFileExport} fw />
          <span>Export</span>
        </SimpleButton>
        <SimpleButton secondary onclick={importHistory} title="Import watch history">
          <Fa icon={faFileImport} fw />
          <span>Import</span>
        </SimpleButton>
        <SimpleButton secondary onclick={() => {
          requestConfirm({
            title: "Clear History?",
            message: "This will permanently remove all watch history from your local storage. YouTube history will not be affected.",
            color: "danger",
            onConfirm: async () => {
              await browser.storage.local.remove(HISTORY_KEY);
              historyArray = [];
              window.success("History cleared");
            }
          });
        }} title="Clear all history">
          <Fa icon={faXmark} fw />
          <span>Clear History</span>
        </SimpleButton>
      {/if}
      <SaveStatus onclick={refresh} {status} title="Refresh" />
    </div>
  </div>

  <div class="view-body">
    <div class="content">
      {#if loading}
        <div class="skeleton-grid">
          {#each Array(6) as _}
            <SkeletonCard />
          {/each}
        </div>
      {:else if errorMessage}
        <ErrorState message={errorMessage} onRetry={loadInitialData} />
      {:else if historyArray.length === 0}
        <div class="empty-state">
          <Fa icon={faClockRotateLeft} size="4x" />
          <h2>Keep track of what you watch</h2>
          <p>
            Your local watch history will appear here as you play videos from
            your playlists.
          </p>
        </div>
      {:else if filteredHistory.length === 0}
        <div class="empty-state">
          <Fa icon={faSearch} size="3x" />
          <p>No results found for "{$historySearch}"</p>
          <SimpleButton
            onclick={() => {
              historySearch.set("");
              currentPage = 1;
            }}
            secondary>Clear Search</SimpleButton
          >
        </div>
      {:else}
        <div class="history-container">
          {#each groupOrder as groupLabel}
            <div class="history-group">
              <h3 class="group-header">{groupLabel}</h3>
              <div class="history-list">
                {#each groupedHistory[groupLabel] as item (item.videoId)}
                  <div class="history-item">
                    <a
                      href="https://www.youtube.com/watch?v={item.videoId}"
                      target="_blank"
                      class="thumbnail-link"
                      title="Watch on YouTube"
                    >
                      <div class="thumbnail-container">
                        <img
                          alt={item.title}
                          src="https://i.ytimg.com/vi/{item.videoId}/hqdefault.jpg"
                          loading="lazy"
                        />
                        <div class="duration-overlay">
                          {formatTime(item.duration)}
                        </div>
                        <div class="play-overlay"><Fa icon={faPlay} /></div>
                        <div class="progress-bar-container">
                          <div
                            class="progress-fill"
                            style="width: {getProgressWidth(item)}"
                          ></div>
                        </div>
                      </div>
                    </a>

                    <div class="details">
                      <div class="details-top">
                        <a
                          href="https://www.youtube.com/watch?v={item.videoId}"
                          target="_blank"
                          class="title"
                        >
                          {item.title || item.videoId}
                        </a>
                      </div>
                      <div class="meta">
                        <span class="channel"
                          >{item.channel || "Unknown Channel"}</span
                        >
                        <span class="dot">•</span>
                        <span class="timestamp"
                          >{new Date(
                            item.lastWatchedAt,
                          ).toLocaleDateString()}</span
                        >
                      </div>
                      <div class="resume-info">
                        Watched {formatTime(item.timestamp)}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        {#if filteredHistory.length > pageSize}
          <div class="pagination-container">
            <PaginationNav
              totalItems={filteredHistory.length}
              {pageSize}
              {currentPage}
              limit={1}
              showStepOptions={true}
              onsetpage={updatePaginationPage}
            />
          </div>
        {/if}
      {/if}
    </div>
  </div>
</main>

<input
  type="file"
  id="HistoryImportInput"
  accept="application/json"
  style="display: none;"
/>

<style>

  .content {
    flex: 1;
  }

  .skeleton-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    padding: 20px 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    text-align: center;
    color: var(--text-muted);
    gap: 16px;
    background: var(--hover-color);
    border-radius: 16px;
    border: 2px dashed var(--border-color);
  }

  .empty-state h2 {
    color: var(--text-color);
    margin: 8px 0 0 0;
  }

  .history-container {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .group-header {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 16px 0;
    color: var(--text-color);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .history-item {
    display: flex;
    gap: 16px;
    padding: 8px;
    border-radius: 12px;
    transition: background 0.2s;
    position: relative;
  }

  .history-item:hover {
    background: var(--hover-color);
  }

  .thumbnail-link {
    flex-shrink: 0;
    text-decoration: none;
  }

  .thumbnail-container {
    position: relative;
    width: 200px;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    background: #000;
  }

  .thumbnail-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .duration-overlay {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .play-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 24px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .thumbnail-container:hover .play-overlay {
    opacity: 1;
  }

  .progress-bar-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
  }

  .progress-fill {
    height: 100%;
    background: #ff0000;
  }

  .details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .details-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color);
    text-decoration: none;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
  }

  .title:hover {
    color: var(--primary-color);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .dot {
    opacity: 0.5;
  }

  .resume-info {
    margin-top: auto;
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .pagination-container {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: center;
  }

  @media (max-width: 768px) {
    .history-item {
      flex-direction: column;
    }
    .thumbnail-container {
      width: 100%;
    }
  }
</style>
