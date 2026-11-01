<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faArrowUp,
    faArrowDown,
    faAnglesUp,
    faAnglesDown,
    faListCheck,
    faCheckDouble,
    faLayerGroup,
    faArrowsUpDown,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import SelectionMenu, { type SelectionMenuItem } from "./SelectionMenu.svelte";

  let {
    selectedCount = 0,
    isAllSelected = false,
    onToggleSelectAll,
    onSelectAbove,
    onSelectBelow,
    onSelectFirst50,
    onOpenRangeSelectAbove,
    onOpenRangeSelectBelow,
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
    onOpenRangeSelectAbove: () => void;
    onOpenRangeSelectBelow: () => void;
    onOpenCopyMove: () => void;
    onMoveToTop: () => void;
    onMoveToBottom: () => void;
    onDelete: () => void;
    onCancel: () => void;
  } = $props();

  let nothingSelected = $derived(selectedCount === 0);

  let selectItems: SelectionMenuItem[] = $derived([
    {
      id: "all",
      icon: faCheckDouble,
      label: isAllSelected ? "Deselect all" : "Select all",
      onSelect: onToggleSelectAll,
    },
    {
      id: "first-50",
      icon: faListCheck,
      label: "First 50 videos",
      onSelect: onSelectFirst50,
    },
    {
      id: "above",
      icon: faArrowUp,
      label: "All videos above",
      disabled: nothingSelected,
      onSelect: onSelectAbove,
    },
    {
      id: "below",
      icon: faArrowDown,
      label: "All videos below",
      disabled: nothingSelected,
      onSelect: onSelectBelow,
    },
    {
      id: "range-above",
      icon: faAnglesUp,
      label: "Select N videos above…",
      disabled: nothingSelected,
      dividerBefore: true,
      onSelect: onOpenRangeSelectAbove,
    },
    {
      id: "range-below",
      icon: faAnglesDown,
      label: "Select N videos below…",
      disabled: nothingSelected,
      onSelect: onOpenRangeSelectBelow,
    },
  ]);

  let moveItems: SelectionMenuItem[] = $derived([
    { id: "top", icon: faArrowUp, label: "Move to Top", onSelect: onMoveToTop },
    { id: "bottom", icon: faArrowDown, label: "Move to Bottom", onSelect: onMoveToBottom },
    {
      id: "copy-move",
      icon: faLayerGroup,
      label: "Copy / Move to playlist…",
      dividerBefore: true,
      mobileOnly: true,
      onSelect: onOpenCopyMove,
    },
  ]);
</script>

<div class="selection-bar">
  <div class="selection-info">
    <label class="selection-checkbox">
      <input
        aria-label="Select all videos"
        type="checkbox"
        checked={isAllSelected}
        onchange={onToggleSelectAll}
      />
    </label>
    <span
      ><span class="selection-count">{selectedCount}</span><span class="selection-word">
        selected</span
      ></span
    >
  </div>

  <div class="selection-actions">
    <SelectionMenu label="Select" icon={faListCheck} items={selectItems} />

    <SimpleButton
      onclick={onOpenCopyMove}
      secondary
      disabled={nothingSelected}
      className="playlist-action"
    >
      <Fa icon={faLayerGroup} fw />
      <span>Playlist</span>
    </SimpleButton>

    <SelectionMenu
      label="Move"
      icon={faArrowsUpDown}
      items={moveItems}
      disabled={nothingSelected}
    />

    <SimpleButton onclick={onDelete} danger disabled={nothingSelected}>
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
    margin-bottom: 16px;
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
  }

  .selection-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--touch-target-min);
    min-height: var(--touch-target-min);
    cursor: pointer;
  }

  .selection-checkbox input[type="checkbox"] {
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

  @media (max-width: 900px) {
    .selection-bar {
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 8px;
      align-items: center;
      padding: 6px 8px;
    }

    .selection-info {
      flex-shrink: 0;
      gap: 4px;
      font-size: 13px;
    }

    .selection-actions {
      width: auto;
      flex-wrap: nowrap;
      justify-content: flex-start;
      flex-shrink: 0;
      gap: 4px;
    }

    .selection-actions :global(.btn) {
      width: var(--header-control-size);
      min-width: var(--header-control-size);
      height: var(--header-control-size);
      padding: 0;
      border-radius: 50%;
    }

    .selection-actions :global(.btn .content span:not(.sort-badge)) {
      display: none;
    }

    .selection-actions :global(.btn .content .chevron) {
      display: none;
    }

    .selection-actions :global(.playlist-action) {
      display: none;
    }
  }

  @media (max-width: 360px) {
    .selection-word {
      display: none;
    }
  }
</style>
