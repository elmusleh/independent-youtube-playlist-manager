<script lang="ts">
  import Fa from "svelte-fa";
  import { faSearch } from "@fortawesome/free-solid-svg-icons";
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
  let isEditorView = $derived(router.location.startsWith("/editor"));
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

<div class="center" class:hidden={!showSearchBar}>
  <div class="search-container">
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
</div>

<style>
  .center {
    flex: 1;
    display: flex;
    justify-content: center;
    max-width: 720px;
    padding: 0 40px;
    transition: opacity 0.2s ease;
  }

  .center.hidden {
    opacity: 0;
    pointer-events: none;
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

  @media (max-width: 768px) {
    .center {
      padding: 0 8px;
    }

    .search-container {
      height: 36px;
    }

    .search-btn {
      width: 48px;
    }

    .search-container input {
      font-size: 14px;
      padding: 0 12px;
    }
  }

  @media (max-width: 480px) {
    .center {
      padding: 0 4px;
      flex: 0 1 auto;
      min-width: 0;
    }

    .search-container {
      height: 32px;
    }

    .search-btn {
      width: 36px;
    }

    .search-container input {
      font-size: 13px;
      padding: 0 8px;
    }
  }
</style>
