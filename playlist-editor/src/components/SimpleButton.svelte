<script lang="ts">
  import type { Snippet } from "svelte";

  let { className = "", primary = false, secondary = false, danger = false, iconOnly = false, disabled = false, title = "", onclick, children }: {
    className?: string;
    primary?: boolean;
    secondary?: boolean;
    danger?: boolean;
    iconOnly?: boolean;
    disabled?: boolean;
    title?: string;
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
  class:danger
  class:icon-only={iconOnly}
  {disabled}
  {onclick}
  onkeydown={handleKeydown}
  aria-label={title}
  {title}
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
    height: 36px;
    padding: 0 16px;
    border-radius: 18px;
    border: 1px solid transparent;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s, border-color 0.2s;
    background-color: var(--hover-color);
    color: var(--text-color);
    margin: 0;
    outline: none;
  }

  .btn:focus-visible {
    outline: 2px solid var(--text-color);
    outline-offset: 2px;
  }

  .btn:hover:not(:disabled) {
    background-color: var(--bg-secondary);
  }

  .btn.primary {
    background-color: var(--primary-color);
    color: #fff;
  }

  :global([data-theme="light"]) .btn.primary {
    color: #fff;
  }

  .btn.primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn.secondary {
    background-color: transparent;
    border-color: var(--border-color);
  }

  .btn.secondary:hover:not(:disabled) {
    background-color: var(--bg-secondary);
  }

  .btn.danger {
    color: #f44336;
  }

  .btn.danger:hover:not(:disabled) {
    background-color: rgba(244, 67, 54, 0.1);
  }

  .btn.icon-only {
    width: 36px;
    padding: 0;
    border-radius: 50%;
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
