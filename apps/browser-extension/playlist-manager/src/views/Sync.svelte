<script lang="ts">
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import {
    faArrowsRotate,
    faLink,
    faCheck,
    faCircleCheck,
    faCircleExclamation,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import SyncKeyCard from "../components/sync/SyncKeyCard.svelte";
  import SupabaseCard from "../components/sync/SupabaseCard.svelte";
  import RelayCard from "../components/sync/RelayCard.svelte";
  import FileSyncCard from "../components/sync/FileSyncCard.svelte";
  import {
    loadSyncConfig,
    saveSyncConfig,
    DEFAULT_SYNC_CONFIG,
    isRelayConfigured,
    type SyncConfig,
    type SyncBackend,
  } from "../services/sync/sync-config.js";
  import { detectCapabilities } from "../services/sync/capabilities.js";
  import { requestSyncHostPermission } from "../services/sync/host-permissions.js";
  import { storeFolderHandle } from "../services/sync/file-sync-service.js";
  import { getSyncStatus, triggerSyncNow, startPolling } from "../services/sync-manager.js";

  const caps = detectCapabilities();
  const status = new StatusManager();

  let config = $state<SyncConfig>({
    ...DEFAULT_SYNC_CONFIG,
    content: { ...DEFAULT_SYNC_CONFIG.content },
  });
  let lastSyncedAt = $state<number | null>(null);
  let lastError = $state<string | null>(null);
  let lastSyncSummary = $state<string | null>(null);
  let knownDevices = $state(0);
  let isSyncing = $state(false);

  onMount(() => {
    startPolling();
    // Refresh the status banner periodically so a background sync updates it.
    const timer = setInterval(refreshStatus, 10_000);
    refresh();
    return () => clearInterval(timer);
  });

  const syncIsOn = $derived(!!(config.syncKey && config.backends.length > 0));

  function hintFor(c: SyncConfig): string | null {
    if (!c.syncKey) return "Generate or paste a sync key to begin.";
    if (c.backends.length === 0) return "Turn on a sync option below to start syncing.";
    return null;
  }
  const setupHint = $derived(hintFor(config));

  async function persist() {
    await status.save(() => saveSyncConfig(config));
  }

  async function refresh() {
    await status.refresh(async () => {
      config = await loadSyncConfig();
      await refreshStatus();
    });
  }

  async function refreshStatus() {
    const s = await getSyncStatus();
    lastSyncedAt = s.lastSyncedAt;
    lastError = s.lastError;
    lastSyncSummary = s.lastSyncSummary;
    knownDevices = s.knownDevices;
    isSyncing = s.isSyncing;
  }

  function toggleBackend(backend: SyncBackend, enabled: boolean) {
    const set = new Set(config.backends);
    if (enabled) set.add(backend);
    else set.delete(backend);
    config.backends = [...set];
    persist();
  }

  function setUrl(value: string) {
    config.supabaseUrl = value;
    persist();
  }

  function setKey(value: string) {
    config.supabaseKey = value;
    persist();
  }

  async function chooseFolder() {
    try {
      const handle = await (window as any).showDirectoryPicker();
      await storeFolderHandle(handle);
      persist();
    } catch {
      // User cancelled the picker — leave the selection unchanged.
    }
  }

  async function syncNow() {
    if (config.backends.includes("supabase-byo")) {
      const permissions =
        (globalThis as any).browser?.permissions || (globalThis as any).chrome?.permissions;
      const granted = await requestSyncHostPermission(config.supabaseUrl, permissions);
      if (!granted) {
        lastError =
          "Allow secure access to your Supabase project before syncing. Check its HTTPS URL and try again.";
        lastSyncSummary = "Supabase permission was not granted.";
        return;
      }
    }
    lastError = null;
    await triggerSyncNow();
    await refreshStatus();
  }

  function toggleContent(key: "playlists" | "settings" | "history") {
    config.content[key] = !config.content[key];
    persist();
  }

  function formatWhen(ts: number | null): string {
    if (!ts) return "Never synced yet";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
    return new Date(ts).toLocaleString();
  }
</script>

<main class="view-scroll-container">
  <div class="view-body sync-page">
    <StickyHeader>
      {#snippet children()}
        <ViewHeader icon={faArrowsRotate} title="Sync">
          {#snippet rightActions()}
            <SaveStatus onclick={refresh} {status} />
          {/snippet}
        </ViewHeader>
      {/snippet}
    </StickyHeader>

    <!-- Status banner: full-width, colour-coded, at the top -->
    <section class="sync-status-banner" class:active={syncIsOn}>
      <Fa icon={syncIsOn ? faCircleCheck : faCircleExclamation} class="status-icon" />
      <div class="status-body">
        <h3>
          {#if syncIsOn}
            Sync is on across {knownDevices > 0 ? knownDevices : 1}
            {knownDevices > 1 ? " devices" : " device"}
          {:else}
            Sync is not set up yet
          {/if}
        </h3>
        <p class="sub-text">
          {#if setupHint}
            {setupHint}
          {:else}
            Last synced: {formatWhen(lastSyncedAt)}
            {#if lastSyncSummary}<br />{lastSyncSummary}{/if}
            {#if lastError}<br /><span class="sync-error">⚠ {lastError}</span>{/if}
          {/if}
        </p>
        {#if syncIsOn}
          <p class="sub-text">
            Changes sync automatically — they appear on your other devices within a minute.
          </p>
        {/if}
      </div>
      <SimpleButton secondary onclick={syncNow} disabled={isSyncing}>
        <Fa icon={faArrowsRotate} />
        {isSyncing ? "Syncing…" : "Sync now"}
      </SimpleButton>
    </section>

    <div class="settings-grid">
      <RelayCard
        enabled={config.backends.includes("relay")}
        ready={isRelayConfigured()}
        onToggle={(v) => toggleBackend("relay", v)}
      />

      <SupabaseCard
        enabled={config.backends.includes("supabase-byo")}
        url={config.supabaseUrl}
        key={config.supabaseKey}
        onToggle={(v) => toggleBackend("supabase-byo", v)}
        onSetUrl={setUrl}
        onSetKey={setKey}
      />

      <FileSyncCard
        enabled={config.backends.includes("file")}
        {caps}
        onToggle={(v) => toggleBackend("file", v)}
        onChooseFolder={chooseFolder}
      />

      <!-- Your sync key -->
      <SyncKeyCard {config} onPersist={persist} />

      <!-- What to sync -->
      <section class="card">
        <h3><Fa icon={faCheck} /> What to sync</h3>
        <div class="toggle-row">
          <div class="toggle-info">
            <span>Playlists</span>
            <span class="sub-text">Your saved and local playlists.</span>
          </div>
          <input
            type="checkbox"
            checked={config.content.playlists}
            onchange={() => toggleContent("playlists")}
          />
        </div>
        <div class="toggle-row">
          <div class="toggle-info">
            <span>Settings</span>
            <span class="sub-text">Your preferences across devices.</span>
          </div>
          <input
            type="checkbox"
            checked={config.content.settings}
            onchange={() => toggleContent("settings")}
          />
        </div>
        <div class="toggle-row">
          <div class="toggle-info">
            <span>Watch history</span>
            <span class="sub-text">What you have watched on each device.</span>
          </div>
          <input
            type="checkbox"
            checked={config.content.history}
            onchange={() => toggleContent("history")}
          />
        </div>
      </section>

      <!-- API setup (folded in) -->
      <section class="card">
        <h3><Fa icon={faLink} /> YouTube Data API</h3>
        <p class="sub-text">
          Optional. Connect a YouTube Data API key for faster, quota-backed metadata.
        </p>
        <a href="#/api-setup" class="api-link">
          <Fa icon={faLink} /> Open API setup
        </a>
      </section>
    </div>
  </div>
</main>
