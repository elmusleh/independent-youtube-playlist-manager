<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    columns = "auto-fill",
    minWidth = "md",
    gap = "lg",
    class: className = "",
    children,
  }: {
    columns?: "auto-fill" | "auto-fit";
    minWidth?: "sm" | "md" | "lg";
    gap?: "sm" | "md" | "lg";
    class?: string;
    children?: Snippet;
  } = $props();

  const minWidthMap = {
    sm: "var(--container-sm)",
    md: "var(--container-md)",
    lg: "var(--container-lg)",
  };

  const gapMap = {
    sm: "var(--gap-md)",
    md: "var(--gap-lg)",
    lg: "var(--gap-xl)",
  };
</script>

<div
  class="card-grid {className}"
  style="
    grid-template-columns: repeat({columns}, minmax({minWidthMap[minWidth]}, 1fr));
    gap: {gapMap[gap]};
  "
>
  {#if children}{@render children()}{/if}
</div>

<style>
  .card-grid {
    display: grid;
    width: 100%;
    align-content: start;
  }

  /* Responsive adjustments for smaller screens */
  @media (max-width: 640px) {
    .card-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (min-width: 641px) and (max-width: 768px) {
    .card-grid {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
  }

  /* Masonry-like behavior with CSS columns for settings page */
  .card-grid.masonry {
    column-count: 1;
    column-gap: var(--gap-lg);
  }

  @media (min-width: 641px) {
    .card-grid.masonry {
      column-count: 2;
    }
  }

  @media (min-width: 1024px) {
    .card-grid.masonry {
      column-count: 3;
    }
  }

  .card-grid.masonry :global(> *) {
    break-inside: avoid;
    margin-bottom: var(--gap-lg);
  }
</style>
