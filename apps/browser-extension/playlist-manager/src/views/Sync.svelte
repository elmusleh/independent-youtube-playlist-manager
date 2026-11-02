<script lang="ts">
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import {
    faArrowsRotate,
    faKey,
    faShieldHalved,
    faCopy,
    faCheck,
    faLink,
    faCircleCheck,
    faCircleExclamation,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import BackendSection from "../components/sync/BackendSection.svelte";
  import CompatibilitySection from "../components/sync/CompatibilitySection.svelte";
  import {
    loadSyncConfig,
    saveSyncConfig,
    DEFAULT_SYNC_CONFIG,
    type SyncConfig,
    type SyncBackend,
  } from "../services/sync/sync-config.js";
  import { detectCapabilities } from "../services/sync/capabilities.js";
  import {
    generateSyncKey,
    formatSyncKey,
    isValidSyncKey,
    normalizeSyncKey,
  } from "../services/sync/sync-key.js";
  import { storeFolderHandle } from "../services/sync/file-sync-service.js";
  import { getSyncStatus, triggerSyncNow, startPolling } from "../services/sync-manager.js";

  const caps = detectCapabilities();
  const status = new StatusManager();

  let config = $state<SyncConfig>({
    ...DEFAULT_SYNC_CONFIG,
    content: { ...DEFAULT_SYNC_CONFIG.content },
  });
  let inputKey = $state("");
  let copied = $state(false);
  let error = $state("");
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

  const syncIsOn = $derived(!!(config.syncKey && config.backend));

  function hintFor(c: SyncConfig): string | null {
    if (!c.syncKey) return "Generate or paste a sync key to begin.";
    if (!c.backend) return "Choose how your data travels to start syncing.";
    if (c.backend === "relay") return "Relay not configured — use BYO or File.";
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

  function generate() {
    config.syncKey = generateSyncKey();
    inputKey = "";
    copied = false;
    error = "";
    persist();
  }

  function saveEntered() {
    const normalized = normalizeSyncKey(inputKey);
    if (!isValidSyncKey(normalized)) {
      error = "That is not a valid sync key. A key looks like ABCDE-FGHJK-MNPQR-STVWX.";
      return;
    }
    config.syncKey = formatSyncKey(normalized);
    inputKey = "";
    error = "";
    copied = false;
    persist();
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(config.syncKey ?? "");
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      error = "Could not copy. Select and copy the key manually.";
    }
  }

  function clearKey() {
    config.syncKey = null;
    error = "";
    persist();
  }

  function setBackend(backend: SyncBackend) {
    config.backend = backend;
    error = "";
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
    triggerSyncNow();
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
      </div>
      <SimpleButton secondary onclick={syncNow} disabled={isSyncing}>
        <Fa icon={faArrowsRotate} />
        {isSyncing ? "Syncing…" : "Sync now"}
      </SimpleButton>
    </section>

    <div class="settings-grid">
      <!-- How pairing works -->
      <section class="card">
        <h3><Fa icon={faKey} /> How pairing works</h3>
        <p class="sub-text">
          Pairing means using the <strong>same sync key</strong> on every device. There are no
          accounts and no separate pairing code — the key is the only credential. Keep it secret:
          <strong>lose the key and your data cannot be recovered.</strong>
        </p>
        <ol class="pairing-steps">
          <li>
            On <strong>device A</strong>, tap <em>Generate a key</em> (or copy the key you already have).
          </li>
          <li>
            Open Sync on <strong>device B</strong> — your phone, another computer — and paste that same
            key. Yes, this works on your phone too.
          </li>
          <li>Done. Both devices now read and write the same encrypted data automatically.</li>
        </ol>
      </section>

      <BackendSection
        {config}
        {caps}
        onSetBackend={setBackend}
        onChooseFolder={chooseFolder}
        onSetUrl={setUrl}
        onSetKey={setKey}
      />

      <!-- Your sync key -->
      <section class="card">
        <h3><Fa icon={faShieldHalved} /> Your sync key</h3>
        {#if config.syncKey}
          <div class="key-display">
            <code class="key-value">{config.syncKey}</code>
            <div class="key-actions">
              <SimpleButton secondary onclick={copyKey}>
                <Fa icon={copied ? faCheck : faCopy} />
                {copied ? "Copied" : "Copy"}
              </SimpleButton>
              <SimpleButton secondary onclick={generate}>
                <Fa icon={faArrowsRotate} /> New key
              </SimpleButton>
            </div>
          </div>
          <div class="field">
            <input
              type="text"
              bind:value={inputKey}
              placeholder="Paste a key from another device…"
              aria-label="Sync key"
            />
            <SimpleButton primary onclick={saveEntered}>
              <Fa icon={faCheck} /> Use this key
            </SimpleButton>
          </div>
          <button type="button" class="link-btn" onclick={clearKey}>Remove key</button>
        {:else}
          <div class="key-actions">
            <SimpleButton primary onclick={generate}>
              <Fa icon={faKey} /> Generate a key
            </SimpleButton>
          </div>
          <div class="field">
            <label for="enter-key">…or paste a key from another device</label>
            <input
              id="enter-key"
              type="text"
              bind:value={inputKey}
              placeholder="ABCDE-FGHJK-MNPQR-STVWX"
            />
            <SimpleButton secondary onclick={saveEntered}>
              <Fa icon={faCheck} /> Pair with this key
            </SimpleButton>
          </div>
        {/if}
        {#if error}
          <p class="sync-error"><Fa icon={faCircleExclamation} /> {error}</p>
        {/if}
      </section>

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

      <!-- Compatibility -->
      <CompatibilitySection {caps} />
    </div>
  </div>
</main>
