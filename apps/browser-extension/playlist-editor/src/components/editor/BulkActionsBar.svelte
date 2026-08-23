<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faArrowUp,
    faArrowDown,
    faListCheck,
    faChevronDown,
    faLayerGroup,
    faArrowsUpDown,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import { onDestroy } from "svelte";

  let {
    selectedCount = 0,
    isAllSelected = false,
    onToggleSelectAll,
    onSelectAbove,
    onSelectBelow,
    onSelectFirst50,
    onOpenCopyMove,
    onMoveToTop,
    onMoveToBottom,
    onDelete,
    onCancel,
  }: {
    selectedCount: number;
    isAllSelected: boolean;
    onToggleSelectAll: () => void;
    onSelectAbove: () => void;
    onSelectBelow: () => void;
    onSelectFirst50: () => void;
    onOpenCopyMove: () => void;
    onMoveToTop: () => void;
    onMoveToBottom: () => void;
    onDelete: () => void;
    onCancel: () => void;
  } = $props();

  let showMarkMenu = $state(false);
  let showMoveMenu = $state(false);

  function closeAll() {
    showMarkMenu = false;
    showMoveMenu = false;
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

<div class="selection-bar">
  <div class="selection-info">
    <input
      aria-label="Select all videos"
      type="checkbox"
      checked={isAllSelected}
      onchange={onToggleSelectAll}
    />
    <span>{selectedCount} selected</span>
  </div>

  <div class="selection-actions">
    <div class="dropdown-container">
      <SimpleButton
        onclick={() => {
          const next = !showMarkMenu;
          closeAll();
          showMarkMenu = next;
        }}
        secondary
      >
        <Fa icon={faListCheck} fw />
        <span>Select</span>
        <Fa icon={faChevronDown} fw />
      </SimpleButton>
      {#if showMarkMenu}
        <div class="dropdown-menu">
          <button
            onclick={() => {
              onSelectFirst50();
              closeAll();
            }}
          >
            <Fa icon={faListCheck} fw />
            <span>First 50 videos</span>
          </button>
          <button
            onclick={() => {
              onSelectAbove();
              closeAll();
            }}
            disabled={selectedCount === 0}
            class={selectedCount === 0 ? "disabled-option" : ""}
          >
            <Fa icon={faArrowUp} fw />
            <span>All videos above</span>
          </button>
          <button
            onclick={() => {
              onSelectBelow();
              closeAll();
            }}
            disabled={selectedCount === 0}
            class={selectedCount === 0 ? "disabled-option" : ""}
          >
            <Fa icon={faArrowDown} fw />
            <span>All videos below</span>
          </button>
        </div>
      {/if}
    </div>

    <SimpleButton
      onclick={onOpenCopyMove}
      secondary
      disabled={selectedCount === 0}
    >
      <Fa icon={faLayerGroup} fw />
      <span>Playlist</span>
    </SimpleButton>

    <div class="dropdown-container">
      <SimpleButton
        onclick={() => {
          const next = !showMoveMenu;
          closeAll();
          showMoveMenu = next;
        }}
        secondary
        disabled={selectedCount === 0}
      >
        <Fa icon={faArrowsUpDown} fw />
        <span>Move</span>
        <Fa icon={faChevronDown} fw />
      </SimpleButton>
      {#if showMoveMenu}
        <div class="dropdown-menu">
          <button
            onclick={() => {
              onMoveToTop();
              closeAll();
            }}
          >
            <Fa icon={faArrowUp} fw />
            <span>Move to Top</span>
          </button>
          <button
            onclick={() => {
              onMoveToBottom();
              closeAll();
            }}
          >
            <Fa icon={faArrowDown} fw />
            <span>Move to Bottom</span>
          </button>
        </div>
      {/if}
    </div>

    <SimpleButton onclick={onDelete} danger disabled={selectedCount === 0}>
      <Fa icon={faTrash} fw />
      <span>Delete</span>
    </SimpleButton>

    <SimpleButton onclick={onCancel} secondary>
      <Fa icon={faXmark} fw />
      <span>Cancel</span>
    </SimpleButton>
  </div>
</div>

<style>
  .selection-bar {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    background: var(--active-bg-color);
    padding: 8px 16px;
    border-radius: 12px;
    border: 1px solid var(--primary-color);
    box-sizing: border-box;
    margin-bottom: 24px;
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
  }

  .selection-info input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary-color);
  }

  .selection-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
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

  @media (max-width: 900px) {
    .selection-bar {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
      padding: 12px;
    }
    .selection-actions {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
