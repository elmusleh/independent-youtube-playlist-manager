<script lang="ts">
  import type { MetadataEngineStatus } from "../../services/metadata-engines";

  let { engines }: { engines: MetadataEngineStatus[] } = $props();
</script>

<div class="engine-list">
  {#each engines as engine (engine.id)}
    <details class="engine-row" class:future={engine.badgeKind === "future"}>
      <summary class="engine-summary">
        <span class="engine-dot" class:on={engine.enabled}></span>
        <span class="engine-label">
          {engine.label}
          <span class="engine-tag {engine.badgeKind}">{engine.badge}</span>
        </span>
        <span class="engine-state">{engine.state}</span>
      </summary>

      <div class="engine-details">
        <p class="engine-description">{engine.description}</p>
        <dl class="engine-facts">
          <div>
            <dt>Cost</dt>
            <dd>{engine.cost}</dd>
          </div>
          <div>
            <dt>Requests</dt>
            <dd>{engine.requests}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{engine.duration}</dd>
          </div>
        </dl>
        <p class="engine-note"><strong>Best for:</strong> {engine.bestFor}</p>
        <p class="engine-note muted"><strong>Watch out:</strong> {engine.caveat}</p>
      </div>
    </details>
  {/each}
</div>

<style>
  .engine-list {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--color-border-secondary, var(--border-color));
  }

  .engine-row {
    border-bottom: 1px solid var(--color-border-secondary, var(--border-color));
  }

  .engine-row:last-child {
    border-bottom: none;
  }

  .engine-summary {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: var(--space-3, 12px) 0;
    cursor: pointer;
    list-style: none;
  }

  .engine-summary::-webkit-details-marker {
    display: none;
  }

  .engine-summary::after {
    content: "›";
    margin-left: var(--space-2, 8px);
    color: var(--color-text-tertiary, var(--text-muted));
    font-size: 18px;
    line-height: 1;
    transition: transform 150ms ease;
    flex-shrink: 0;
  }

  .engine-row[open] .engine-summary::after {
    transform: rotate(90deg);
  }

  .engine-summary:focus-visible {
    outline: 2px solid var(--color-brand-primary, var(--primary-color));
    outline-offset: 2px;
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

  .engine-label {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    flex-wrap: wrap;
    font-weight: var(--font-weight-medium, 500);
  }

  .engine-tag {
    font-size: var(--font-size-xs, 11px);
    line-height: 18px;
    color: var(--color-text-tertiary, var(--text-muted));
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: 999px;
    padding: 0 var(--space-2, 8px);
    white-space: nowrap;
  }

  .engine-tag.beta {
    color: var(--color-brand-warning, #f59e0b);
    border-color: color-mix(in srgb, var(--color-brand-warning, #f59e0b) 40%, transparent);
  }

  .engine-tag.official {
    color: var(--color-brand-success, #22c55e);
    border-color: color-mix(in srgb, var(--color-brand-success, #22c55e) 40%, transparent);
  }

  .engine-tag.community {
    color: var(--color-brand-info, #3b82f6);
    border-color: color-mix(in srgb, var(--color-brand-info, #3b82f6) 40%, transparent);
  }

  .engine-tag.future {
    color: var(--color-text-tertiary, var(--text-muted));
    border-style: dashed;
  }

  .engine-state {
    margin-left: auto;
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-secondary, var(--text-muted));
    flex-shrink: 0;
  }

  .engine-row.future .engine-label {
    color: var(--color-text-secondary, var(--text-muted));
  }

  .engine-details {
    padding: 0 0 var(--space-3, 12px) calc(8px + var(--space-3, 12px));
  }

  .engine-description {
    margin: 0 0 var(--space-2, 8px);
    font-size: var(--font-size-sm, 13px);
    line-height: 1.5;
    color: var(--color-text-secondary, var(--text-muted));
  }

  .engine-facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2, 8px);
    margin: 0 0 var(--space-2, 8px);
  }

  .engine-facts div {
    min-width: 0;
  }

  .engine-facts dt {
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-tertiary, var(--text-muted));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .engine-facts dd {
    margin: 2px 0 0;
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-secondary, var(--text-muted));
    overflow-wrap: anywhere;
  }

  .engine-note {
    margin: 0 0 4px;
    font-size: var(--font-size-xs, 11px);
    line-height: 1.45;
    color: var(--color-text-secondary, var(--text-muted));
  }

  .engine-note.muted {
    color: var(--color-text-tertiary, var(--text-muted));
  }

  @media (max-width: 600px) {
    .engine-facts {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .engine-state {
      font-size: 10px;
    }
  }
</style>
