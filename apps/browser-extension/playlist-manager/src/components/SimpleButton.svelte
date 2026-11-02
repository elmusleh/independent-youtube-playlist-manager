<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    className = "",
    primary = false,
    secondary = false,
    danger = false,
    iconOnly = false,
    disabled = false,
    title = "",
    onclick,
    children,
  }: {
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
</script>

<button
  type="button"
  class="btn {className}"
  class:primary
  class:secondary
  class:danger
  class:icon-only={iconOnly}
  {disabled}
  {onclick}
  aria-label={title || undefined}
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
    height: var(--touch-target-min);
    padding: 0 var(--space-4);
    border-radius: var(--radius-button);
    border: 1px solid transparent;
    font-family: var(--font-family-primary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition:
      background-color var(--transition-base),
      border-color var(--transition-base),
      transform var(--transition-fast);
    background-color: var(--color-bg-hover);
    color: var(--color-text-primary);
    margin: 0;
    outline: none;
    min-width: var(--touch-target-min);
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  .btn:hover:not(:disabled) {
    background-color: var(--color-bg-active);
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn.primary {
    background-color: var(--color-brand-primary);
    color: #ffffff;
    border-color: var(--color-brand-primary);
  }

  .btn.primary:hover:not(:disabled) {
    background-color: var(--color-brand-primary-hover);
  }

  .btn.primary:active:not(:disabled) {
    background-color: var(--color-brand-primary-hover);
    transform: scale(0.98);
  }

  .btn.secondary {
    background-color: transparent;
    border-color: var(--color-border-primary);
    color: var(--color-text-primary);
  }

  .btn.secondary:hover:not(:disabled) {
    background-color: var(--color-bg-hover);
  }

  .btn.danger {
    background-color: transparent;
    color: var(--color-brand-danger);
    border-color: var(--color-brand-danger);
  }

  .btn.danger:hover:not(:disabled) {
    background-color: rgba(255, 0, 0, 0.1);
  }

  .btn.danger:active:not(:disabled) {
    background-color: rgba(255, 0, 0, 0.15);
  }

  .btn.icon-only {
    width: var(--touch-target-min);
    padding: 0;
    border-radius: 50%;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  :global(.content svg) {
    width: var(--icon-btn-size);
    height: var(--icon-btn-size);
    flex-shrink: 0;
  }

  /* Touch target enforcement for mobile */
  @media (pointer: coarse), (max-width: 767px) {
    .btn {
      height: var(--touch-target-comfortable);
      min-width: var(--touch-target-comfortable);
    }
    .btn.icon-only {
      width: var(--touch-target-comfortable);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition-duration: 0.01ms;
    }
  }
</style>
