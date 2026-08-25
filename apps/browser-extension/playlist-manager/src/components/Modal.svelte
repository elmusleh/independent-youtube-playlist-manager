<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Snippet } from "svelte";

  let {
    display = $bindable(false),
    children,
  }: {
    display?: boolean;
    children?: Snippet;
  } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (display && event.key === "Escape") {
      display = false;
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeydown);
  }
  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeydown);
    }
  });
</script>

{#if display}
  <div
    onmousedown={(e) => {
      if (e.target === e.currentTarget) display = false;
    }}
    class="modal"
    role="presentation"
  >
    <div class="modal-content" role="dialog" aria-modal="true">
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}

<style>
  .modal {
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.5);
  }

  .modal-content {
    background-color: var(--background-color, #fff);
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 500px;
    width: 90%;
    border: 1px solid var(--border-color, #ddd);
  }

  .modal:hover {
    cursor: pointer;
  }

  .modal-content:hover {
    cursor: auto;
  }
</style>
