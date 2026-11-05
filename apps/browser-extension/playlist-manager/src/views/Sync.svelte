<script lang="ts">
  import { onMount } from "svelte";
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
  import SyncConflictCard from "../components/sync/SyncConflictCard.svelte";
  import SyncAdvanced from "../components/sync/SyncAdvanced.svelte";
  import SyncScheduleCard from "../components/sync/SyncScheduleCard.svelte";
  import SyncOfflineCard from "../components/sync/SyncOfflineCard.svelte";
  import SyncLegacyWarning from "../components/sync/SyncLegacyWarning.svelte";
  import {
    loadSyncConfig,
    saveSyncConfig,
    getOrCreateDeviceId,
    DEFAULT_SYNC_CONFIG,
    isRelayConfigured,
    RELAY_SUPABASE_URL,
    type SyncConfig,
    type SyncBackend,
  } from "../services/sync/sync-config.js";
  import { detectCapabilities } from "../services/sync/capabilities.js";
  import {
    LEGACY_SYNC_RECOVERY_NOTICE,
    needsV2RelayAcknowledgement,
  } from "../services/sync/sync-config-compatibility.js";
  import { requestSyncHostPermission } from "../services/sync/host-permissions.js";
  import { verifyRelayConnection } from "../services/sync/sync-diagnostics.js";
  import { rotateSyncKey } from "../services/sync/rotate-key.js";
  import { subscribeToSyncNudge } from "../services/sync/realtime-nudge.js";
  import { toast } from "../stores/toast.js";
  import { requestConfirm } from "../stores/confirmation";

  function triggerSyncNow() {
    const b = (window as any).browser || (window as any).chrome;
    if (b?.runtime?.sendMessage) {
      return b.runtime.sendMessage({ cmd: "sync-now" }).catch(() => Promise.resolve());
    }
    const engine = (window as any).syncEngine;
    if (engine?.runOnce) return engine.runOnce();
    return Promise.resolve();
  }

  const caps = detectCapabilities();
  const status = new StatusManager();

  let config = $state<SyncConfig>({
    ...DEFAULT_SYNC_CONFIG,
    content: { ...DEFAULT_SYNC_CONFIG.content },
  });

  let localDeviceId = $state<string | null>(null);
  let lastSyncedAt = $state<number | null>(null);
  let lastError = $state<string | null>(null);
  let lastSyncSummary = $state<string | null>(null);
  let knownDevices = $state(0);
  let isSyncing = $state(false);
  let isTestingConnection = $state(false);
  let syncStage = $state<string>("idle");
  let syncStageDetail = $state<string>("");
  let syncProgress = $state<number>(0);

  let categoryProgress = $state({
    playlists: { processed: 0, applied: 0, total: 0 },
    settings: { processed: 0, applied: 0, total: 0 },
    history: { processed: 0, applied: 0, total: 0 },
    devices: { processed: 0, applied: 0, total: 0 },
  });
  let estimatedRemaining = $state<number | null>(null);

  const syncIsOn = $derived(!!(config.syncKey && config.backends.length > 0));

  function hintFor(c: SyncConfig): string | null {
    if (!c.syncKey)
      return "Enter a sync key to begin. Generate one on your first device, or paste a key from another device.";
    if (c.backends.length === 0)
      return 'You have a key, but no sync backend is enabled. Turn on "IYPM hosted" below.';
    if (!lastSyncedAt) return 'Key and backend ready. Click "Sync now" to sync this device.';
    return null;
  }
  const setupHint = $derived(hintFor(config));

  const phaseProgress: Record<string, number> = {
    idle: 0,
    pulling: 30,
    merging: 65,
    pushing: 85,
    error: 0,
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
        triggerSyncNow().catch(() => {});
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
      localDeviceId = await getOrCreateDeviceId().catch(() => null);
      await refreshStatus();
    });
  }

  async function refreshStatus() {
    const b = (window as any).browser || (window as any).chrome;
    let s: any = {};
    let deviceList: Array<{ deviceId?: string }> = [];
    if (b?.storage?.local) {
      const stored = await b.storage.local.get(["yph_sync_status", "yph_sync_devices"]);
      s = stored?.yph_sync_status ?? {};
      deviceList = Array.isArray(stored?.yph_sync_devices) ? stored.yph_sync_devices : [];
    } else {
      const engine = (window as any).syncEngine;
      s = engine?.getStatus ? engine.getStatus() : {};
    }

    lastSyncedAt = s.lastRunAt ?? config.lastSyncedAt ?? null;
    lastError = s.lastError ?? config.lastError ?? null;
    if (!isTestingConnection) {
      lastSyncSummary = s.lastSummary ?? config.lastSyncSummary ?? null;
    }

    const uniqueDevices = new Set(
      deviceList
        .map((d) => d?.deviceId)
        .filter((id): id is string => typeof id === "string" && !!id)
    );
    if (lastSyncedAt && localDeviceId) uniqueDevices.add(localDeviceId);
    knownDevices = uniqueDevices.size;

    const activePhase = s.phase ?? "idle";
    isSyncing = activePhase === "pulling" || activePhase === "merging" || activePhase === "pushing";
    syncStage = activePhase;
    syncProgress = phaseProgress[activePhase] ?? 0;
    syncStageDetail =
      activePhase === "pulling"
        ? `Downloading encrypted records${s.incomingCount ? ` (${s.incomingCount} fetched)` : ""}…`
        : activePhase === "merging"
          ? "Merging playlists, watch history & settings…"
          : activePhase === "pushing"
            ? `Uploading ${s.pendingCount || ""} changed record${s.pendingCount === 1 ? "" : "s"}…`.replace(
                "Uploading  ",
                "Uploading "
              )
            : "";

    if (s.categoryProgress) categoryProgress = s.categoryProgress;
    if (s.startedAt && s.estimatedMs) {
      estimatedRemaining = Math.max(0, s.estimatedMs - (Date.now() - s.startedAt));
    } else {
      estimatedRemaining = null;
    }
  }

  function addLogEntry(message: string, type: "info" | "success" | "error" | "warning" = "info") {
    if (window.logSystemEvent) {
      const level = type === "error" ? "ERROR" : type === "warning" ? "WARN" : "INFO";
      window.logSystemEvent(level, `[SYNC] ${message}`);
    }
  }

  async function ensureEndpointPermissions(): Promise<boolean> {
    const permissions =
      (globalThis as any).browser?.permissions || (globalThis as any).chrome?.permissions;
    if (!permissions) return true;
    if (config.backends.includes("relay")) {
      const granted = await requestSyncHostPermission(RELAY_SUPABASE_URL, permissions);
      if (!granted) {
        lastError = "Allow secure access to the IYPM sync relay before syncing.";
        lastSyncSummary = "Relay host permission was not granted.";
        addLogEntry(lastSyncSummary, "error");
        return false;
      }
    }
    if (config.backends.includes("supabase-byo")) {
      const granted = await requestSyncHostPermission(config.supabaseUrl, permissions);
      if (!granted) {
        lastError =
          "Allow secure access to your Supabase project before syncing. Check its HTTPS URL and try again.";
        lastSyncSummary = "Supabase permission was not granted.";
        addLogEntry(lastSyncSummary, "error");
        return false;
      }
    }
    return true;
  }

  async function toggleBackend(backend: SyncBackend, enabled: boolean) {
    const set = new Set(config.backends);
    if (enabled) set.add(backend);
    else set.delete(backend);
    config.backends = [...set];
    if (enabled && backend === "relay") {
      await ensureEndpointPermissions();
    }
    await persist();
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
      await (window as any).showDirectoryPicker();
      await (window as any).indexedDB?.open("yph_file_sync", 1);
      persist();
    } catch {
      // cancelled
    }
  }

  async function syncNow() {
    if (needsV2RelayAcknowledgement(config)) {
      lastError = LEGACY_SYNC_RECOVERY_NOTICE;
      lastSyncSummary = "Sync paused until the previous setup is reviewed";
      addLogEntry(lastSyncSummary, "warning");
      return;
    }
    if (!(await ensureEndpointPermissions())) return;
    lastError = null;
    addLogEntry("Manual sync started…", "info");
    await triggerSyncNow();
    await refresh();
    addLogEntry(lastSyncSummary || "Sync finished", lastError ? "error" : "success");
    if (lastError) toast.show(lastError, "error");
    else if (lastSyncSummary) toast.show(lastSyncSummary, "success");
  }

  async function testConnection() {
    if (!(await ensureEndpointPermissions())) return;
    isTestingConnection = true;
    lastError = null;
    addLogEntry("Testing relay connection…", "info");
    try {
      const check = await verifyRelayConnection(config);
      if (check.ok) {
        lastError = null;
        lastSyncSummary = check.summary;
        addLogEntry(check.summary, "success");
        toast.show(check.summary, "success");
      } else {
        lastError = check.error || check.summary;
        lastSyncSummary = check.summary;
        addLogEntry(check.summary, "error");
        toast.show(check.summary, "error");
      }
    } finally {
      isTestingConnection = false;
    }
  }

  async function handleRotateKey() {
    if (needsV2RelayAcknowledgement(config)) {
      lastError = LEGACY_SYNC_RECOVERY_NOTICE;
      lastSyncSummary = "Review the previous sync setup before rotating its key";
      addLogEntry(lastSyncSummary, "warning");
      return;
    }
    requestConfirm({
      title: "Rotate sync key?",
      message:
        "Creates a fresh sync key and sync space from this device's local data. The previous remote space is retained, not deleted, so unsynced data on other devices is not erased. Export backups from every device before rotating, then update each device with the new key.",
      color: "primary",
      confirmLabel: "Rotate",
      onConfirm: async () => {
        try {
          const newKey = await rotateSyncKey();
          await refresh();
          await subscribeNudge();
          addLogEntry("Sync key rotated", "success");
          toast.show(`Sync key rotated. New key: ${newKey}`, "success");
        } catch (e) {
          addLogEntry(`Key rotation failed: ${e}`, "error");
          toast.show("Key rotation failed", "error");
        }
      },
    });
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
      case "pulling":
        return "Downloading encrypted records…";
      case "merging":
        return "Merging playlists, history & settings…";
      case "pushing":
        return "Uploading changes…";
      case "error":
        return "Error";
      default:
        return "Ready";
    }
  }

  onMount(() => {
    const timer = setInterval(refreshStatus, 10_000);
    const b = (window as any).browser || (window as any).chrome;
    const storageListener = (changes: any, area: string) => {
      if (area === "local" && (changes?.yph_sync_status || changes?.yph_sync_devices)) {
        refreshStatus();
      }
    };
    b?.storage?.onChanged?.addListener?.(storageListener);
    refresh().then(() => subscribeNudge());
    return () => {
      clearInterval(timer);
      b?.storage?.onChanged?.removeListener?.(storageListener);
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

    <SyncLegacyWarning {config} onPersist={persist} onContinue={syncNow} />

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
      onTestConnection={testConnection}
      {estimatedRemaining}
      {categoryProgress}
    />

    <SyncCounters {syncIsOn} {isSyncing} {lastSyncedAt} {knownDevices} {formatWhen} />

    <div class="settings-grid">
      <SyncKeyCard
        {config}
        onPersist={persist}
        onLog={addLogEntry}
        onRotate={handleRotateKey}
        onTestConnection={testConnection}
        {isTestingConnection}
      />
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

      <SyncOfflineCard {config} onPersist={persist} onLog={addLogEntry} />

      <SyncScheduleCard {config} onPersist={persist} onLog={addLogEntry} />

      <SyncConflictCard {config} onPersist={persist} onLog={addLogEntry} />

      <SyncAdvanced />
    </div>
  </div>
</main>
