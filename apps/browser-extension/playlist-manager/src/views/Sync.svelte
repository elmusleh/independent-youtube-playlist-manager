<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Fa from "svelte-fa";
  import {
    faArrowsRotate,
    faLink,
    faCheck,
    faCircleCheck,
    faCircleExclamation,
    faSpinner,
    faClock,
    faDatabase,
    faCog,
    faHistory,
    faInfoCircle,
    faTrash,
    faKey,
    faShieldHalved,
    faCopy,
    faCloudArrowUp,
    faCloudArrowDown,
    faPauseCircle,
    faPlayCircle,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
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
  import {
    getSyncStatus,
    triggerSyncNow,
    startPolling,
    onSyncProgress,
  } from "../services/sync-manager.js";
  import {
    generateSyncKey,
    isValidSyncKey,
    formatSyncKey,
    SYNC_KEY_SYMBOLS,
  } from "../services/sync/sync-key.js";
  import { requestConfirm } from "../stores/confirmation";

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
  let categoryTimestamps = $state<{
    playlists: number | null;
    settings: number | null;
    history: number | null;
  }>({
    playlists: null,
    settings: null,
    history: null,
  });

  let syncStage = $state<string>("idle");
  let syncStageDetail = $state<string>("");
  let syncProgress = $state<number>(0);

  let showSyncLog = $state(false);
  let syncLogEntries: Array<{
    time: number;
    message: string;
    type: "info" | "success" | "error" | "warning";
  }> = $state([]);
  let keyInput = $state("");

  const syncIsOn = $derived(!!(config.syncKey && config.backends.length > 0));
  const hasSyncKey = $derived(!!config.syncKey);

  function hintFor(c: SyncConfig): string | null {
    if (!c.syncKey) return "Enter a sync key to begin. Generate one on your first device, or paste a key from another device.";
    if (c.backends.length === 0) return "You have a key, but no sync backend is enabled. Turn on \"IYPM hosted\" below.";
    if (!lastSyncedAt) return "Key and backend ready. Click \"Sync now\" to upload your data.";
    return null;
  }
  const setupHint = $derived(hintFor(config));

  const stageProgress: Record<string, number> = {
    idle: 0,
    reading: 10,
    preparing: 25,
    pushing: 50,
    pulling: 50,
    success: 100,
    error: 0,
    partial: 75,
    conflict: 25,
  };

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
    categoryTimestamps = s.categoryTimestamps;
  }

  function addLogEntry(message: string, type: "info" | "success" | "error" | "warning" = "info") {
    syncLogEntries = [{ time: Date.now(), message, type }, ...syncLogEntries.slice(0, 49)];
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
      // cancelled
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
        addLogEntry(lastSyncSummary, "error");
        return;
      }
    }
    lastError = null;
    addLogEntry("Manual sync started…", "info");
    await triggerSyncNow();
    await refreshStatus();
  }

  function toggleContent(key: "playlists" | "settings" | "history") {
    config.content[key] = !config.content[key];
    persist();
  }

  function formatWhen(ts: number | null): string {
    if (!ts) return "Never";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
    return new Date(ts).toLocaleString();
  }

  let keyError = $state<string | null>(null);

  function handleKeySave() {
    if (isValidSyncKey(keyInput)) {
      config.syncKey = formatSyncKey(keyInput);
      keyInput = "";
      keyError = null;
      persist();
      addLogEntry("Sync key saved", "success");
    } else {
      keyError = `A sync key has ${SYNC_KEY_SYMBOLS} letters/digits, e.g. ABCDE-FGHJK-MNPQR-STVWX.`;
      addLogEntry(keyError, "error");
    }
  }

  function handleGenerateKey() {
    requestConfirm({
      title: "Create a new sync key?",
      message:
        "Only do this on your FIRST device. Every other device must paste this same key — a second generated key creates a separate, unconnected sync space.",
      color: "primary",
      confirmLabel: "Create key",
      onConfirm: () => {
        config.syncKey = generateSyncKey();
        if (config.backends.length === 0 && isRelayConfigured()) config.backends = ["relay"];
        keyError = null;
        persist();
        addLogEntry("New sync key created — copy it to your other devices", "success");
      },
    });
  }

  function copyKey() {
    navigator.clipboard.writeText(config.syncKey!).then(
      () => addLogEntry("Sync key copied to clipboard", "success"),
      () => addLogEntry("Could not copy — select manually", "error")
    );
  }

  function removeKey() {
    config.syncKey = null;
    persist();
    addLogEntry("Sync key removed from this device", "warning");
  }

  function getStageLabel(stage: string) {
    switch (stage) {
      case "reading":
        return "Checking remote…";
      case "preparing":
        return "Preparing changes…";
      case "pushing":
        return "Uploading…";
      case "pulling":
        return "Downloading…";
      case "success":
        return "Complete";
      case "error":
        return "Error";
      case "partial":
        return "Partial";
      case "conflict":
        return "Conflict";
      default:
        return "Ready";
    }
  }

  onMount(() => {
    startPolling();
    onSyncProgress((stage, detail) => {
      syncStage = stage;
      syncStageDetail = detail || "";
      syncProgress = stageProgress[stage] ?? 0;
      if (detail)
        addLogEntry(detail, stage === "error" ? "error" : stage === "success" ? "success" : "info");
    });
    const timer = setInterval(refreshStatus, 10_000);
    refresh();
    return () => {
      clearInterval(timer);
      onSyncProgress(null);
    };
  });
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

    <!-- Main Status Banner -->
    <section class="sync-status-banner" class:active={syncIsOn} class:syncing={isSyncing}>
      <div class="banner-main">
        <div class="status-icon-wrapper" class:syncing={isSyncing}>
          <Fa
            icon={isSyncing ? faSpinner : syncIsOn ? faCircleCheck : faCircleExclamation}
            class="status-icon"
          />
        </div>
        <div class="status-content">
          <h3>
            {#if syncIsOn}
              <span class="device-count">
                <Fa icon={faLink} /> Sync active across {knownDevices > 0 ? knownDevices : 1} device{knownDevices >
                1
                  ? "s"
                  : ""}
              </span>
              {#if isSyncing}
                <span class="syncing-badge">Syncing…</span>
              {/if}
            {:else}
              Sync not set up
            {/if}
          </h3>
          <p class="status-message">
            {#if setupHint}
              {setupHint}
            {:else if isSyncing}
              {syncStageDetail || getStageLabel(syncStage)}
            {:else if lastError}
              <span class="error-text"><Fa icon={faCircleExclamation} /> {lastError}</span>
            {:else if lastSyncSummary}
              <Fa icon={faCircleCheck} /> {lastSyncSummary}
            {:else}
              Ready to sync. Click "Sync now" to begin.
            {/if}
          </p>
          {#if isSyncing && syncProgress > 0 && syncProgress < 100}
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: {syncProgress}%"></div>
              <span class="progress-text">{syncProgress}%</span>
            </div>
          {/if}
        </div>
      </div>
      <div class="banner-actions">
        <SimpleButton
          secondary
          onclick={syncNow}
          disabled={isSyncing || !syncIsOn}
          class="sync-now-btn"
        >
          <span class:spin={isSyncing}><Fa icon={isSyncing ? faSpinner : faArrowsRotate} /></span>
          {isSyncing ? "Syncing…" : "Sync now"}
        </SimpleButton>
      </div>
    </section>

    {#if syncIsOn && !isSyncing && lastSyncedAt}
      <section class="last-sync-summary">
        <Fa icon={faClock} />
        <span>Last full sync: <strong>{formatWhen(lastSyncedAt)}</strong></span>
        {#if knownDevices > 1}
          <span class="devices-note"><Fa icon={faLink} /> {knownDevices} devices connected</span>
        {/if}
      </section>
    {/if}

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

      <!-- Sync Key Section -->
      <section class="card sync-key-section">
        <h3><Fa icon={faShieldHalved} /> Sync Key</h3>
        <p class="sub-text">
          One key links every device. <strong>Generate once</strong> on your first device, then
          paste the <strong>same key</strong> on all others.
          <span class="warning"
            >Keep it secret — losing it means synced data cannot be recovered.</span
          >
        </p>

        {#if hasSyncKey}
          <div class="key-display-wrapper">
            <div class="key-display">
              <div class="key-value-container">
                <code class="key-value">{config.syncKey}</code>
                <SimpleButton secondary onclick={copyKey}>
                  <Fa icon={faCopy} /> Copy
                </SimpleButton>
              </div>
            </div>
            <p class="key-hint">
              <Fa icon={faInfoCircle} /> This key is set. Paste it into other devices to link them.
            </p>
            <SimpleButton secondary class="danger" onclick={removeKey}>
              <Fa icon={faTrash} /> Remove key from this device
            </SimpleButton>
          </div>
        {:else}
          <div class="key-input-wrapper">
            <div class="key-input-group">
              <input
                type="text"
                bind:value={keyInput}
                placeholder="Paste sync key here (e.g. ABCDE-FGHJK-MNPQR-STVWX)"
                class="key-input"
                onkeydown={(e) => {
                  if (e.key === "Enter") handleKeySave();
                }}
              />
              <SimpleButton primary onclick={handleKeySave}>
                <Fa icon={faKey} /> Save Key
              </SimpleButton>
            </div>
            {#if keyError}
              <p class="error-text" role="alert">{keyError}</p>
            {/if}
            <p class="sub-text">
              First device? Create a key here, then paste the same key on every other device.
            </p>
            <SimpleButton secondary onclick={handleGenerateKey}>
              <Fa icon={faShieldHalved} /> Create a new sync key
            </SimpleButton>
          </div>
        {/if}
      </section>

      <!-- What to Sync with Per-Category Status -->
      <section class="card">
        <h3><Fa icon={faDatabase} /> What to Sync</h3>
        <p class="sub-text">
          Choose which data categories travel between devices. Each shows its own last sync time.
        </p>

        <div class="sync-category" class:enabled={config.content.playlists}>
          <div class="category-header">
            <div class="category-info">
              <Fa icon={faDatabase} class="cat-icon" />
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={config.content.playlists}
                    onchange={() => toggleContent("playlists")}
                  />
                  <span>Playlists</span>
                </label>
                <span class="sub-text">Your saved and local playlists</span>
              </div>
            </div>
            <div class="category-status">
              {#if config.content.playlists}
                {#if categoryTimestamps.playlists}
                  <span class="synced-at"
                    ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.playlists)}</span
                  >
                {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
                  <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
                {:else}
                  <span class="never-synced">Never synced</span>
                {/if}
              {:else}
                <span class="disabled">Disabled</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="sync-category" class:enabled={config.content.settings}>
          <div class="category-header">
            <div class="category-info">
              <Fa icon={faCog} class="cat-icon" />
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={config.content.settings}
                    onchange={() => toggleContent("settings")}
                  />
                  <span>Settings</span>
                </label>
                <span class="sub-text">Preferences, theme, layout, etc.</span>
              </div>
            </div>
            <div class="category-status">
              {#if config.content.settings}
                {#if categoryTimestamps.settings}
                  <span class="synced-at"
                    ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.settings)}</span
                  >
                {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
                  <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
                {:else}
                  <span class="never-synced">Never synced</span>
                {/if}
              {:else}
                <span class="disabled">Disabled</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="sync-category" class:enabled={config.content.history}>
          <div class="category-header">
            <div class="category-info">
              <Fa icon={faHistory} class="cat-icon" />
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={config.content.history}
                    onchange={() => toggleContent("history")}
                  />
                  <span>Watch History</span>
                </label>
                <span class="sub-text">What you've watched on each device</span>
              </div>
            </div>
            <div class="category-status">
              {#if config.content.history}
                {#if categoryTimestamps.history}
                  <span class="synced-at"
                    ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.history)}</span
                  >
                {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
                  <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
                {:else}
                  <span class="never-synced">Never synced</span>
                {/if}
              {:else}
                <span class="disabled">Disabled</span>
              {/if}
            </div>
          </div>
        </div>
      </section>

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
            {#if syncLogEntries.length === 0}
              <p class="sub-text empty-log">No sync activity yet. Click "Sync now" to start.</p>
            {:else}
              {#each syncLogEntries as entry}
                <div class="log-entry" class:type={entry.type}>
                  <Fa
                    icon={entry.type === "success"
                      ? faCircleCheck
                      : entry.type === "error"
                        ? faCircleExclamation
                        : entry.type === "warning"
                          ? faPauseCircle
                          : faInfoCircle}
                  />
                  <span class="log-time">{new Date(entry.time).toLocaleTimeString()}</span>
                  <span class="log-message">{entry.message}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </section>

      <!-- API Setup Link -->
      <section class="card">
        <h3><Fa icon={faLink} /> YouTube Data API</h3>
        <p class="sub-text">
          Optional. Connect a YouTube Data API key for faster, quota-backed metadata.
        </p>
        <a href="#/api-setup" class="api-link"><Fa icon={faLink} /> Open API setup</a>
      </section>
    </div>
  </div>
</main>

<style>
  .sync-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
  }

  .sync-status-banner {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    background: var(--card, #fff);
    border: 1px solid var(--border, #e0e0e0);
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .sync-status-banner.active {
    border-color: var(--accent, #3b82f6);
    box-shadow: 0 0 0 1px var(--accent, #3b82f6);
  }

  .sync-status-banner.syncing {
    border-color: var(--accent, #3b82f6);
    animation: pulse-border 2s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%,
    100% {
      box-shadow: 0 0 0 1px var(--accent, #3b82f6);
    }
    50% {
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
    }
  }

  .banner-main {
    flex: 1;
    min-width: 280px;
  }

  .status-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--muted, #f3f4f6);
  }

  .status-icon-wrapper.syncing .status-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .status-icon {
    font-size: 1.25rem;
    color: var(--muted-foreground, #6b7280);
  }

  .sync-status-banner.active .status-icon {
    color: var(--success, #10b981);
  }

  .sync-status-banner.syncing .status-icon {
    color: var(--accent, #3b82f6);
  }

  .status-content h3 {
    margin: 0 0 0.35rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground, #111);
  }

  .device-count {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .syncing-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: 0.5rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--accent, #3b82f6);
    background: rgba(59, 130, 246, 0.1);
    border-radius: 999px;
  }

  .syncing-badge .fa-spinner {
    animation: spin 1s linear infinite;
  }

  .status-message {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted-foreground, #6b7280);
    line-height: 1.5;
  }

  .status-message .error-text {
    color: var(--danger, #ef4444);
    font-weight: 500;
  }

  .progress-bar-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    height: 6px;
    background: var(--muted, #f3f4f6);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: var(--accent, #3b82f6);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted-foreground, #6b7280);
    min-width: 3ch;
  }

  .banner-actions {
    flex-shrink: 0;
  }

  .sync-now-btn {
    min-width: 140px;
  }

  .fa-spinner.spin {
    animation: spin 1s linear infinite;
  }

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

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 720px) {
    .settings-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .card {
    background: var(--card, #fff);
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .card h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground, #111);
  }

  .sub-text {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--muted-foreground, #6b7280);
    line-height: 1.5;
  }

  .sub-text strong {
    color: var(--foreground, #111);
  }

  .warning {
    color: var(--danger, #ef4444);
    font-weight: 500;
  }

  .sync-key-section .key-display {
    margin-top: 1rem;
  }

  .key-value-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

  .key-value {
    flex: 1;
    min-width: 200px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
    background: var(--muted, #f3f4f6);
    border-radius: 6px;
    border: 1px solid var(--border, #e0e0e0);
    letter-spacing: 0.02em;
  }

  .key-hint {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--muted-foreground, #6b7280);
  }

  .key-input-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  .key-input {
    flex: 1;
    min-width: 220px;
    padding: 0.5rem 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.875rem;
    border: 1px solid var(--border, #d1d5db);
    border-radius: 6px;
    background: var(--card, #fff);
    color: var(--foreground, #111);
  }

  .key-input:focus {
    outline: none;
    border-color: var(--accent, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .danger {
    color: var(--danger, #ef4444);
    border-color: var(--danger, #ef4444);
  }

  .danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .sync-category {
    padding: 0.75rem 0;
    border-top: 1px solid var(--border, #e5e7eb);
  }

  .sync-category:first-child {
    border-top: none;
    padding-top: 0;
  }

  .sync-category:last-child {
    padding-bottom: 0;
  }

  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .category-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 200px;
  }

  .cat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--muted, #f3f4f6);
    color: var(--accent, #3b82f6);
  }

  .category-info label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--foreground, #111);
  }

  .category-info label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--accent, #3b82f6);
  }

  .category-info .sub-text {
    margin: 0.15rem 0 0;
    font-size: 0.8rem;
    color: var(--muted-foreground, #6b7280);
  }

  .category-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .synced-at {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--success, #10b981);
    font-weight: 500;
  }

  .syncing-now {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--accent, #3b82f6);
    font-weight: 500;
  }

  .never-synced {
    color: var(--muted-foreground, #9ca3af);
  }

  .disabled {
    color: var(--muted-foreground, #9ca3af);
    font-style: italic;
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .sync-log {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 8px;
    background: var(--muted, #f9fafb);
  }

  .log-entry {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border, #e5e7eb);
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
  .log-entry.type-info .log-message {
    color: var(--foreground, #111);
  }

  .log-time {
    font-variant-numeric: tabular-nums;
    color: var(--muted-foreground, #9ca3af);
    min-width: 70px;
  }

  .empty-log {
    padding: 1.5rem;
    text-align: center;
    color: var(--muted-foreground, #9ca3af);
  }

  .api-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--accent, #3b82f6);
    text-decoration: none;
    font-weight: 500;
  }

  .api-link:hover {
    text-decoration: underline;
  }
</style>
