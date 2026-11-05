<script lang="ts">
  import Fa from "svelte-fa";
  import { faClock, faLink, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
  import type { LocalSyncInventory } from "../../services/sync/sync-report.js";
  import type { SyncContentSelection } from "../../services/sync/sync-config.js";

  let {
    syncIsOn,
    isSyncing,
    lastSyncedAt,
    knownDevices,
    formatWhen,
    inventory = null,
    content = null,
  }: {
    syncIsOn: boolean;
    isSyncing: boolean;
    lastSyncedAt: number | null;
    knownDevices: number;
    formatWhen: (ts: number | null) => string;
    inventory?: LocalSyncInventory | null;
    content?: SyncContentSelection | null;
  } = $props();

  const scopeSummary = $derived.by(() => {
    if (!content) return "";
    const parts: string[] = [];
    if (content.playlists !== false) {
      parts.push(inventory ? `Playlists (${inventory.playlistsCount})` : "Playlists");
    }
    if (content.history === true) {
      parts.push(inventory ? `History (${inventory.historyCount})` : "History");
    }
    if (content.settings === true) {
      parts.push("Settings & Pinned");
    }
    return parts.length > 0 ? parts.join(" · ") : "Device presence only";
  });
</script>

{#if syncIsOn && !isSyncing}
  <section class="last-sync-summary">
    <span class="summary-item">
      <Fa icon={faClock} />
      <span>
        Last full sync:
        <strong>{lastSyncedAt ? formatWhen(lastSyncedAt) : "Never (ready for first sync)"}</strong>
      </span>
    </span>
    <span class="devices-note">
      <Fa icon={faLink} />
      {knownDevices > 1
        ? `${knownDevices} devices connected`
        : lastSyncedAt
          ? "1 device connected"
          : "Awaiting first sync"}
    </span>
    {#if scopeSummary}
      <span class="scope-note">
        <Fa icon={faLayerGroup} /> Will sync: <strong>{scopeSummary}</strong>
      </span>
    {/if}
  </section>
{/if}

<style>
  .last-sync-summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    padding: 0.75rem 1rem;
    background: var(--muted, #f9fafb);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: var(--muted-foreground, #6b7280);
  }
  .summary-item,
  .devices-note,
  .scope-note {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .last-sync-summary strong {
    color: var(--foreground, #111);
  }
  .devices-note {
    color: var(--accent, #3b82f6);
  }
</style>
