<script lang="ts">
  import Fa from "svelte-fa";
  import { faClock, faLink } from "@fortawesome/free-solid-svg-icons";

  let {
    syncIsOn,
    isSyncing,
    lastSyncedAt,
    knownDevices,
    formatWhen,
  }: {
    syncIsOn: boolean;
    isSyncing: boolean;
    lastSyncedAt: number | null;
    knownDevices: number;
    formatWhen: (ts: number | null) => string;
  } = $props();
</script>

{#if syncIsOn && !isSyncing && lastSyncedAt}
  <section class="last-sync-summary">
    <Fa icon={faClock} />
    <span>Last full sync: <strong>{formatWhen(lastSyncedAt)}</strong></span>
    {#if knownDevices > 1}
      <span class="devices-note"><Fa icon={faLink} /> {knownDevices} devices connected</span>
    {/if}
  </section>
{/if}

<style>
  .last-sync-summary {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--muted, #f9fafb);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: var(--muted-foreground, #6b7280);
  }
  .last-sync-summary strong {
    color: var(--foreground, #111);
  }
  .devices-note {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--accent, #3b82f6);
  }
</style>
