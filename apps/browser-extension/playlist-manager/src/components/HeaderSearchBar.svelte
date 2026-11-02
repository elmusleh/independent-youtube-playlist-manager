<script lang="ts">
  import Fa from "svelte-fa";
  import { faSearch, faXmark } from "@fortawesome/free-solid-svg-icons";
  import { tick } from "svelte";
  import { router } from "svelte-spa-router";
  import {
    playlistsSearch,
    historySearch,
    manageSearch,
    editorSearch,
  } from "../stores/playlists-filters";

  let isSavedView = $derived(router.location === "/saved" || router.location === "/");
  let isHistoryView = $derived(router.location === "/history");
  let isManageView = $derived(router.location === "/manage");
  let isEditorView = $derived(
    ["/editor", "/playlist", "/favorite", "/new", "/playlist-builder"].includes(router.location)
  );
  let showSearchBar = $derived(isSavedView || isHistoryView || isManageView || isEditorView);

  let searchPlaceholder = $derived(
    isSavedView || isManageView
      ? "Search playlists…"
      : isHistoryView
        ? "Search watch history…"
        : isEditorView
          ? "Search videos…"
          : "Search…"
  );

  let searchValue = $state("");
  let mobileSearchOpen = $state(false);
  let mobileSearchInput: HTMLInputElement;
  let mobileSearchPanel: HTMLDivElement;
  let mobileSearchTrigger: HTMLButtonElement;

  $effect(() => {
    if (mobileSearchOpen) {
      tick().then(() => mobileSearchInput?.focus());
    }
  });

  $effect(() => {
    if (!mobileSearchOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (mobileSearchPanel?.contains(target) || mobileSearchTrigger?.contains(target)) return;
      mobileSearchOpen = false;
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  });

  $effect(() => {
    // Close the mobile search panel whenever the route changes.
    router.location;
    mobileSearchOpen = false;
  });

  function closeMobileSearch() {
    mobileSearchOpen = false;
  }

  $effect(() => {
    if (isSavedView) {
      searchValue = $playlistsSearch;
    } else if (isHistoryView) {
      searchValue = $historySearch;
    } else if (isManageView) {
      searchValue = $manageSearch;
    } else if (isEditorView) {
      searchValue = $editorSearch;
    }
  });

  function handleSearchInput() {
    if (isSavedView) {
      playlistsSearch.set(searchValue);
    } else if (isHistoryView) {
      historySearch.set(searchValue);
    } else if (isManageView) {
      manageSearch.set(searchValue);
    } else if (isEditorView) {
      editorSearch.set(searchValue);
    }
  }
</script>

{#if showSearchBar}
  <div class="center">
    <div class="search-container desktop-search">
      <input
        aria-label="Search"
        type="text"
        placeholder={searchPlaceholder}
        bind:value={searchValue}
        oninput={handleSearchInput}
      />
      <button class="search-btn" aria-label="Search">
        <Fa icon={faSearch} />
      </button>
    </div>
    <button
      bind:this={mobileSearchTrigger}
      class="mobile-search-trigger"
      aria-label="Search"
      aria-expanded={mobileSearchOpen}
      aria-controls="mobile-search-panel"
      onclick={() => {
        mobileSearchOpen = true;
        tick().then(() => mobileSearchInput?.focus());
      }}
    >
      <Fa icon={faSearch} />
    </button>
  </div>

  {#if mobileSearchOpen}
    <div
      class="mobile-search-panel"
      id="mobile-search-panel"
      role="search"
      bind:this={mobileSearchPanel}
    >
      <div class="search-container mobile-search-container">
        <input
          bind:this={mobileSearchInput}
          aria-label="Search"
          type="text"
          placeholder={searchPlaceholder}
          bind:value={searchValue}
          oninput={handleSearchInput}
          onkeydown={(event) => {
            if (event.key === "Escape") closeMobileSearch();
          }}
        />
      </div>
      <button class="mobile-search-close" onclick={closeMobileSearch} aria-label="Close search">
        <Fa icon={faXmark} />
      </button>
    </div>
  {/if}
{/if}

<style>
  .center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 720px;
    min-width: 0;
    padding: 0 40px;
    transition: opacity 0.2s ease;
  }

  .search-container {
    display: flex;
    align-items: center;
    width: 100%;
    height: 40px;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 40px;
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .search-container:focus-within {
    border-color: var(--primary-color);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .search-container input {
    min-width: 0;
    flex: 1;
    height: 100%;
    padding: 0 16px;
    border: none;
    background: transparent;
    color: var(--text-color);
    font-size: 16px;
    outline: none;
    margin: 0;
  }

  .search-container input:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
  }

  .search-btn {
    width: 64px;
    height: 100%;
    background: var(--hover-color);
    border: none;
    border-left: 1px solid var(--border-color);
    color: var(--text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
  }

  .search-btn:hover {
    background: var(--bg-secondary);
  }

  .mobile-search-trigger {
    display: none;
    width: var(--header-control-size);
    height: var(--header-control-size);
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-color);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background-color 0.15s ease;
  }

  .mobile-search-trigger :global(svg) {
    width: var(--header-icon-size) !important;
    height: var(--header-icon-size) !important;
    flex-shrink: 0;
  }

  .mobile-search-trigger:hover {
    background: var(--hover-color);
  }

  .mobile-search-trigger:focus-visible,
  .mobile-search-close:focus-visible {
    outline: 2px solid var(--color-brand-primary);
    outline-offset: 2px;
  }

  .mobile-search-panel {
    position: fixed;
    top: var(--app-header-height);
    left: 0;
    right: 0;
    z-index: 1002;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--background-color);
    border-bottom: 1px solid var(--border-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }

  .mobile-search-container {
    flex: 1;
    min-width: 0;
  }

  .mobile-search-close {
    width: 44px;
    height: 44px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background-color 0.15s ease;
  }

  .mobile-search-close:hover {
    background: var(--hover-color);
  }

  @media (min-width: 769px) and (max-width: 1023px) {
    .center {
      padding: 0 16px;
    }
  }

  @media (max-width: 768px) {
    .center {
      padding: 0;
      order: 0;
      flex: 0 0 auto;
      max-width: none;
      margin-left: auto;
    }

    .desktop-search {
      display: none;
    }

    .mobile-search-trigger {
      display: flex;
    }

    .search-container {
      height: 44px;
    }

    .search-btn {
      width: 48px;
    }

    .search-container input {
      font-size: 16px;
      padding: 0 12px;
    }
  }

  @media (max-width: 480px) {
    .center {
      padding: 0;
      flex: 0 0 auto;
      min-width: 0;
    }

    .mobile-search-panel {
      padding: 8px;
    }

    .search-container {
      height: 44px;
    }

    .search-btn {
      width: 36px;
    }

    .search-container input {
      font-size: 16px;
      padding: 0 8px;
    }
  }
</style>
