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
      <span class="sort-label">{activeSort}</span>
      <span class="sort-label-mobile">Sort</span>
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
    gap: var(--space-2);
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-6);
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border-primary);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-md);
    border: none;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
    min-height: var(--touch-target-min);
    min-width: var(--touch-target-min);
  }

  :global([data-theme="dark"]) .chip {
    background: var(--color-bg-tertiary);
  }

  .chip.active {
    background: var(--color-text-primary);
    color: var(--color-bg-primary);
  }

  .chip:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  .sort-wrapper {
    position: relative;
  }

  .sort-label-mobile {
    display: none;
  }

  .sort-dropdown {
    position: absolute;
    top: calc(100% + var(--space-2));
    left: 0;
    z-index: 2000;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--color-shadow-md);
    min-width: 170px;
    overflow: hidden;
  }

  .sort-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--space-2) var(--space-4);
    border: none;
    background: none;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    text-align: left;
    min-height: var(--touch-target-min);
  }

  .sort-option:hover {
    background: var(--color-bg-hover);
  }

  .sort-option.selected {
    font-weight: var(--font-weight-bold);
    color: var(--color-brand-primary);
  }

  .sort-option:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .chip-bar {
      flex-wrap: nowrap;
      gap: var(--space-1);
      padding: 4px 12px;
      overflow: visible;
    }

    .chip {
      flex-shrink: 0;
      font-size: var(--font-size-sm);
      padding: 0 var(--space-2);
    }

    .sort-label {
      display: none;
    }

    .sort-label-mobile {
      display: inline;
    }
  }

  /* Touch target enforcement for mobile */
  @media (pointer: coarse), (max-width: 767px) {
    .chip {
      min-height: var(--touch-target-min);
      min-width: var(--touch-target-min);
    }
    .sort-option {
      min-height: var(--touch-target-min);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
    .sort-option {
      transition: none;
    }
  }
</style>
