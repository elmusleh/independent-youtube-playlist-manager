<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faCircleCheck,
    faCircleExclamation,
    faArrowUp,
    faArrowDown,
    faListCheck,
  } from "@fortawesome/free-solid-svg-icons";
  import Modal from "../Modal.svelte";
  import SimpleButton from "../SimpleButton.svelte";
  import type { SyncRunReport } from "../../services/sync/sync-report.js";

  let {
    open = $bindable(false),
    report,
  }: {
    open?: boolean;
    report: SyncRunReport | null;
  } = $props();

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }
</script>

<Modal bind:display={open} title="Sync Status Report" size="standard">
  {#snippet children()}
    {#if report}
      <div class="report-banner" class:ok={report.ok} class:err={!report.ok}>
        <Fa icon={report.ok ? faCircleCheck : faCircleExclamation} size="lg" />
        <div class="report-banner-text">
          <strong>{report.ok ? "Sync completed" : "Sync encountered an issue"}</strong>
          <span>{report.summary}</span>
          {#if report.error && report.error !== report.summary}
            <span class="report-err-detail">{report.error}</span>
          {/if}
        </div>
      </div>

      <div class="report-metrics">
        <div class="metric-box">
          <span class="metric-label">Uploaded</span>
          <strong class="metric-value">
            <Fa icon={faArrowUp} />
            {report.pushedCount}
          </strong>
        </div>
        <div class="metric-box">
          <span class="metric-label">Applied</span>
          <strong class="metric-value">
            <Fa icon={faArrowDown} />
            {report.pulledCount}
          </strong>
        </div>
        <div class="metric-box">
          <span class="metric-label">Devices</span>
          <strong class="metric-value">{report.knownDevices}</strong>
        </div>
        <div class="metric-box">
          <span class="metric-label">Duration</span>
          <strong class="metric-value">{formatDuration(report.durationMs)}</strong>
        </div>
      </div>

      <p class="endpoint-line">
        Relay endpoint: <code>{report.endpointHost}</code>
      </p>

      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Scope</th>
              <th>Applied</th>
              <th>Local state after sync</th>
            </tr>
          </thead>
          <tbody>
            {#each report.rows as row}
              <tr>
                <td><strong>{row.label}</strong></td>
                <td>
                  {#if row.enabled}
                    <span class="sync-badge sync-badge-yes">Synced</span>
                  {:else}
                    <span class="sync-badge sync-badge-no">Disabled</span>
                  {/if}
                </td>
                <td>{row.enabled ? `↓ ${row.applied}` : "—"}</td>
                <td>{row.localSummary}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="report-actions">
        <a href="#/logs" class="api-link" onclick={() => (open = false)}>
          <Fa icon={faListCheck} /> Open [SYNC] System Logs
        </a>
        <SimpleButton onclick={() => (open = false)}>Done</SimpleButton>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  .report-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: 10px;
    margin-bottom: 1rem;
    border: 1px solid var(--border, #e5e7eb);
  }
  .report-banner.ok {
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.35);
    color: var(--success, #10b981);
  }
  .report-banner.err {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.35);
    color: var(--danger, #ef4444);
  }
  .report-banner-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    color: var(--foreground, #111);
    font-size: 0.875rem;
  }
  .report-err-detail {
    color: var(--danger, #ef4444);
    font-size: 0.8rem;
  }
  .report-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.85rem;
  }
  .metric-box {
    padding: 0.6rem 0.5rem;
    border-radius: 8px;
    background: var(--muted, #f3f4f6);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .metric-label {
    font-size: 0.72rem;
    color: var(--muted-foreground, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .metric-value {
    font-size: 0.95rem;
    color: var(--foreground, #111);
  }
  .endpoint-line {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    color: var(--muted-foreground, #6b7280);
  }
  .report-table-wrap {
    overflow-x: auto;
    margin-bottom: 1rem;
  }
  .report-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  .report-table th,
  .report-table td {
    text-align: left;
    padding: 0.5rem 0.45rem;
    border-bottom: 1px solid var(--border, #e5e7eb);
  }
  .report-table th {
    font-size: 0.72rem;
    text-transform: uppercase;
    color: var(--muted-foreground, #6b7280);
  }
  .report-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
</style>
