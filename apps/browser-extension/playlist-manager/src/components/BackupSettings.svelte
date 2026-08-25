<script lang="ts">
  import Fa from "svelte-fa";
  import { faDatabase, faFileExport, faFileImport } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "./SimpleButton.svelte";
  import { requestConfirm } from "../stores/confirmation.js";
  import {
    exportFullDatabaseBackup,
    importFullDatabaseBackup,
    downloadBackupFile,
  } from "../services/backup-service.js";

  let fullBackupFileInput: HTMLInputElement | null = $state(null);
  let isExportingBackup = $state(false);
  let isImportingBackup = $state(false);

  async function handleExportFullBackup() {
    try {
      isExportingBackup = true;
      const backup = await exportFullDatabaseBackup();
      downloadBackupFile(backup);
      window.success(
        `Exported complete database backup (${backup.metadata.totalPlaylists} playlists, ${backup.metadata.totalMetadataEntries} cached videos, ${backup.metadata.totalHistoryEntries} history entries).`
      );
    } catch (err: any) {
      window.error("Failed to export database backup: " + (err.message || String(err)));
    } finally {
      isExportingBackup = false;
    }
  }

  function triggerImportFullBackupDialog() {
    if (fullBackupFileInput) {
      fullBackupFileInput.value = "";
      fullBackupFileInput.click();
    }
  }

  async function onFullBackupFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || !target.files[0]) return;
    const file = target.files[0];

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      requestConfirm({
        title: "Restore Complete Database Backup",
        message:
          "How would you like to restore this backup?\n\n• Merge: Safely adds playlists, updates video metadata, and preserves newest watch timestamps without deleting existing playlists.\n• Click Confirm to perform Merge restore.",
        confirmLabel: "Merge Restore (Safe)",
        color: "primary",
        onConfirm: async () => {
          await executeImportFullBackup(json, "merge");
        },
      });
    } catch (err: any) {
      window.error("Invalid JSON file: " + (err.message || String(err)));
    }
  }

  async function executeImportFullBackup(json: any, mode: "merge" | "overwrite") {
    try {
      isImportingBackup = true;
      const result = await importFullDatabaseBackup(json, mode);
      if (result.success) {
        window.success(
          `Backup restored (${mode}): ${result.importedPlaylists} playlists, ${result.importedMetadata} cached videos, ${result.importedHistory} history entries.`
        );
      } else {
        window.error("Restore failed: " + (result.errors.join("; ") || "Unknown error"));
      }
    } catch (err: any) {
      window.error("Restore failed: " + (err.message || String(err)));
    } finally {
      isImportingBackup = false;
    }
  }
</script>

<!-- Database Backup & Portable Restore -->
<section class="card">
  <h3><Fa icon={faDatabase} /> Database Backup & Portable Restore</h3>
  <p class="sub-text">
    Create portable, zero-data-loss backups of your entire extension state (playlists, full
    IndexedDB video metadata cache, watch history progress, and settings). Transfer seamlessly
    across browsers and devices.
  </p>

  <input
    type="file"
    accept=".json,application/json"
    bind:this={fullBackupFileInput}
    style="display: none;"
    onchange={onFullBackupFileSelected}
  />

  <div class="data-management-section" style="margin-top: 0.5em;">
    <div class="field-label">Portability Pipeline</div>
    <p class="sub-text">
      Export comprehensive backup file or restore previously saved state with automatic schema
      validation and duplicate resolution.
    </p>
    <div class="button-group">
      <SimpleButton
        primary
        onclick={handleExportFullBackup}
        disabled={isExportingBackup || isImportingBackup}
        title="Export complete database and metadata cache as JSON"
      >
        <Fa icon={faFileExport} fw /> Export Full Backup (.json)
      </SimpleButton>
      <SimpleButton
        secondary
        onclick={triggerImportFullBackupDialog}
        disabled={isExportingBackup || isImportingBackup}
        title="Import and restore backup JSON file"
      >
        <Fa icon={faFileImport} fw /> Restore Backup
      </SimpleButton>
    </div>
  </div>
</section>
