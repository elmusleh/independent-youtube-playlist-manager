<script lang="ts">
  let {
    progress = 0,
    text = ""
  }: {
    progress?: number | null;
    text?: string;
  } = $props();
</script>

{#if progress !== null && progress !== undefined}
<div class="progress-container">
  <div class="progress-bar-bg">
    <div class="progress-bar-fill" style="width: {Math.max(0, Math.min(100, progress))}%"></div>
  </div>
  {#if text}
    <div class="progress-text">{text} ({Math.round(progress)}%)</div>
  {/if}
</div>
{/if}

<style>
  .progress-container {
    padding: 0.5rem 1rem;
    background-color: var(--surface-color, #1e1e1e);
    border-bottom: 1px solid var(--border-color, #333);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-bar-bg {
    width: 100%;
    height: 4px;
    background-color: var(--border-color, #333);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background-color: var(--primary-color, #3ea6ff);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 12px;
    color: var(--text-muted, #aaa);
    text-align: right;
  }
</style>
