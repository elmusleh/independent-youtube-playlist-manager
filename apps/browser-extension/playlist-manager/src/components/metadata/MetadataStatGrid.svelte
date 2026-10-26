<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faVideo,
    faCircleCheck,
    faTriangleExclamation,
    faBroadcastTower,
    faLock,
  } from "@fortawesome/free-solid-svg-icons";
  import type { MetadataGapSummary } from "../../utils/metadata-completeness";

  let { summary }: { summary: MetadataGapSummary } = $props();

  const cards = $derived([
    {
      key: "total",
      icon: faVideo,
      value: summary.total,
      label: "Cached entries",
      ok: false,
      warn: false,
    },
    {
      key: "complete",
      icon: faCircleCheck,
      value: summary.complete,
      label: "Complete",
      ok: true,
      warn: false,
    },
    {
      key: "attention",
      icon: faTriangleExclamation,
      value: summary.needsAttention,
      label: "Needs attention",
      ok: false,
      warn: true,
    },
    {
      key: "duration",
      icon: faTriangleExclamation,
      value: summary.durationRecoverable,
      label: "Missing duration",
      ok: false,
      warn: true,
    },
    {
      key: "live",
      icon: faBroadcastTower,
      value: summary.live,
      label: "Live streams",
      ok: false,
      warn: false,
    },
    {
      key: "terminal",
      icon: faLock,
      value: summary.terminal,
      label: "Private / deleted",
      ok: false,
      warn: false,
    },
  ]);
</script>

<div class="stat-grid">
  {#each cards as card (card.key)}
    <div class="stat-card" class:ok={card.ok} class:warn={card.warn}>
      <span class="stat-icon"><Fa icon={card.icon} /></span>
      <div class="stat-value">{card.value}</div>
      <div class="stat-label">{card.label}</div>
    </div>
  {/each}
</div>

<style>
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-3, 12px);
    margin-bottom: var(--space-5, 20px);
  }

  .stat-card {
    background-color: var(--color-bg-elevated, var(--background-color));
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: var(--radius-card, 10px);
    padding: var(--space-4, 16px);
    text-align: center;
  }

  .stat-icon {
    display: inline-flex;
    color: var(--color-text-tertiary, var(--text-muted));
    margin-bottom: var(--space-1, 4px);
  }

  .stat-card.ok .stat-icon {
    color: var(--color-success, #22c55e);
  }

  .stat-card.warn .stat-icon {
    color: var(--color-warning, #f59e0b);
  }

  .stat-value {
    font-size: var(--font-size-2xl, 24px);
    font-weight: var(--font-weight-bold, 700);
    line-height: 1.1;
  }

  .stat-label {
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-tertiary, var(--text-muted));
    margin-top: var(--space-1, 4px);
  }
</style>
