<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faInfoCircle,
    faCircleCheck,
    faCircleExclamation,
    faPauseCircle,
    faClock,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";

  type LogEntry = {
    time: number;
    message: string;
    type: "info" | "success" | "error" | "warning";
  };

  let {
    entries,
  }: {
    entries: LogEntry[];
  } = $props();

  let showSyncLog = $state(true);
</script>

<!-- Sync Activity Log -->
<section class="card sync-log-section">
  <div class="log-header">
    <h3><Fa icon={faInfoCircle} /> Sync Activity</h3>
    <SimpleButton secondary onclick={() => (showSyncLog = !showSyncLog)}>
      <Fa icon={faClock} />
      {showSyncLog ? "Hide" : "Show"} Log
    </SimpleButton>
  </div>
  {#if showSyncLog}
    <div class="sync-log">
      {#if entries.length === 0}
        <p class="sub-text empty-log">No sync activity yet. Click "Sync now" to start.</p>
      {:else}
        {#each entries as entry (entry.time + entry.message)}
          <div class="log-entry type-{entry.type}">
            <Fa
              icon={entry.type === "success"
                ? faCircleCheck
                : entry.type === "error"
                  ? faCircleExclamation
                  : entry.type === "warning"
                    ? faPauseCircle
                    : faInfoCircle}
            />
            <span class="log-time">{new Date(entry.time).toLocaleString()}</span>
            <span class="log-message">{entry.message}</span>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</section>

<style>
  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .sync-log {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    background: var(--bg-secondary, #f9fafb);
  }
  .log-entry {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    font-size: 0.8rem;
  }
  .log-entry:last-child {
    border-bottom: none;
  }
  .log-entry.type-success .log-message {
    color: var(--success, #10b981);
  }
  .log-entry.type-error .log-message {
    color: var(--danger, #ef4444);
  }
  .log-entry.type-warning .log-message {
    color: var(--warning, #f59e0b);
  }
  .log-time {
    font-variant-numeric: tabular-nums;
    color: var(--text-muted, #9ca3af);
    min-width: 150px;
    font-size: 0.75rem;
  }
  .empty-log {
    padding: 1.5rem;
    text-align: center;
    color: var(--muted-foreground, #9ca3af);
  }
</style>
