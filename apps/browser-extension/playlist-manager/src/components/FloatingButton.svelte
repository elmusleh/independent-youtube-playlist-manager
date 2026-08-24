<script lang="ts">
  import type { Snippet } from "svelte";

  let { title = "", bgcolor = "#007bff", onclick, children }: {
    title?: string;
    bgcolor?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const clickEvent = new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
      });
      (event.currentTarget as HTMLElement).dispatchEvent(clickEvent);
    }
  }
</script>

<div
  class="fab"
  style="background-color: {bgcolor}"
  {onclick}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-label={title}
>
  {#if children}{@render children()}{/if}
  {#if !!title}
    <span class="tooltip" style="background-color: {bgcolor}">{title}</span>
  {/if}
</div>

<style>
  .fab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    line-height: 48px;
    min-width: 48px;
    min-height: 48px;
    color: white;
    border-radius: 50%;
    box-shadow: 0 6px 10px 0 var(--shadow-color);
    transition: all 0.1s ease-in-out;
    cursor: pointer;
  }

  .fab:hover {
    box-shadow: 0 6px 14px 0 var(--shadow-color);
    transform: scale(1.05);
  }

  .fab:hover .tooltip {
    visibility: visible;
  }

  .tooltip {
    visibility: hidden;
    width: 120px;
    opacity: 0.8;
    color: #fff;
    text-align: center;
    border-radius: 6px;
    padding: 5px;
    line-height: initial;

    /* Position the tooltip */
    position: absolute;
    z-index: 1;
    bottom: 125%;
    left: 50%;
    margin-left: -60px;
  }
</style>
