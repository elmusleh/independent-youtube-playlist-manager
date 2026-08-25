<script lang="ts">
  import Fa from "svelte-fa";
  import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

  let {
    filterChips = ["All", "Local", "YouTube"],
    activeChip = "All",
    onChipChange = () => {},
    sortOptions = ["Recently added", "A-Z"],
    activeSort = "Recently added",
    onSortChange = () => {},
  }: {
    filterChips?: string[];
    activeChip?: string;
    onChipChange?: (chip: string) => void;
    sortOptions?: string[];
    activeSort?: string;
    onSortChange?: (sort: string) => void;
  } = $props();

  let sortOpen = $state(false);

  function closeSortDropdown() {
    sortOpen = false;
  }

  function handleSortSelect(option: string, event: MouseEvent) {
    event.stopPropagation();
    onSortChange(option);
    sortOpen = false;
  }

  function toggleSort(event: MouseEvent) {
    event.stopPropagation();
    sortOpen = !sortOpen;
  }
</script>

<svelte:window onclick={closeSortDropdown} />

<div class="chip-bar">
  <div class="sort-wrapper">
    <button class="chip" class:sort-open={sortOpen} onclick={toggleSort}>
      {activeSort}
      <Fa icon={faChevronDown} fw />
    </button>
    {#if sortOpen}
      <div class="sort-dropdown">
        {#each sortOptions as option}
          <button
            class:selected={activeSort === option}
            class="sort-option"
            onclick={(e) => handleSortSelect(option, e)}
          >
            {option}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#each filterChips as chip}
    <button class:active={activeChip === chip} class="chip" onclick={() => onChipChange(chip)}>
      {chip}
    </button>
  {/each}
</div>

<style>
  .chip-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 12px 24px;
    border-top: 1px solid var(--border-color);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.07);
    color: var(--text-color);
    transition:
      background 0.15s,
      color 0.15s;
  }

  :global([data-theme="dark"]) .chip {
    background: rgba(255, 255, 255, 0.1);
  }

  .chip.active {
    background: var(--text-color);
    color: var(--background-color);
  }

  .sort-wrapper {
    position: relative;
  }

  .sort-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 2000;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    min-width: 170px;
    overflow: hidden;
  }

  .sort-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: none;
    color: var(--text-color);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
  }

  .sort-option:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  .sort-option.selected {
    font-weight: 700;
    color: #3ea6ff;
  }

  @media (max-width: 768px) {
    .chip-bar {
      padding: 12px 16px;
    }

    .chip {
      font-size: 13px;
      padding: 5px 12px;
    }
  }
</style>
