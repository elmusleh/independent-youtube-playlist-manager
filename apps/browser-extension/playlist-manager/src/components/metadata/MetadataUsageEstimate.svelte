<script lang="ts">
  import type { MetadataGapSummary } from "../../utils/metadata-completeness";
  import { estimateMetadataUsage } from "../../utils/metadata-estimate";
  import type { DataApiHealth } from "../../services/data-api-health";

  let {
    summary,
    dataApiReady = false,
    dataApiState = "Not configured",
    health = null,
  }: {
    summary: MetadataGapSummary;
    dataApiReady?: boolean;
    dataApiState?: string;
    health?: DataApiHealth | null;
  } = $props();

  let apiLabel = $derived.by(() => {
    if (!dataApiReady) return "API not configured";
    if (!health || health.state === "unknown") {
      return dataApiState === "Signed in" ? "API signed in" : "API ready";
    }
    if (health.blockedUntil > Date.now()) {
      if (health.state === "quota_exceeded") return "API quota paused";
      if (health.state === "rate_limited") return "API rate-limited";
      if (health.state === "invalid") return "API key invalid";
    }
    return health.state === "ok" ? "API healthy" : "API ready";
  });

  let estimate = $derived(estimateMetadataUsage(summary));
  let needsWork = $derived(estimate.needsWork);
  let durationOnly = $derived(estimate.durationOnly);
  let otherGaps = $derived(estimate.otherGaps);
  let resolved = $derived(estimate.resolved);
  let apiRequests = $derived(estimate.apiRequests);
  let quotaPercent = $derived(estimate.quotaPercent);
  let refreshesPerDay = $derived(estimate.refreshesPerDay);

  function percent(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value < 0.01) return "<0.01";
    if (value < 1) return value.toFixed(2);
    return value.toFixed(0);
  }

  function count(value: number): string {
    return value.toLocaleString();
  }

  function plural(value: number, one: string, many: string): string {
    return value === 1 ? one : many;
  }
</script>

<div class="estimate-head">
  <span class="estimate-context">
    Based on {count(summary.total)} cached entries. Estimates cover the current cache only.
  </span>
  <span
    class="api-status"
    class:ok={dataApiReady &&
      (!health || health.state === "ok" || health.blockedUntil <= Date.now())}
    class:warn={health?.state === "rate_limited" && health.blockedUntil > Date.now()}
    class:error={health?.state === "quota_exceeded" || health?.state === "invalid"}
    title={health?.message || ""}
  >
    {apiLabel}
  </span>
</div>

<div class="estimate-grid">
  <div class="estimate-card">
    <span class="estimate-label">Needs work</span>
    <strong>{count(needsWork)}</strong>
    <span class="estimate-detail">
      {count(durationOnly)} duration-only · {count(otherGaps)} other gaps
    </span>
  </div>

  <div class="estimate-card">
    <span class="estimate-label">Data API requests</span>
    <strong>{count(apiRequests)}</strong>
    <span class="estimate-detail">
      {count(needsWork)} IDs ÷ 50 = {count(apiRequests)} quota
      {plural(apiRequests, "unit", "units")}
    </span>
  </div>

  <div class="estimate-card">
    <span class="estimate-label">Free daily quota</span>
    <strong>{percent(quotaPercent)}%</strong>
    <span class="estimate-detail">of 10,000 units/day</span>
  </div>

  <div class="estimate-card">
    <span class="estimate-label">Resolved / terminal</span>
    <strong>{count(resolved)}</strong>
    <span class="estimate-detail">0 requests</span>
  </div>
</div>

<div class="quota-track" aria-hidden="true">
  <span class:empty={apiRequests === 0} style:width={`${Math.min(100, quotaPercent)}%`}></span>
</div>

<p class="estimate-note">
  {#if apiRequests === 0}
    Nothing is queued — no Data API requests are needed right now.
  {:else if quotaPercent <= 1}
    This uses less than 1% of the daily free quota — no scheduling needed.
  {:else if quotaPercent <= 100}
    This fits in one day of free quota. You could run this pass roughly
    {count(refreshesPerDay)}
    {plural(refreshesPerDay, "time", "times")} per day.
  {:else}
    This exceeds one day of free quota. Split it across days, or use a hosted proxy with a
    server-side key.
  {/if}
</p>

<details class="estimate-help">
  <summary>How this estimate works</summary>
  <p>
    One Data API request handles up to 50 unique video IDs and costs 1 quota unit. The free daily
    quota is 10,000 units, or roughly 500,000 videos. Open playlists to load more entries; retries
    and failed videos can add requests.
  </p>
  <p>
    Without a Data API key, Innertube still attempts these videos without quota. The numbers show
    the Data API cost if you add a free key or sign in.
  </p>
  <p><a href="#/api-setup">Open API Setup</a> to configure the fallback.</p>
</details>

<style>
  .estimate-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 8px);
    flex-wrap: wrap;
    margin-bottom: var(--space-3, 12px);
  }

  .estimate-context {
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-tertiary, var(--text-muted));
  }

  .api-status {
    flex-shrink: 0;
    padding: 1px var(--space-2, 8px);
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: 999px;
    font-size: 10px;
    line-height: 18px;
    color: var(--color-text-tertiary, var(--text-muted));
    white-space: nowrap;
  }

  .api-status.ok {
    color: var(--color-brand-success, #22c55e);
    border-color: color-mix(in srgb, var(--color-brand-success, #22c55e) 40%, transparent);
  }

  .api-status.warn {
    color: var(--color-brand-warning, #f59e0b);
    border-color: color-mix(in srgb, var(--color-brand-warning, #f59e0b) 40%, transparent);
  }

  .api-status.error {
    color: var(--color-brand-danger, #ef4444);
    border-color: color-mix(in srgb, var(--color-brand-danger, #ef4444) 40%, transparent);
  }

  .estimate-help {
    margin-top: var(--space-2, 8px);
    font-size: var(--font-size-sm, 13px);
    color: var(--color-text-secondary, var(--text-muted));
  }

  .estimate-help summary {
    cursor: pointer;
    color: var(--color-text-secondary, var(--text-muted));
  }

  .estimate-help p {
    margin: var(--space-2, 8px) 0 0;
    line-height: 1.5;
  }

  .estimate-help a {
    color: var(--color-brand-primary, var(--primary-color));
  }

  .estimate-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-3, 12px);
    margin-bottom: var(--space-3, 12px);
  }

  .estimate-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-3, 12px);
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: var(--radius-card, 10px);
    min-width: 0;
  }

  .estimate-label {
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-tertiary, var(--text-muted));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .estimate-card strong {
    font-size: var(--font-size-xl, 18px);
    line-height: 1.1;
  }

  .estimate-detail {
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-secondary, var(--text-muted));
    overflow-wrap: anywhere;
  }

  .quota-track {
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background-color: var(--color-bg-hover, rgba(127, 127, 127, 0.18));
    margin-bottom: var(--space-2, 8px);
  }

  .quota-track span.empty {
    min-width: 0;
  }

  .quota-track span {
    display: block;
    height: 100%;
    min-width: 2px;
    border-radius: inherit;
    background-color: var(--color-brand-primary, var(--primary-color));
    transition: width 180ms ease;
  }

  .estimate-note {
    margin: 0 0 var(--space-2, 8px);
    font-size: var(--font-size-sm, 13px);
    line-height: 1.5;
    color: var(--color-text-secondary, var(--text-muted));
  }

  .estimate-note:last-child {
    margin-bottom: 0;
  }

  @media (max-width: 900px) {
    .estimate-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .estimate-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
