<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faPlus,
    faCheck,
    faPlay,
    faWrench,
    faSort,
    faChevronDown,
    faCode,
    faSliders,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import { onDestroy } from "svelte";
  import type { SortRule } from "../../types/model";
  import { SORT_PRESETS, describeSortRules } from "../../utils/playlist-utils";

  let {
    hasVideos = false,
    isSelectMode = $bindable(false),
    onPlay,
    onImport,
    onClean,
    onSort,
    onScrapeHtml,
    activeSortRules = [],
  }: {
    hasVideos: boolean;
    isSelectMode: boolean;
    onPlay: () => void;
    onImport: () => void;
    onClean: (type: string) => void;
    onSort: (type: string, rules?: SortRule[]) => void;
    onScrapeHtml?: () => void;
    activeSortRules?: SortRule[];
  } = $props();

  let showSortMenu = $state(false);
  let showCleanMenu = $state(false);

  function closeAll() {
    showSortMenu = false;
    showCleanMenu = false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".dropdown-container")) {
      closeAll();
    }
  }

  window.addEventListener("click", handleClickOutside);
  onDestroy(() => {
    window.removeEventListener("click", handleClickOutside);
  });

  const singlePresets = $derived(SORT_PRESETS.filter((p) => !p.compound));
  const compoundPresets = $derived(SORT_PRESETS.filter((p) => p.compound));

  function rulesEqual(a: SortRule[], b: SortRule[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((r, i) => r.field === b[i].field && r.direction === b[i].direction);
  }

  const hasActiveSort = $derived(activeSortRules.length > 0);
  const customSortActive = $derived(
    hasActiveSort && !SORT_PRESETS.some((p) => rulesEqual(p.rules, activeSortRules))
  );

  const sortButtonTitle = $derived(
    hasActiveSort ? `Sort (${describeSortRules(activeSortRules)})` : "Sort"
  );
</script>

<div class="playlist-btns">
  <div class="btn-group">
    {#if hasVideos}
      <SimpleButton onclick={onPlay} title="Play all videos" secondary>
        <Fa icon={faPlay} fw />
        <span>Play All</span>
      </SimpleButton>
    {/if}
    <SimpleButton onclick={onImport} title="Add videos from URLs or IDs" secondary>
      <Fa icon={faPlus} fw />
      <span>Add Video(s)</span>
    </SimpleButton>
    {#if onScrapeHtml}
      <SimpleButton onclick={onScrapeHtml} title="Scrape YouTube links from pasted HTML" secondary>
        <Fa icon={faCode} fw />
        <span>Scrape HTML</span>
      </SimpleButton>
    {/if}

    {#if hasVideos}
      <SimpleButton onclick={() => (isSelectMode = true)} title="Bulk select videos" secondary>
        <Fa icon={faCheck} fw />
        <span>Select</span>
      </SimpleButton>
    {/if}
  </div>

  <div class="btn-group right-align">
    {#if hasVideos}
      <div class="dropdown-container">
        <SimpleButton
          onclick={() => {
            const next = !showCleanMenu;
            closeAll();
            showCleanMenu = next;
          }}
          title="Clean"
          secondary
        >
          <Fa icon={faWrench} fw />
          <span>Clean</span>
          <Fa icon={faChevronDown} fw />
        </SimpleButton>
        {#if showCleanMenu}
          <div class="dropdown-menu">
            <button
              onclick={() => {
                onClean("broken");
                closeAll();
              }}
            >
              <span>Remove Broken</span>
            </button>
            <button
              onclick={() => {
                onClean("duplicates");
                closeAll();
              }}
            >
              <span>Remove Duplicates</span>
            </button>
            <button
              onclick={() => {
                onClean("live");
                closeAll();
              }}
            >
              <span>Remove Live Streams</span>
            </button>
            <button
              onclick={() => {
                onClean("refetch");
                closeAll();
              }}
            >
              <span>Refetch from Source</span>
            </button>
          </div>
        {/if}
      </div>

      <div class="dropdown-container">
        <SimpleButton
          onclick={() => {
            const next = !showSortMenu;
            closeAll();
            showSortMenu = next;
          }}
          title={sortButtonTitle}
          secondary
        >
          <Fa icon={faSort} fw />
          <span>Sort</span>
          {#if hasActiveSort}
            <span class="sort-badge" title={describeSortRules(activeSortRules)}></span>
          {/if}
          <Fa icon={faChevronDown} fw />
        </SimpleButton>
        {#if showSortMenu}
          <div class="dropdown-menu dropdown-menu--sort">
            <div class="dropdown-section-label">Single Sort</div>
            {#each singlePresets as preset (preset.id)}
              <button
                class:active={rulesEqual(preset.rules, activeSortRules)}
                onclick={() => {
                  onSort("preset", preset.rules);
                  closeAll();
                }}
              >
                <span>{preset.label}</span>
                {#if rulesEqual(preset.rules, activeSortRules)}
                  <span class="active-mark"><Fa icon={faCheck} fw /></span>
                {/if}
              </button>
            {/each}

            <div class="dropdown-section-label">Multi-Sort Presets</div>
            {#each compoundPresets as preset (preset.id)}
              <button
                class:active={rulesEqual(preset.rules, activeSortRules)}
                onclick={() => {
                  onSort("preset", preset.rules);
                  closeAll();
                }}
              >
                <span>{preset.label}</span>
                {#if rulesEqual(preset.rules, activeSortRules)}
                  <span class="active-mark"><Fa icon={faCheck} fw /></span>
                {/if}
              </button>
            {/each}

            <div class="dropdown-divider"></div>
            <button
              class:active={customSortActive}
              onclick={() => {
                onSort("custom");
                closeAll();
              }}
            >
              <Fa icon={faSliders} fw />
              <span>Custom Multi-Sort...</span>
              {#if customSortActive}
                <span class="active-mark"><Fa icon={faCheck} fw /></span>
              {/if}
            </button>
            <button
              onclick={() => {
                onSort("reverse");
                closeAll();
              }}
            >
              <span>Reverse Order</span>
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .playlist-btns {
    display: flex;
    padding: 12px 24px;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    border-top: 1px solid var(--border-color);
  }

  .btn-group {
    display: flex;
    gap: 8px;
  }

  .right-align {
    margin-left: auto;
  }

  .dropdown-container {
    position: relative;
    display: inline-block;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    z-index: 2000;
    min-width: 190px;
    overflow: hidden;
    animation: fadeInScale 0.15s ease-out;
    transform-origin: top right;
  }

  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .dropdown-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 16px;
    border: none;
    background: none;
    color: var(--text-color);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .dropdown-menu button:hover {
    background: var(--hover-color);
  }

  /* --- Sort dropdown specifics --- */
  .dropdown-menu--sort {
    min-width: 260px;
    max-height: min(65vh, 560px);
    overflow-y: auto;
  }

  .dropdown-menu--sort button.active {
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    color: var(--primary-color);
    font-weight: 600;
  }

  .dropdown-menu--sort .active-mark {
    margin-left: auto;
    flex-shrink: 0;
  }

  .dropdown-section-label {
    padding: 10px 16px 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .dropdown-divider {
    height: 1px;
    background: var(--border-color);
    margin: 6px 0;
  }

  .sort-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 30%, transparent);
    flex-shrink: 0;
  }

  @media (max-width: 900px) {
    .playlist-btns {
      flex-direction: column;
      align-items: flex-start;
    }
    .right-align {
      margin-left: 0;
    }
  }
</style>
