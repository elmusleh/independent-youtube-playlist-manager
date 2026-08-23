<script lang="ts">
  import type { Snippet } from "svelte";

  let { interactive = false, elevated = false, glow = false, glowColor = 'primary', href = null, onClick = null, ariaLabel = null, class: className = '', children }: {
    interactive?: boolean;
    elevated?: boolean;
    glow?: boolean;
    glowColor?: 'primary' | 'success' | 'error' | 'warning';
    href?: string | null;
    onClick?: (() => void) | null;
    ariaLabel?: string | null;
    class?: string;
    children?: Snippet;
  } = $props();

  let hovered = $state(false);

  function handleMouseDown(e: MouseEvent) {
    if (!interactive) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    (e.currentTarget as HTMLElement).appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  function handleClick() {
    if (onClick) onClick();
  }
</script>

<svelte:element
    this={href ? "a" : "div"}
    {href}
    role={interactive && !href ? "button" : undefined}
    tabindex={interactive && !href ? 0 : undefined}
    aria-label={ariaLabel}
    class="card {glow ? `glow-${glowColor}` : ''} {elevated
        ? 'card-elevated'
        : ''} {interactive ? 'card-interactive' : ''} {className}"
    class:hovered
    onclick={handleClick}
    onmousedown={handleMouseDown}
    onkeydown={(e: KeyboardEvent) => {
        if (interactive && !href && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick();
        }
    }}
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
>
    {#if children}{@render children()}{/if}
</svelte:element>

<style>
    .card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background-color: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--size-card-radius);
        padding: var(--spacing-6);
        transition: all var(--duration-200) var(--timing-ease-out);
        will-change: transform, box-shadow;
        position: relative;
    }

    .card:hover {
        background-color: var(--color-surface-elevated);
        transform: translateY(-2px);
        box-shadow: var(--glow-card);
    }

    .card:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
        border-color: var(--color-primary);
    }

    .card.card-interactive {
        cursor: pointer;
        user-select: none;
    }

    .card.card-interactive:active {
        transform: translateY(0);
    }

    .card.card-elevated {
        box-shadow: var(--shadow-md);
    }

    .card.card-elevated:hover {
        box-shadow: var(--shadow-lg);
        transform: translateY(-4px);
    }

    /* Glow Effects */
    .card.glow-primary {
        border-color: var(--color-primary-100);
    }

    .card.glow-primary:hover {
        box-shadow: var(--glow-primary), var(--glow-card);
    }

    .card.glow-success:hover {
        box-shadow: var(--glow-success), var(--glow-card);
    }

    .card.glow-error:hover {
        box-shadow: var(--glow-error), var(--glow-card);
    }

    .card.glow-warning:hover {
        box-shadow: var(--glow-warning), var(--glow-card);
    }

    /* Ripple Effect for Interactive Cards */
    :global(.ripple) {
        position: absolute;
        border-radius: 50%;
        background-color: rgba(26, 115, 232, 0.4);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }

    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    /* Container Query Responsive */
    @container (max-width: 20rem) {
        .card {
            padding: var(--spacing-4);
        }
    }

    /* Dark Theme Adjustments */
    @media (prefers-color-scheme: dark) {
        .card {
            border-color: var(--color-surface-200);
        }

        .card:hover {
            border-color: var(--color-border);
        }

        .card.glow-primary {
            border-color: var(--color-primary);
        }
    }
</style>
