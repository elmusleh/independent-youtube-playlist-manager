<script lang="ts">
  import { onMount } from "svelte";

  let {
    children,
    subBar,
  }: {
    children?: import("svelte").Snippet;
    subBar?: import("svelte").Snippet;
  } = $props();

  let isStuck = $state(false);

  onMount(() => {
    let raf = 0;
    const update = () => {
      // The header floats (sticks below the fixed app header) as soon as the
      // page scrolls. Elevate it only then so the resting state stays clean.
      isStuck = window.scrollY > 4;
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  });
</script>

<div class="sticky-header-container" class:is-stuck={isStuck}>
  <div class="sticky-header-primary">
    {@render children?.()}
  </div>
  {#if subBar}
    <div class="sticky-header-sub">
      {@render subBar()}
    </div>
  {/if}
</div>

<style>
  .sticky-header-container {
    position: sticky;
    top: var(--app-header-height);
    z-index: 10;
    background-color: var(--background-color);
    flex-shrink: 0;
    /* Break out of the .view-body horizontal padding so the
       sticky header spans the full width of the view. */
    margin: 0 -24px;
    border-bottom: 1px solid transparent;
    transition:
      box-shadow var(--transition-smooth),
      border-bottom-color var(--transition-smooth);
  }

  .sticky-header-container.is-stuck {
    border-bottom-color: var(--border-color);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }

  :global([data-theme="dark"]) .sticky-header-container.is-stuck {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  @media (max-width: 768px) {
    .sticky-header-container {
      margin: 0 -16px;
    }
  }
</style>
