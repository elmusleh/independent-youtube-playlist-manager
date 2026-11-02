<script lang="ts">
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import {
    faArrowsRotate,
    faKey,
    faCopy,
    faCheck,
    faLink,
    faCircleCheck,
    faCircleExclamation,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import BackendSection from "../components/sync/BackendSection.svelte";
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
    // Refresh the status line periodically so a background sync updates it.
    const timer = setInterval(refreshStatus, 10_000);
    (async () => {
      config = await loadSyncConfig();
      await refreshStatus();
    })();
    return () => clearInterval(timer);
  });

  async function persist() {
    await saveSyncConfig(config);
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

<main class="sync-view">
  <ViewHeader icon={faArrowsRotate} title="Sync" />
  <p class="sync-purpose">
    Keep your playlists in sync across your devices. Everything is encrypted with a key only you
    have — no cloud server can read your data.
  </p>

  <div class="sync-columns">
    <!-- Device pairing -->
    <section class="card">
      <h3><Fa icon={faKey} /> Device pairing</h3>
      <p class="sub-text">
        Your sync key is the only credential. Set the same key on every device you want to keep in
        sync. <strong>Lose the key and your data cannot be recovered.</strong>
      </p>

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
          <label for="enter-key">…or enter a key from another device</label>
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

    <BackendSection
      {config}
      {caps}
      onSetBackend={setBackend}
      onChooseFolder={chooseFolder}
      onSetUrl={setUrl}
      onSetKey={setKey}
    />

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

    <!-- Status -->
    <section class="card">
      <h3><Fa icon={faArrowsRotate} /> Status</h3>
      <p class="sub-text">
        Last synced: {formatWhen(lastSyncedAt)}
        {#if lastSyncSummary}<br />{lastSyncSummary}{/if}
        {#if lastError}<br /><span class="sync-error">⚠ {lastError}</span>{/if}
      </p>
      <SimpleButton secondary onclick={syncNow} disabled={isSyncing}>
        <Fa icon={faArrowsRotate} />
        {isSyncing ? "Syncing…" : "Sync now"}
      </SimpleButton>
      {#if config.syncKey && config.backend}
        <p class="sub-text">
          <Fa icon={faCircleCheck} />
          Sync is on across {knownDevices > 0 ? knownDevices : 1}
          {knownDevices > 1 ? " devices" : " device"}. Changes will sync automatically.
        </p>
      {/if}
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
</main>
