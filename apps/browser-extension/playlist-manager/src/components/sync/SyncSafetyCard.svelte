<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faLifeRing,
    faCamera,
    faRotateLeft,
    faDownload,
    faUpload,
    faShieldHalved,
    faTriangleExclamation,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import {
    captureSyncSafetyBackup,
    importSyncSafetyBackupJson,
    parseSafetyBackupJson,
    restoreSyncSafetyBackup,
    serializeSafetyBackupJson,
    type SyncSafetyBackup,
  } from "../../services/sync/sync-safety-backup.js";
  import { requestConfirm } from "../../stores/confirmation";
  import { toast } from "../../stores/toast.js";

  let {
    backups = [],
    lastError = null,
    onRefresh,
    onLog,
    onKeepLocalAndReupload,
    onConfirmEmptyWipe,
  }: {
    backups: SyncSafetyBackup[];
    lastError?: string | null;
    onRefresh: () => void | Promise<void>;
    onLog: (message: string, type?: "info" | "success" | "error" | "warning") => void;
    onKeepLocalAndReupload?: () => void | Promise<void>;
    onConfirmEmptyWipe?: () => void | Promise<void>;
  } = $props();

  let busy = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  const wipeGuardBlocked = $derived(
    typeof lastError === "string" && lastError.includes("playlists safety guard")
  );

  async function saveManualSnapshot() {
    busy = true;
    try {
      const snap = await captureSyncSafetyBackup("Manual safety snapshot", { force: true });
      await onRefresh();
      if (snap) {
        const msg = `Saved local restore point (${snap.playlistsCount} playlists, ${snap.videosCount} videos)`;
        onLog(msg, "success");
        toast.show(msg, "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`Snapshot failed: ${msg}`, "error");
      toast.show(`Snapshot failed: ${msg}`, "error");
    } finally {
      busy = false;
    }
  }

  function handleRestore(backup: SyncSafetyBackup) {
    requestConfirm({
      title: "Restore this local safety snapshot?",
      message: `This replaces your current local library with "${backup.reason}" from ${new Date(backup.createdAt).toLocaleString()} (${backup.playlistsCount} playlists, ${backup.videosCount} videos, ${backup.historyCount} watched). Click "Sync now" afterward to upload the restored state.`,
      color: "primary",
      confirmLabel: "Restore snapshot",
      onConfirm: async () => {
        busy = true;
        try {
          await restoreSyncSafetyBackup(backup.id);
          await onRefresh();
          const msg = `Restored snapshot (${backup.playlistsCount} playlists) — click "Sync now" to push`;
          onLog(msg, "success");
          toast.show(msg, "success");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          onLog(`Restore failed: ${msg}`, "error");
          toast.show(`Restore failed: ${msg}`, "error");
        } finally {
          busy = false;
        }
      },
    });
  }

  function downloadBackup(backup: SyncSafetyBackup) {
    const json = serializeSafetyBackupJson(backup);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const datePart = new Date(backup.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `iypm-safety-backup-${datePart}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onLog("Downloaded safety snapshot JSON", "info");
  }

  async function handleImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const rawText = await file.text();
      const preview = parseSafetyBackupJson(rawText);
      requestConfirm({
        title: "Import and restore this safety backup?",
        message: `Restores ${preview.playlistsCount} playlist${preview.playlistsCount === 1 ? "" : "s"} (${preview.videosCount} videos) and ${preview.historyCount} watched history item${preview.historyCount === 1 ? "" : "s"} from "${file.name}". Click "Sync now" afterward to push the restored library.`,
        color: "primary",
        confirmLabel: "Import & restore",
        onConfirm: async () => {
          busy = true;
          try {
            const restored = await importSyncSafetyBackupJson(rawText);
            await onRefresh();
            const msg = `Imported & restored ${restored.playlistsCount} playlists — click "Sync now" to push`;
            onLog(msg, "success");
            toast.show(msg, "success");
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            onLog(`Backup import failed: ${msg}`, "error");
            toast.show(`Backup import failed: ${msg}`, "error");
          } finally {
            busy = false;
          }
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`Invalid backup file: ${msg}`, "error");
      toast.show(`Invalid backup file: ${msg}`, "error");
    }
  }

  function confirmDeleteAllLocally() {
    requestConfirm({
      title: "Delete all local playlists to match cloud?",
      message:
        "Another device deleted every playlist in this sync space. Confirm only if you intentionally emptied your library; a local restore point will still remain saved above.",
      color: "danger",
      confirmLabel: "Confirm delete all locally",
      onConfirm: async () => {
        busy = true;
        try {
          await onConfirmEmptyWipe?.();
        } finally {
          busy = false;
        }
      },
    });
  }
</script>

<section class="card safety-card">
  <div class="backend-card-header">
    <Fa icon={faLifeRing} />
    <div class="backend-card-title">
      <h3>Data Protection &amp; Restore Points</h3>
      <span class="sub-text">Automatic zero-data-loss guardrails</span>
    </div>
  </div>
  <p class="sub-text">
    Automatic local restore points are saved before full syncs and remote playlist changes, mass
    playlist wipes are blocked, and future schema fields are preserved during merges.
  </p>

  <div class="safety-actions">
    <SimpleButton secondary disabled={busy} onclick={saveManualSnapshot}>
      <Fa icon={faCamera} /> Save local snapshot now
    </SimpleButton>
    <SimpleButton
      secondary
      disabled={busy}
      title="Import and restore a previously downloaded iypm-safety-backup-*.json file"
      onclick={() => fileInput?.click()}
    >
      <Fa icon={faUpload} /> Import JSON
    </SimpleButton>
    <input
      bind:this={fileInput}
      type="file"
      accept=".json,application/json"
      hidden
      onchange={handleImportFile}
    />
  </div>

  {#if wipeGuardBlocked}
    <div class="wipe-guard-banner" role="alert">
      <div class="wipe-guard-head">
        <Fa icon={faTriangleExclamation} />
        <strong>Anti-mass-wipe guard protected your local playlists</strong>
      </div>
      <p>
        Remote tombstones attempted to delete every playlist on this device. Choose whether to keep
        and re-upload your local playlists or intentionally accept the empty library once.
      </p>
      <div class="wipe-guard-actions">
        {#if onKeepLocalAndReupload}
          <SimpleButton secondary disabled={busy} onclick={() => onKeepLocalAndReupload?.()}>
            Keep local &amp; re-upload
          </SimpleButton>
        {/if}
        {#if onConfirmEmptyWipe}
          <SimpleButton secondary disabled={busy} onclick={confirmDeleteAllLocally}>
            Confirm delete all locally
          </SimpleButton>
        {/if}
      </div>
    </div>
  {/if}

  {#if backups.length > 0}
    <ul class="backup-list">
      {#each backups as b (b.id)}
        <li class="backup-row">
          <div class="backup-meta">
            <strong>{b.reason}</strong>
            <span>
              {new Date(b.createdAt).toLocaleString()} · {b.playlistsCount} playlist{b.playlistsCount ===
              1
                ? ""
                : "s"} ({b.videosCount} videos) · {b.historyCount} history
            </span>
          </div>
          <div class="backup-btns">
            <SimpleButton
              secondary
              disabled={busy}
              title="Download this restore point as a portable JSON file"
              onclick={() => downloadBackup(b)}
            >
              <Fa icon={faDownload} /> JSON
            </SimpleButton>
            <SimpleButton
              secondary
              disabled={busy}
              title="Restore local playlists, history, and settings from this snapshot"
              onclick={() => handleRestore(b)}
            >
              <Fa icon={faRotateLeft} /> Restore
            </SimpleButton>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty-note">
      <Fa icon={faShieldHalved} /> Rolling snapshots appear here automatically on your first sync, or
      click <strong>Save local snapshot now</strong> anytime.
    </p>
  {/if}
</section>

<style>
  .safety-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.65rem 0;
  }
  .wipe-guard-banner {
    margin: 0.65rem 0;
    padding: 0.65rem 0.75rem;
    border-radius: 8px;
    border: 1px solid #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    font-size: 0.78rem;
  }
  .wipe-guard-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.3rem;
  }
  .wipe-guard-banner p {
    margin: 0 0 0.5rem;
  }
  .wipe-guard-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .backup-list {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .backup-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.55rem 0.7rem;
    border-radius: 8px;
    background: var(--muted, #f3f4f6);
    border: 1px solid var(--border, #e5e7eb);
    font-size: 0.8rem;
  }
  .backup-meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }
  .backup-meta span {
    color: var(--muted-foreground, #6b7280);
    font-size: 0.75rem;
  }
  .backup-btns {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .empty-note {
    margin: 0.5rem 0 0;
    font-size: 0.78rem;
    color: var(--muted-foreground, #6b7280);
  }
</style>
