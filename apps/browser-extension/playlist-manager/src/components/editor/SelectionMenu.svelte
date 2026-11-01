<script module lang="ts">
  import type { IconDefinition } from "@fortawesome/fontawesome-common-types";

  /** One entry in a `SelectionMenu` dropdown. */
  export type SelectionMenuItem = {
    /** Stable key for the keyed each block. */
    id: string;
    icon: IconDefinition;
    label: string;
    /** Rendered disabled and non-clickable. */
    disabled?: boolean;
    /** Drawn above the item; becomes the mobile-only divider when the item is mobile-only. */
    dividerBefore?: boolean;
    /** Hidden on wide screens; used for actions that only fit in a menu on mobile. */
    mobileOnly?: boolean;
    onSelect: () => void;
  };
</script>

<script lang="ts">
  import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
  import SimpleButton from "../SimpleButton.svelte";
  import { onDestroy } from "svelte";

  let {
    label,
    icon,
    items,
    disabled = false,
  }: {
    label: string;
    icon: IconDefinition;
    items: SelectionMenuItem[];
    disabled?: boolean;
  } = $props();

  let open = $state(false);

  function toggle() {
    open = !open;
  }

  function choose(item: SelectionMenuItem) {
    open = false;
    item.onSelect();
  }

  function handleClickOutside(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest(".dropdown-container")) open = false;
  }

  window.addEventListener("click", handleClickOutside);
  onDestroy(() => {
    window.removeEventListener("click", handleClickOutside);
  });
</script>

<div class="dropdown-container">
  <SimpleButton {disabled} secondary onclick={toggle}>
    <Fa {icon} fw />
    <span>{label}</span>
    <Fa icon={faChevronDown} fw class="chevron" />
  </SimpleButton>
  {#if open}
    <div class="dropdown-menu">
      {#each items as item (item.id)}
        {#if item.dividerBefore}
          <div class="dropdown-divider" class:mobile-only-divider={item.mobileOnly}></div>
        {/if}
        <button
          class:disabled-option={item.disabled}
          class:mobile-only-item={item.mobileOnly}
          disabled={item.disabled}
          onclick={() => choose(item)}
        >
          <Fa icon={item.icon} fw />
          <span>{item.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
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

  .dropdown-divider {
    height: 1px;
    background: var(--border-color);
    margin: 4px 0;
  }

  .mobile-only-item,
  .mobile-only-divider {
    display: none;
  }

  @media (max-width: 900px) {
    .mobile-only-item {
      display: flex;
    }

    .mobile-only-divider {
      display: block;
    }
  }
</style>
