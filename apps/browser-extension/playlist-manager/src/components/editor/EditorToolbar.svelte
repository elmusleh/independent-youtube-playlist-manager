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
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import { onDestroy } from "svelte";

  let {
    hasVideos = false,
    isSelectMode = $bindable(false),
    onPlay,
    onImport,
    onClean,
    onSort,
    onScrapeHtml,
  }: {
    hasVideos: boolean;
    isSelectMode: boolean;
    onPlay: () => void;
    onImport: () => void;
    onClean: (type: string) => void;
    onSort: (type: string) => void;
    onScrapeHtml?: () => void;
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
          title="Sort"
          secondary
        >
          <Fa icon={faSort} fw />
          <span>Sort</span>
          <Fa icon={faChevronDown} fw />
        </SimpleButton>
        {#if showSortMenu}
          <div class="dropdown-menu">
            <button
              onclick={() => {
                onSort("title");
                closeAll();
              }}
            >
              <span>Sort A-Z</span>
            </button>
            <button
              onclick={() => {
                onSort("channel");
                closeAll();
              }}
            >
              <span>Sort Channel</span>
            </button>
            <button
              onclick={() => {
                onSort("duration");
                closeAll();
              }}
            >
              <span>Sort Duration</span>
            </button>
            <button class="disabled-option" disabled>
              <span>View Count (Popular)</span>
              <span class="coming-soon">Coming Soon</span>
            </button>
            <button class="disabled-option" disabled>
              <span>Release Date</span>
              <span class="coming-soon">Coming Soon</span>
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
    padding: 0 0 24px 0;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 24px;
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

  .dropdown-menu button.disabled-option {
    opacity: 0.5;
    pointer-events: none;
    cursor: not-allowed;
  }

  .dropdown-menu button.disabled-option:hover {
    background: none;
  }

  .dropdown-menu .coming-soon {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
    background: var(--hover-color);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
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
