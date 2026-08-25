<script lang="ts">
  let {
    children,
    subBar,
  }: {
    children?: import("svelte").Snippet;
    subBar?: import("svelte").Snippet;
  } = $props();
</script>

<div class="sticky-header-container">
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
    top: 0;
    z-index: 10;
    background-color: var(--background-color);
    flex-shrink: 0;
    /* Break out of the .view-body horizontal padding so the
       sticky header spans the full width of the view. */
    margin: 0 -24px;
  }

  @media (max-width: 768px) {
    .sticky-header-container {
      margin: 0 -16px;
    }
  }
</style>
