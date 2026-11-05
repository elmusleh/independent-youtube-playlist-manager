<script lang="ts">
  import Fa from "svelte-fa";
  import { faRotateRight } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import type { QueueOrigin } from "../../utils/metadata-queue";

  type Tab = "gaps" | "unavailable";

  let {
    gapsCount,
    unavailableCount,
    activeTab,
    reasonFilter,
    originFilter,
    reasonOptions,
    originOptions,
    filteredCount,
    selectedCount,
    allSelected,
    bulkRetrying,
    onTab,
    onReason,
    onOrigin,
    onToggleAll,
    onRetrySelected,
  }: {
    gapsCount: number;
    unavailableCount: number;
    activeTab: Tab;
    reasonFilter: string;
    originFilter: string;
    reasonOptions: Array<{ id: string; label: string }>;
    originOptions: QueueOrigin[];
    filteredCount: number;
    selectedCount: number;
    allSelected: boolean;
    bulkRetrying: boolean;
    onTab: (tab: Tab) => void;
    onReason: (reason: string) => void;
    onOrigin: (origin: string) => void;
    onToggleAll: () => void;
    onRetrySelected: () => void;
  } = $props();
</script>

<div class="queue-head">
  <div class="tabs" role="tablist" aria-label="Metadata issues">
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === "gaps"}
      class:active={activeTab === "gaps"}
      onclick={() => onTab("gaps")}
    >
      Incomplete <span class="tab-count">{gapsCount}</span>
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === "unavailable"}
      class:active={activeTab === "unavailable"}
      onclick={() => onTab("unavailable")}
    >
      Unavailable <span class="tab-count">{unavailableCount}</span>
    </button>
  </div>

  {#if activeTab === "unavailable"}
    <div class="queue-actions">
      <label class="select-all">
        <input
          type="checkbox"
          checked={allSelected}
          disabled={filteredCount === 0}
          onchange={onToggleAll}
        />
        Select all
      </label>
      <SimpleButton
        primary
        onclick={onRetrySelected}
        disabled={bulkRetrying || selectedCount === 0}
      >
        <Fa icon={faRotateRight} />
        {bulkRetrying ? "Retrying…" : `Retry selected (${selectedCount})`}
      </SimpleButton>
    </div>
  {/if}
</div>

{#if activeTab === "unavailable"}
  <div class="filters">
    <label>
      <span>Reason</span>
      <select
        value={reasonFilter}
        onchange={(event) => onReason((event.currentTarget as HTMLSelectElement).value)}
      >
        {#each reasonOptions as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>
    <label>
      <span>Playlist</span>
      <select
        value={originFilter}
        onchange={(event) => onOrigin((event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="all">All playlists</option>
        {#each originOptions as origin (origin.id)}
          <option value={origin.id}>{origin.title}</option>
        {/each}
      </select>
    </label>
  </div>
{/if}

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
