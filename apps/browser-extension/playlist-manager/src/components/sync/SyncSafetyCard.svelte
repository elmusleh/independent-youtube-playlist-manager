<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faLifeRing,
    faCamera,
    faRotateLeft,
    faDownload,
    faShieldHalved,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import {
    captureSyncSafetyBackup,
    restoreSyncSafetyBackup,
    serializeSafetyBackupJson,
    type SyncSafetyBackup,
  } from "../../services/sync/sync-safety-backup.js";
  import { requestConfirm } from "../../stores/confirmation";
  import { toast } from "../../stores/toast.js";

  let {
    backups = [],
    onRefresh,
    onLog,
  }: {
    backups: SyncSafetyBackup[];
    onRefresh: () => void | Promise<void>;
    onLog: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  } = $props();

  let busy = $state(false);

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
  </div>

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
    margin: 0.65rem 0;
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
