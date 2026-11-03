<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Fa from "svelte-fa";
  import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import SupabaseCard from "../components/sync/SupabaseCard.svelte";
  import RelayCard from "../components/sync/RelayCard.svelte";
  import FileSyncCard from "../components/sync/FileSyncCard.svelte";
  import SyncHero from "../components/sync/SyncHero.svelte";
  import SyncCounters from "../components/sync/SyncCounters.svelte";
  import SyncKeyCard from "../components/sync/SyncKeyCard.svelte";
  import SyncContents from "../components/sync/SyncContents.svelte";
  import SyncActivity from "../components/sync/SyncActivity.svelte";
  import SyncAdvanced from "../components/sync/SyncAdvanced.svelte";
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
    pullNow,
    onSyncProgress,
  } from "../services/sync-manager.js";
  import { subscribeToSyncNudge } from "../services/sync/realtime-nudge.js";
  import { toast } from "../stores/toast.js";
  import { isValidSyncKey, formatSyncKey } from "../services/sync/sync-key.js";

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

  let syncLogEntries: Array<{
    time: number;
    message: string;
    type: "info" | "success" | "error" | "warning";
  }> = $state([]);

  const syncIsOn = $derived(!!(config.syncKey && config.backends.length > 0));

  function hintFor(c: SyncConfig): string | null {
    if (!c.syncKey)
      return "Enter a sync key to begin. Generate one on your first device, or paste a key from another device.";
    if (c.backends.length === 0)
      return 'You have a key, but no sync backend is enabled. Turn on "IYPM hosted" below.';
    if (!lastSyncedAt) return 'Key and backend ready. Click "Sync now" to upload your data.';
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

  let nudgeUnsubscribe: (() => void) | null = null;

  async function subscribeNudge() {
    if (nudgeUnsubscribe) {
      nudgeUnsubscribe();
      nudgeUnsubscribe = null;
    }
    if (!config.syncKey) return;
    try {
      nudgeUnsubscribe = await subscribeToSyncNudge(config.syncKey, () => {
        pullNow().catch(() => {});
      });
    } catch {
      // ignore subscription failures
    }
  }

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
    // Handle pairing link (?join=<base64url-key>).
    try {
      const params = new URLSearchParams(location.hash.split("?")[1] || "");
      const join = params.get("join");
      if (join) {
        const padded =
          join.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((join.length + 3) % 4);
        const decoded = atob(padded);
        if (isValidSyncKey(decoded)) {
          config.syncKey = formatSyncKey(decoded);
          if (config.backends.length === 0 && isRelayConfigured()) config.backends = ["relay"];
          persist();
          toast.show("Sync key imported from pairing link", "success");
        } else {
          toast.show("Invalid pairing link", "error");
        }
        // Clean the param from the URL without reloading.
        const cleanHash = location.hash.split("?")[0];
        history.replaceState(null, "", cleanHash || "#/sync");
      }
    } catch {
      // ignore malformed params
    }

    onSyncProgress((stage, detail) => {
      syncStage = stage;
      syncStageDetail = detail || "";
      syncProgress = stageProgress[stage] ?? 0;
      if (detail)
        addLogEntry(detail, stage === "error" ? "error" : stage === "success" ? "success" : "info");
    });
    const timer = setInterval(refreshStatus, 10_000);
    refresh().then(() => subscribeNudge());
    return () => {
      clearInterval(timer);
      onSyncProgress(null);
      if (nudgeUnsubscribe) nudgeUnsubscribe();
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
    <SyncHero
      {syncIsOn}
      {isSyncing}
      {knownDevices}
      {setupHint}
      {syncStage}
      {syncStageDetail}
      {syncProgress}
      {lastError}
      {lastSyncSummary}
      {getStageLabel}
      onSyncNow={syncNow}
    />

    <SyncCounters {syncIsOn} {isSyncing} {lastSyncedAt} {knownDevices} {formatWhen} />

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
      <SyncKeyCard {config} onPersist={persist} onLog={addLogEntry} />

      <!-- What to Sync with Per-Category Status -->
      <SyncContents
        {config}
        {categoryTimestamps}
        {isSyncing}
        {syncStage}
        onToggleContent={toggleContent}
        {formatWhen}
      />

      <!-- Sync Activity Log -->
      <SyncActivity entries={syncLogEntries} />

      <!-- API Setup Link -->
      <SyncAdvanced />
    </div>
  </div>
</main>
