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
  import SyncSafetyCard from "../components/sync/SyncSafetyCard.svelte";
  import SyncReportModal from "../components/sync/SyncReportModal.svelte";
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
  import {
    checkSyncHostPermission,
    requestSyncHostPermission,
  } from "../services/sync/host-permissions.js";
  import { computeStorageAddress } from "../services/sync/keys.js";
  import {
    verifyRelayConnection,
    type ConnectionCheckResult,
  } from "../services/sync/sync-diagnostics.js";
  import {
    listSyncSafetyBackups,
    type SyncSafetyBackup,
  } from "../services/sync/sync-safety-backup.js";
  import {
    buildSyncRunReport,
    readLocalSyncInventory,
    type LocalSyncInventory,
    type SyncRunReport,
  } from "../services/sync/sync-report.js";
  import { rotateSyncKey } from "../services/sync/rotate-key.js";
  import { subscribeToSyncNudge } from "../services/sync/realtime-nudge.js";
  import { toast } from "../stores/toast.js";
  import { requestConfirm } from "../stores/confirmation";

  async function triggerSyncNow(): Promise<any> {
    const b = (window as any).browser || (window as any).chrome;
    if (b?.runtime?.sendMessage) {
      try {
        const res = await b.runtime.sendMessage({ cmd: "sync-now" });
        if (res && typeof res === "object" && "phase" in res) {
          return res;
        }
      } catch {
        // Fall through to direct in-page sync engine if background event page was asleep.
      }
    }
    const engine = (window as any).syncEngine;
    if (engine?.runOnce) return engine.runOnce();
    const mod = await import("../services/sync-engine.js");
    return mod.runOnce();
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
  let manualSyncActive = $state(false);
  let testingBackend = $state<"relay" | "supabase-byo" | null>(null);
  let relayTestResult = $state<ConnectionCheckResult | null>(null);
  let byoTestResult = $state<ConnectionCheckResult | null>(null);
  let safetyBackups = $state<SyncSafetyBackup[]>([]);
  let relayPermissionGranted = $state<boolean | null>(null);
  let localInventory = $state<LocalSyncInventory | null>(null);
  let lastSyncReport = $state<SyncRunReport | null>(null);
  let reportModalOpen = $state(false);
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
  const needsRelayPermission = $derived(
    syncIsOn && config.backends.includes("relay") && relayPermissionGranted === false
  );

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

  async function refreshPermissionState() {
    const permissions =
      (globalThis as any).browser?.permissions || (globalThis as any).chrome?.permissions;
    if (!permissions?.contains) {
      relayPermissionGranted = null;
      return;
    }
    relayPermissionGranted = await checkSyncHostPermission(RELAY_SUPABASE_URL, permissions);
  }

  async function persist() {
    await status.save(() => saveSyncConfig(config));
    await refreshPermissionState();
  }

  async function refresh() {
    await status.refresh(async () => {
      config = await loadSyncConfig();
      localDeviceId = await getOrCreateDeviceId().catch(() => null);
      localInventory = await readLocalSyncInventory();
      safetyBackups = await listSyncSafetyBackups();
      await refreshPermissionState();
      await refreshStatus();
    });
  }

  async function refreshStatus(): Promise<any> {
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
    if (!testingBackend) {
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
    const engineRunning =
      activePhase === "pulling" || activePhase === "merging" || activePhase === "pushing";
    isSyncing = manualSyncActive || engineRunning;
    if (engineRunning) {
      syncStage = activePhase;
      syncProgress = phaseProgress[activePhase] ?? 25;
      syncStageDetail =
        activePhase === "pulling"
          ? `Downloading encrypted records${s.incomingCount ? ` (${s.incomingCount} fetched)` : ""}…`
          : activePhase === "merging"
            ? "Merging playlists, watch history & settings…"
            : `Uploading${s.pendingCount ? ` ${s.pendingCount}` : ""} changed record${s.pendingCount === 1 ? "" : "s"}…`;
    } else if (!manualSyncActive) {
      syncStage = activePhase;
      syncProgress = 0;
      syncStageDetail = "";
    }

    if (s.categoryProgress) categoryProgress = s.categoryProgress;
    if (s.startedAt && s.estimatedMs) {
      estimatedRemaining = Math.max(0, s.estimatedMs - (Date.now() - s.startedAt));
    } else {
      estimatedRemaining = null;
    }
    return s;
  }

  function addLogEntry(message: string, type: "info" | "success" | "error" | "warning" = "info") {
    if (window.logSystemEvent) {
      const level = type === "error" ? "ERROR" : type === "warning" ? "WARN" : "INFO";
      window.logSystemEvent(level, `[SYNC] ${message}`);
    }
  }

  async function grantRelayPermission(): Promise<boolean> {
    const permissions =
      (globalThis as any).browser?.permissions || (globalThis as any).chrome?.permissions;
    if (!permissions) return true;
    // Invoked synchronously inside user click handler before any await!
    const granted = await requestSyncHostPermission(RELAY_SUPABASE_URL, permissions);
    relayPermissionGranted = granted;
    if (granted) {
      if (lastError?.includes("Allow secure access")) lastError = null;
      addLogEntry("Relay host permission granted", "success");
      toast.show('Relay access granted — click "Sync now" to sync.', "success");
    } else {
      lastError =
        "Relay permission was declined. Click 'Allow relay access' or enable pfydngsbcmuhsqqjbcte.supabase.co under about:addons → Permissions.";
      addLogEntry("Relay host permission was not granted", "error");
      toast.show("Relay host permission is required before syncing.", "error");
    }
    return granted;
  }

  async function ensureEndpointPermissions(): Promise<boolean> {
    const permissions =
      (globalThis as any).browser?.permissions || (globalThis as any).chrome?.permissions;
    if (!permissions) return true;

    // Kick off host permission request synchronously on the user click (Firefox MV3 requirement).
    const relayReq = config.backends.includes("relay")
      ? requestSyncHostPermission(RELAY_SUPABASE_URL, permissions)
      : null;
    const byoReq = config.backends.includes("supabase-byo")
      ? requestSyncHostPermission(config.supabaseUrl, permissions)
      : null;

    if (relayReq) {
      const granted = await relayReq;
      relayPermissionGranted = granted;
      if (!granted) {
        lastError =
          "Allow secure access to the IYPM sync relay (or approve it in about:addons → Permissions) before syncing.";
        lastSyncSummary = "Relay host permission was not granted.";
        addLogEntry(lastSyncSummary, "error");
        toast.show(lastError, "error");
        return false;
      }
    }
    if (byoReq) {
      const granted = await byoReq;
      if (!granted) {
        lastError =
          "Allow secure access to your Supabase project before syncing. Check its HTTPS URL and try again.";
        lastSyncSummary = "Supabase permission was not granted.";
        addLogEntry(lastSyncSummary, "error");
        toast.show(lastError, "error");
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
    // Request permission synchronously before awaiting storage save!
    const permCheck = enabled && backend === "relay" ? ensureEndpointPermissions() : null;
    if (permCheck) await permCheck;
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
    // Must be the VERY FIRST async call in syncNow() so Firefox sees the direct click gesture!
    if (!(await ensureEndpointPermissions())) return;

    const startedMs = Date.now();
    manualSyncActive = true;
    isSyncing = true;
    syncStage = "pulling";
    syncProgress = 20;
    syncStageDetail = "Connecting to IYPM hosted relay…";
    lastError = null;
    addLogEntry("Manual sync started…", "info");

    let directStatus: any = {};
    try {
      directStatus = await triggerSyncNow();
      const elapsed = Date.now() - startedMs;
      if (elapsed < 400) {
        await new Promise((r) => setTimeout(r, 400 - elapsed));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      lastSyncSummary = `Sync failed: ${msg}`;
      directStatus = { phase: "error", lastError: msg, lastSummary: lastSyncSummary };
    } finally {
      manualSyncActive = false;
    }

    await refresh();
    const latestStatus = await refreshStatus();
    const mergedStatus = { ...latestStatus, ...(directStatus ?? {}) };
    const inv = localInventory ?? (await readLocalSyncInventory());
    const spacePrefix = config.syncKey
      ? (await computeStorageAddress(config.syncKey).catch(() => "")).slice(0, 8)
      : "";
    lastSyncReport = buildSyncRunReport({
      config,
      statusSnapshot: mergedStatus,
      inventoryAfter: inv,
      knownDevices,
      durationMs: Date.now() - startedMs,
      spacePrefix,
      fallbackError: lastError,
      fallbackSummary: lastSyncSummary,
    });
    reportModalOpen = true;

    addLogEntry(lastSyncSummary || "Sync finished", lastError ? "error" : "success");
    if (lastError) toast.show(lastError, "error");
    else if (lastSyncSummary) toast.show(lastSyncSummary, "success");
  }

  async function testBackendConnection(target: "relay" | "supabase-byo") {
    const permissions =
      (globalThis as any).browser?.permissions || (globalThis as any).chrome?.permissions;
    const targetUrl = target === "relay" ? RELAY_SUPABASE_URL : config.supabaseUrl;
    if (permissions && targetUrl) {
      const granted = await requestSyncHostPermission(targetUrl, permissions);
      if (target === "relay") relayPermissionGranted = granted;
      if (!granted) {
        const msg =
          target === "relay"
            ? "Allow secure access to the IYPM sync relay before testing."
            : "Allow secure access to your Supabase project URL before testing.";
        const denied: ConnectionCheckResult = {
          ok: false,
          endpointHost: "",
          spacePrefix: "",
          latencyMs: 0,
          totalRecords: 0,
          countsByCollection: {},
          summary: msg,
          error: msg,
        };
        if (target === "relay") relayTestResult = denied;
        else byoTestResult = denied;
        toast.show(msg, "error");
        return;
      }
    }

    testingBackend = target;
    addLogEntry(
      target === "relay" ? "Testing IYPM hosted relay connection…" : "Testing Supabase connection…",
      "info"
    );
    try {
      const check = await verifyRelayConnection(config, target);
      if (target === "relay") relayTestResult = check;
      else byoTestResult = check;
      if (check.ok) {
        addLogEntry(check.summary, "success");
        toast.show(check.summary, "success");
      } else {
        addLogEntry(check.summary, "error");
        toast.show(check.summary, "error");
      }
    } finally {
      testingBackend = null;
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
    const onFocus = () => {
      refreshPermissionState();
    };
    window.addEventListener("focus", onFocus);
    b?.storage?.onChanged?.addListener?.(storageListener);
    refresh().then(() => subscribeNudge());
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
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
      onGrantPermission={grantRelayPermission}
      onOpenReport={() => (reportModalOpen = true)}
      {needsRelayPermission}
      hasReport={!!lastSyncReport}
      {estimatedRemaining}
      {categoryProgress}
    />

    <SyncCounters
      {syncIsOn}
      {isSyncing}
      {lastSyncedAt}
      {knownDevices}
      {formatWhen}
      inventory={localInventory}
      content={config.content}
    />

    <div class="settings-grid">
      <SyncKeyCard {config} onPersist={persist} onLog={addLogEntry} onRotate={handleRotateKey} />
      <RelayCard
        enabled={config.backends.includes("relay")}
        ready={isRelayConfigured()}
        hasSyncKey={!!config.syncKey}
        permissionGranted={relayPermissionGranted}
        isTesting={testingBackend === "relay"}
        testResult={relayTestResult}
        onToggle={(v) => toggleBackend("relay", v)}
        onRequestPermission={grantRelayPermission}
        onTestConnection={() => testBackendConnection("relay")}
      />

      <SupabaseCard
        enabled={config.backends.includes("supabase-byo")}
        url={config.supabaseUrl}
        key={config.supabaseKey}
        hasSyncKey={!!config.syncKey}
        isTesting={testingBackend === "supabase-byo"}
        testResult={byoTestResult}
        onToggle={(v) => toggleBackend("supabase-byo", v)}
        onSetUrl={setUrl}
        onSetKey={setKey}
        onTestConnection={() => testBackendConnection("supabase-byo")}
      />

      <FileSyncCard
        enabled={config.backends.includes("file")}
        {caps}
        onToggle={(v) => toggleBackend("file", v)}
        onChooseFolder={chooseFolder}
      />

      <SyncSafetyCard backups={safetyBackups} onRefresh={refresh} onLog={addLogEntry} />

      <SyncOfflineCard {config} onPersist={persist} onLog={addLogEntry} />

      <SyncScheduleCard {config} onPersist={persist} onLog={addLogEntry} />

      <SyncConflictCard {config} onPersist={persist} onLog={addLogEntry} />

      <SyncAdvanced />
    </div>
  </div>
</main>

<SyncReportModal bind:open={reportModalOpen} report={lastSyncReport} />
