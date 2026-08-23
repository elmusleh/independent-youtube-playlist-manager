<script lang="ts">
  import type { Snippet } from "svelte";

  let { bgcolor = "#065fd4", disabled = false, primary = false, secondary = false, class: className = "", style = "", onclick, children }: {
    bgcolor?: string;
    disabled?: boolean;
    primary?: boolean;
    secondary?: boolean;
    class?: string;
    style?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      (event.currentTarget as HTMLElement).dispatchEvent(clickEvent);
    }
  }
</script>

<button
  class="btn {className}"
  class:primary
  class:secondary
  style={`background-color: ${bgcolor}; ` + (style ?? "")}
  {onclick}
  onkeydown={handleKeydown}
  {disabled}
>
  <div class="content">
    {#if children}{@render children()}{/if}
  </div>
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-shrink: 0;
    text-align: center;
    border-radius: 18px;
    height: 36px;
    padding: 0 16px;
    cursor: pointer;
    margin: 0;
    border: 1px solid transparent;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s, border-color 0.2s, filter 0.2s;
    outline: none;
    color: white;
  }

  .btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn.primary {
    background-color: var(--primary-color);
  }

  .btn.secondary {
    background-color: transparent;
    border-color: var(--border-color);
    color: var(--text-color);
  }

  .btn.secondary:hover:not(:disabled) {
    background-color: var(--bg-secondary);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  :global(.content svg) {
    width: 20px;
    height: 20px;
  }
</style>