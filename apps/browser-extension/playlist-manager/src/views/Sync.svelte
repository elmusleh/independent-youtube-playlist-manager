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
  import SyncAdvanced from "../components/sync/SyncAdvanced.svelte";
  import SyncScheduleCard from "../components/sync/SyncScheduleCard.svelte";
  import SyncOfflineCard from "../components/sync/SyncOfflineCard.svelte";
  import SyncLegacyWarning from "../components/sync/SyncLegacyWarning.svelte";
  import {
    loadSyncConfig,
    saveSyncConfig,
    DEFAULT_SYNC_CONFIG,
    isRelayConfigured,
    type SyncConfig,
    type SyncBackend,
  } from "../services/sync/sync-config.js";
  import { detectCapabilities } from "../services/sync/capabilities.js";
  import {
    LEGACY_SYNC_RECOVERY_NOTICE,
    needsV2RelayAcknowledgement,
  } from "../services/sync/sync-config-compatibility.js";
  import { requestSyncHostPermission } from "../services/sync/host-permissions.js";
  // v2 engine is the background authority; manual sync goes through it.
  function triggerSyncNow() {
    const b = (window as any).browser || (window as any).chrome;
    if (b?.runtime?.sendMessage) {
      return b.runtime.sendMessage({ cmd: "sync-now" }).catch(() => Promise.resolve());
    }
    const engine = (window as any).syncEngine;
    if (engine?.runOnce) return engine.runOnce();
    return Promise.resolve();
  }
  function pullNow() {
    return triggerSyncNow();
  }
  function onSyncProgress(cb: any) {
    // v2 engine reports status via yph_sync_status storage key; no-op callback registration.
  }
  import { rotateSyncKey } from "../services/sync/rotate-key.js";
  import { subscribeToSyncNudge } from "../services/sync/realtime-nudge.js";
  import { toast } from "../stores/toast.js";
  import { requestConfirm } from "../stores/confirmation";
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

  let categoryProgress = $state<{
    playlists: { processed: number; applied: number; total: number };
    settings: { processed: number; applied: number; total: number };
    history: { processed: number; applied: number; total: number };
    devices: { processed: number; applied: number; total: number };
  }>({
    playlists: { processed: 0, applied: 0, total: 0 },
    settings: { processed: 0, applied: 0, total: 0 },
    history: { processed: 0, applied: 0, total: 0 },
    devices: { processed: 0, applied: 0, total: 0 },
  });
  let estimatedRemaining = $state<number | null>(null);

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
    const b = (window as any).browser || (window as any).chrome;
    let s: any = {};
    if (b?.storage?.local) {
      const stored = await b.storage.local.get("yph_sync_status");
      s = stored?.yph_sync_status ?? {};
      const devicesStored = await b.storage.local.get("yph_sync_devices");
      const devices = devicesStored?.yph_sync_devices;
      knownDevices = Array.isArray(devices) ? devices.length : 0;
    } else {
      const engine = (window as any).syncEngine;
      s = engine?.getStatus ? engine.getStatus() : {};
      knownDevices = 0;
    }
    lastSyncedAt = s.lastRunAt ?? null;
    lastError = s.lastError ?? null;
    lastSyncSummary = s.lastSummary ?? null;
    isSyncing = s.phase === "pulling" || s.phase === "merging" || s.phase === "pushing";
    // Update category progress
    if (s.categoryProgress) {
      categoryProgress = s.categoryProgress;
    }
    // Update time estimate
    if (s.startedAt && s.estimatedMs) {
      const elapsed = Date.now() - s.startedAt;
      const remaining = Math.max(0, s.estimatedMs - elapsed);
      estimatedRemaining = remaining;
    } else {
      estimatedRemaining = null;
    }
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
      // Persist handle via the browser's native IndexedDB (v2 file backend).
      const db = await (window as any).indexedDB?.open("yph_file_sync", 1);
      // Best-effort: store handle; full file-sync backend is a follow-up.
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
    addLogEntry(lastSyncSummary || "Sync finished", lastError ? "error" : "success");
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
        // Warn the user that the key is in the URL (M6).
        const ok = confirm(
          "Import sync key from this pairing link?\n\n" +
            "Warning: the sync key travels in the URL. Anyone who sees this " +
            "link (browser history, screenshots) can access your synced data. " +
            "Only proceed if you trust the source of this link."
        );
        if (!ok) {
          history.replaceState(null, "", location.hash.split("?")[0] || "#/sync");
          return;
        }
        const padded =
          join.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((join.length + 3) % 4);
        const decoded = atob(padded);
        if (isValidSyncKey(decoded)) {
          config.syncKey = formatSyncKey(decoded);
          config.syncProtocolVersion = null;
          config.legacyV2AcknowledgedAt = null;
          if (config.backends.length === 0 && isRelayConfigured()) config.backends = ["relay"];
          persist();
          toast.show("Sync key imported from pairing link", "success");
        } else toast.show("Invalid pairing link", "error");
        history.replaceState(null, "", location.hash.split("?")[0] || "#/sync");
      }
    } catch {
      // ignore malformed params
    }

    onSyncProgress((stage: string, detail: string) => {
      syncStage = stage;
      syncStageDetail = detail || "";
      syncProgress = stageProgress[stage] ?? 0;
      if (detail)
        addLogEntry(detail, stage === "error" ? "error" : stage === "success" ? "success" : "info");
    });
    const timer = setInterval(refreshStatus, 10_000);
    const b = (window as any).browser || (window as any).chrome;
    const storageListener = (changes: any, area: string) => {
      if (area === "local" && changes?.yph_sync_status) refreshStatus();
    };
    b?.storage?.onChanged?.addListener?.(storageListener);
    refresh().then(() => subscribeNudge());
    return () => {
      clearInterval(timer);
      b?.storage?.onChanged?.removeListener?.(storageListener);
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

    <SyncLegacyWarning {config} onPersist={persist} onContinue={syncNow} />

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
      {estimatedRemaining}
      {categoryProgress}
      logEntries={syncLogEntries}
    />

    <SyncCounters {syncIsOn} {isSyncing} {lastSyncedAt} {knownDevices} {formatWhen} />

    <div class="settings-grid">
      <!-- Sync Key (top-left; required to sync) -->
      <SyncKeyCard {config} onPersist={persist} onLog={addLogEntry} onRotate={handleRotateKey} />
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

      <!-- Offline Mode (moved under File/Syncthing) -->
      <SyncOfflineCard {config} onPersist={persist} onLog={addLogEntry} />

      <!-- Sync Schedule -->
      <SyncScheduleCard {config} onPersist={persist} onLog={addLogEntry} />

      <!-- Sync Advanced -->
      <SyncAdvanced />
    </div>
  </div>
</main>
