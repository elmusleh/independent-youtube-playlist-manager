<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faTriangleExclamation,
    faChevronDown,
    faChevronUp,
    faTrashCan,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import { purgeRemoteSyncSpace } from "../../services/sync/purge-remote.js";
  import type { SyncConfig } from "../../services/sync/sync-config.js";
  import { requestConfirm } from "../../stores/confirmation";

  let {
    config,
    onPurged,
    onLog,
  }: {
    config: SyncConfig;
    onPurged: () => void | Promise<void>;
    onLog: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  } = $props();

  let showAdvanced = $state(false);
  let isPurging = $state(false);

  function handlePurgeRemote() {
    requestConfirm({
      title: "Permanently delete remote sync space?",
      message:
        "This will permanently erase all encrypted data stored in your cloud space on the relay. Your local playlists, history, and settings on this device will NOT be deleted. Other devices sharing this key will lose remote sync until you generate a new space.",
      color: "danger",
      confirmLabel: "Delete remote space",
      onConfirm: async () => {
        isPurging = true;
        try {
          const backend = config.backends.includes("supabase-byo") ? "supabase-byo" : "relay";
          const res = await purgeRemoteSyncSpace(config, backend);
          if (res.ok) {
            onLog("Remote cloud sync space permanently erased", "success");
            await onPurged();
          } else {
            onLog(`Could not delete remote space: ${res.error}`, "error");
          }
        } finally {
          isPurging = false;
        }
      },
    });
  }
</script>

<div class="advanced-section">
  <button type="button" class="advanced-toggle-btn" onclick={() => (showAdvanced = !showAdvanced)}>
    <Fa icon={showAdvanced ? faChevronUp : faChevronDown} />
    <span>Advanced Space Management</span>
  </button>

  {#if showAdvanced}
    <div class="advanced-panel">
      <p class="advanced-desc">
        <Fa icon={faTriangleExclamation} /> <strong>Delete remote data:</strong> Permanently erases the
        encrypted sync records from the cloud relay without altering your local library on this device.
      </p>
      <SimpleButton
        secondary
        className="danger"
        disabled={isPurging}
        onclick={handlePurgeRemote}
        title="Delete all encrypted data on the remote relay"
      >
        <Fa icon={faTrashCan} />
        <span>{isPurging ? "Deleting remote space…" : "Delete remote sync space"}</span>
      </SimpleButton>
    </div>
  {/if}
</div>

<style>
  .advanced-section {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px dashed var(--border-color, #e5e7eb);
  }
  .advanced-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    padding: 0;
    color: var(--text-muted, #6b7280);
    font-size: 0.82rem;
    cursor: pointer;
  }
  .advanced-toggle-btn:hover {
    color: var(--text-color, #111);
  }
  .advanced-panel {
    margin-top: 0.6rem;
    padding: 0.75rem;
    background: var(--hover-color, #f9fafb);
    border-radius: 6px;
    border: 1px solid var(--border-color, #e5e7eb);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .advanced-desc {
    font-size: 0.8rem;
    color: var(--text-muted, #6b7280);
    margin: 0;
    line-height: 1.4;
  }
  :global(.danger) {
    color: var(--danger, #ef4444);
    border-color: var(--danger, #ef4444);
  }
</style>
