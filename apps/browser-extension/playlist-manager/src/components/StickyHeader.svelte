<script lang="ts">
  import { onMount } from "svelte";
  import { getScrollParent } from "../utils/scroll-parent.js";

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
    const scroller = getScrollParent(subEl);
    let raf = 0;
    const update = () => {
      isStuck = scroller.scrollTop > 4;
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
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
  .sticky-header-primary,
  .sticky-header-sub {
    background-color: var(--background-color);
    /* Break out of the .view-body horizontal padding so the header spans the
       full width of the view. */
    margin: 0 -24px;
  }

  /* Only the sub-bar (selection toolbar) sticks; the title scrolls away. */
  .sticky-header-sub {
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid transparent;
    transition:
      box-shadow var(--transition-smooth),
      border-bottom-color var(--transition-smooth);
  }

  .sticky-header-sub.is-stuck {
    border-bottom-color: var(--border-color);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }

  :global([data-theme="dark"]) .sticky-header-sub.is-stuck {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  @media (max-width: 768px) {
    .sticky-header-primary,
    .sticky-header-sub {
      margin: 0 -16px;
    }
  }
</style>
