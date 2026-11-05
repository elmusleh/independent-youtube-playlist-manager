<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faShieldHalved,
    faCopy,
    faTrash,
    faKey,
    faInfoCircle,
    faArrowsRotate,
    faFingerprint,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import {
    generateSyncKey,
    isValidSyncKey,
    formatSyncKey,
    SYNC_KEY_SYMBOLS,
  } from "../../services/sync/sync-key.js";
  import { generateKeyFingerprint, type KeyFingerprint } from "../../services/sync/fingerprint.js";
  import {
    isRelayConfigured,
    RELAY_SUPABASE_URL,
    type SyncConfig,
  } from "../../services/sync/sync-config.js";
  import { requestSyncHostPermission } from "../../services/sync/host-permissions.js";
  import {
    clearLocalSyncRuntimeState,
    resetSyncConfigCursors,
  } from "../../services/sync/sync-state-reset.js";
  import {
    captureSyncSafetyBackup,
    serializeSafetyBackupJson,
  } from "../../services/sync/sync-safety-backup.js";
  import { requestConfirm } from "../../stores/confirmation";

  let {
    config,
    onPersist,
    onLog,
    onRotate,
  }: {
    config: SyncConfig;
    onPersist: () => void | Promise<void>;
    onLog: (message: string, type?: "info" | "success" | "error" | "warning") => void;
    onRotate?: () => void | Promise<void>;
  } = $props();

  let keyInput = $state("");
  let keyError = $state<string | null>(null);
  let fingerprint = $state<KeyFingerprint | null>(null);

  const hasSyncKey = $derived(!!config.syncKey);

  $effect(() => {
    const activeKey = config.syncKey;
    if (!activeKey) {
      fingerprint = null;
      return;
    }
    let cancelled = false;
    generateKeyFingerprint(activeKey)
      .then((fp) => {
        if (!cancelled) fingerprint = fp;
      })
      .catch(() => {
        if (!cancelled) fingerprint = null;
      });
    return () => {
      cancelled = true;
    };
  });

  function requestRelayAccessIfNeeded(): Promise<boolean> {
    if (!config.backends.includes("relay")) return Promise.resolve(true);
    const permissions =
      (globalThis as any).browser?.permissions || (globalThis as any).chrome?.permissions;
    if (!permissions) return Promise.resolve(true);
    return requestSyncHostPermission(RELAY_SUPABASE_URL, permissions);
  }

  async function handleKeySave() {
    if (isValidSyncKey(keyInput)) {
      const formatted = formatSyncKey(keyInput);
      const changed = config.syncKey !== formatted;
      config.syncKey = formatted;
      config.syncConfigVersion = 2;
      config.syncProtocolVersion = 2;
      config.legacyV2AcknowledgedAt = null;
      if (config.backends.length === 0 && isRelayConfigured()) config.backends = ["relay"];
      // Start permission request synchronously before any await so Firefox preserves user gesture.
      const permissionPromise = requestRelayAccessIfNeeded();
      if (changed) {
        resetSyncConfigCursors(config, null);
        await clearLocalSyncRuntimeState(null);
      }
      await permissionPromise;
      keyInput = "";
      keyError = null;
      await onPersist();
      onLog('Sync key saved — click "Sync now" to sync this device', "success");
    } else {
      keyError = `A sync key has ${SYNC_KEY_SYMBOLS} letters/digits, e.g. ABCDE-FGHJK-MNPQR-STVWX.`;
      onLog(keyError, "error");
    }
  }

  function handleGenerateKey() {
    requestConfirm({
      title: "Create a new sync key?",
      message:
        "Only do this on your FIRST device. Every other device must paste this same key — a second generated key creates a separate, unconnected sync space.",
      color: "primary",
      confirmLabel: "Create key",
      onConfirm: async () => {
        config.syncKey = generateSyncKey();
        config.syncConfigVersion = 2;
        config.syncProtocolVersion = 2;
        config.legacyV2AcknowledgedAt = null;
        if (config.backends.length === 0 && isRelayConfigured()) config.backends = ["relay"];
        // Start permission request synchronously on modal confirm click before any await.
        const permissionPromise = requestRelayAccessIfNeeded();
        resetSyncConfigCursors(config, null);
        await clearLocalSyncRuntimeState(null);
        await permissionPromise;
        keyError = null;
        await onPersist();
        onLog("New sync key created — copy it to your other devices", "success");
      },
    });
  }

  function copyKey() {
    navigator.clipboard.writeText(config.syncKey!).then(
      () => onLog("Sync key copied to clipboard", "success"),
      () => onLog("Could not copy — select manually", "error")
    );
  }

  function downloadBackupFile(backup: any) {
    try {
      const json = serializeSafetyBackupJson(backup);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const datePart = new Date(backup.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `iypm-pre-disconnect-backup-${datePart}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // non-fatal if browser environment lacks DOM download primitives
    }
  }

  function handleRemoveKey() {
    requestConfirm({
      title: "Remove sync key from this device?",
      message:
        "This device will stop syncing. A safety snapshot JSON file will be downloaded automatically so you never lose this device's current library state.",
      color: "danger",
      confirmLabel: "Download backup & remove key",
      onConfirm: async () => {
        try {
          const snap = await captureSyncSafetyBackup("Before removing sync key", { force: true });
          if (snap) downloadBackupFile(snap);
        } catch {
          // Proceed with removal even if snapshot capture fails
        }
        await removeKey();
      },
    });
  }

  async function removeKey() {
    config.syncKey = null;
    config.syncProtocolVersion = null;
    config.legacyV2AcknowledgedAt = null;
    resetSyncConfigCursors(config, null);
    await clearLocalSyncRuntimeState(null);
    await onPersist();
    onLog("Sync key removed from this device", "warning");
  }
</script>

<!-- Sync Key Section -->
<section class="card sync-key-section">
  <h3><Fa icon={faShieldHalved} /> Sync Key</h3>
  <p class="sub-text">
    One key links every device. <strong>Generate once</strong> on your first device, then paste the
    <strong>same key</strong>
    on all others.
    <span class="warning">Keep it secret — losing it means synced data cannot be recovered.</span>
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
        {#if fingerprint}
          <div
            class="fingerprint-pill"
            title="Compare this fingerprint across devices to confirm both use the exact same key"
          >
            <Fa icon={faFingerprint} />
            <span>Key check:</span>
            <span class="fp-emoji">{fingerprint.emoji}</span>
            <code>{fingerprint.words}</code>
          </div>
        {/if}
      </div>
      <p class="key-hint">
        <Fa icon={faInfoCircle} /> This key is set. Paste it into other devices to link them, then click
        <strong>Sync now</strong>.
      </p>
      <SimpleButton secondary className="danger" onclick={handleRemoveKey}>
        <Fa icon={faTrash} /> Remove key from this device
      </SimpleButton>
      {#if onRotate}
        <SimpleButton
          secondary
          title="Creates a new sync key and space from this device; the previous remote space is kept"
          onclick={() => onRotate?.()}
        >
          <Fa icon={faArrowsRotate} /> Rotate sync key
        </SimpleButton>
      {/if}
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

<style>
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
    flex: 1 1 200px;
    min-width: 0;
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
  .fingerprint-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    background: var(--muted, #f3f4f6);
    font-size: 0.78rem;
    color: var(--muted-foreground, #6b7280);
  }
  .fp-emoji {
    font-size: 0.95rem;
    letter-spacing: 0.08em;
  }
  .key-input-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  .key-input {
    flex: 1 1 220px;
    min-width: 0;
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
  :global(.danger) {
    color: var(--danger, #ef4444);
    border-color: var(--danger, #ef4444);
  }
  :global(.danger:hover) {
    background: rgba(239, 68, 68, 0.1);
  }
  .error-text {
    color: var(--danger, #ef4444);
    font-weight: 500;
  }
</style>
