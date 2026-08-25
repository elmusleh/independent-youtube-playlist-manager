<script lang="ts">
  import Fa from "svelte-fa";
  import { faHdd, faInfoCircle, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "./SimpleButton.svelte";
  import { storageManager } from "../services/storage-manager.js";

  let storageMode = $state("browser");
  let storageNeedsAuth = $state(false);
  let isFileSystemSupported = "showDirectoryPicker" in window;

  function updateStorageUI() {
    storageMode = storageManager.mode;
    storageNeedsAuth = storageManager.needsAuth;
  }

  async function initStorage() {
    await storageManager.init();
    updateStorageUI();
  }

  initStorage();
</script>

<!-- Local Storage -->
<section class="card">
  <h3><Fa icon={faHdd} /> Local Storage</h3>
  <div class="field">
    <div class="field-label">Storage Location</div>
    <p class="sub-text">
      Opt out of browser storage and save your extension data directly to a local file
      (`extension_data.json`).
    </p>
    {#if !isFileSystemSupported}
      <div
        class="status-warning"
        style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #ef4444;"
      >
        <Fa icon={faInfoCircle} />
        <span>File System Access API is not supported in your browser.</span>
      </div>
    {:else if storageMode === "local"}
      <div
        class="status-warning"
        style="background: rgba(43, 166, 64, 0.1); border-color: rgba(43, 166, 64, 0.2); color: #2ba640;"
      >
        <Fa icon={faFolderOpen} />
        <span>Local Folder Connected</span>
      </div>
    {:else if storageNeedsAuth}
      <div
        class="status-warning"
        style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #ef4444;"
      >
        <Fa icon={faInfoCircle} />
        <span>Local Folder Access Revoked (Click Connect to re-authorize)</span>
      </div>
    {:else}
      <div
        class="status-warning"
        style="background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.2); color: #d97706;"
      >
        <Fa icon={faHdd} />
        <span>Browser Storage (Local disconnected)</span>
      </div>
    {/if}

    <div class="button-group">
      <SimpleButton
        disabled={!isFileSystemSupported}
        primary={storageMode !== "local" && isFileSystemSupported}
        secondary={storageMode === "local"}
        onclick={async () => {
          try {
            const success = await storageManager.connectFolder();
            if (success) {
              updateStorageUI();
              window.success("Local folder connected successfully.");
            }
          } catch (err: any) {
            window.error("Failed to connect folder: " + err.message);
          }
        }}
      >
        {storageMode === "local" ? "Change Folder" : "Connect Local Folder"}
      </SimpleButton>
      {#if storageMode === "local" || storageNeedsAuth}
        <SimpleButton
          danger
          onclick={async () => {
            try {
              await storageManager.disconnectFolder();
              updateStorageUI();
              window.success("Reverted to browser storage.");
            } catch (err: any) {
              window.error("Failed to disconnect folder: " + err.message);
            }
          }}
        >
          Disconnect
        </SimpleButton>
      {/if}
    </div>
  </div>
</section>
