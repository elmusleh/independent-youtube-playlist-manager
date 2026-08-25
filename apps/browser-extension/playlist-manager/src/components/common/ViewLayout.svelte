<script lang="ts">
  let {
    id = "",
    className = "",
    children,
  }: {
    id?: string;
    className?: string;
    children?: import("svelte").Snippet;
  } = $props();
</script>

<div {id} class="view-container {className}">
  {@render children?.()}
</div>

<style>
  @import "../../css/view-layout.css";
</style>
