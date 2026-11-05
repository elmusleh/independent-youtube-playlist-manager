<script lang="ts">
  import { onMount } from "svelte";
  import { getHeaderHeight, resetHeaderHeight } from "../utils/header-height.js";

  let {
    children,
    subBar,
  }: {
    children?: import("svelte").Snippet;
    subBar?: import("svelte").Snippet;
  } = $props();

  let subEl = $state<HTMLDivElement | undefined>(undefined);
  let isStuck = $state(false);

  onMount(() => {
    if (!subEl) return;
    const el = subEl;
    let raf = 0;
    const update = () => {
      // Stuck when the bar's top edge has reached the sticky offset (the fixed
      // header height). getBoundingClientRect().top sits exactly at that offset
      // once the element is pinned, and above it while it still scrolls.
      isStuck = el.getBoundingClientRect().top <= getHeaderHeight() + 1;
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    const onResize = () => {
      resetHeaderHeight();
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  });
</script>

<div class="sticky-header-primary">
  {@render children?.()}
</div>
{#if subBar}
  <div class="sticky-header-sub" class:is-stuck={isStuck} bind:this={subEl}>
    {@render subBar()}
  </div>
{/if}

<style>
  /* The title stays in normal flow and spans the full view width (its own
     24px padding re-aligns the text with the content column). */
  .sticky-header-primary {
    background-color: var(--background-color);
    margin: 0 -24px;
  }

  /* The selection toolbar sticks below the fixed app header and keeps the same
     width as the content column below it (no negative margin). */
  .sticky-header-sub {
    position: sticky;
    top: var(--app-header-height);
    z-index: 10;
    background-color: var(--background-color);
    border-bottom: 1px solid transparent;
    transition:
      box-shadow var(--transition-smooth),
      border-bottom-color var(--transition-smooth);
  }

  .sticky-header-sub.is-stuck {
    border-bottom-color: var(--border-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }

  :global([data-theme="dark"]) .sticky-header-sub.is-stuck {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  @media (max-width: 768px) {
    .sticky-header-primary {
      margin: 0 -16px;
    }
  }

  /* Disable pinning on short/landscape screens so the toolbar does not eat the
     limited vertical space. This lives here (scoped) so it wins over the base
     .sticky-header-sub { position: sticky } rule above. */
  @media (max-height: 480px) and (max-width: 1024px) {
    .sticky-header-sub {
      position: static;
    }
  }
</style>
