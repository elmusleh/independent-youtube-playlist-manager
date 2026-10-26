<script lang="ts">
  import type { MetadataEngineStatus } from "../../services/metadata-engines";

  let { engines }: { engines: MetadataEngineStatus[] } = $props();
</script>

<div class="engine-list">
  {#each engines as engine (engine.id)}
    <div class="engine-row">
      <span class="engine-dot" class:on={engine.enabled}></span>
      <div class="engine-text">
        <div class="engine-label">
          {engine.label}
          {#if !engine.providesDuration}
            <span class="engine-tag">no duration</span>
          {/if}
        </div>
        <div class="engine-hint">{engine.hint}</div>
      </div>
      <span class="engine-state">{engine.enabled ? "Enabled" : "Disabled"}</span>
    </div>
  {/each}
</div>

<style>
  .engine-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
  }

  .engine-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: var(--space-2, 8px) 0;
    border-bottom: 1px solid var(--color-border-secondary, var(--border-color));
  }

  .engine-row:last-child {
    border-bottom: none;
  }

  .engine-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color-text-tertiary, var(--text-muted));
    flex-shrink: 0;
  }

  .engine-dot.on {
    background-color: var(--color-success, #22c55e);
  }

  .engine-text {
    min-width: 0;
  }

  .engine-label {
    font-weight: var(--font-weight-medium, 500);
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    flex-wrap: wrap;
  }

  .engine-tag {
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-tertiary, var(--text-muted));
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: 999px;
    padding: 0 var(--space-2, 8px);
  }

  .engine-hint {
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-tertiary, var(--text-muted));
  }

  .engine-state {
    margin-left: auto;
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-secondary, var(--text-muted));
    flex-shrink: 0;
  }
</style>
