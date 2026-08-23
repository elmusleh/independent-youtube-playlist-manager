<script lang="ts">
  import { onDestroy } from "svelte";
  import { push } from "svelte-spa-router";
  import SimpleButton from "../components/SimpleButton.svelte";
  import ToggleSwitch from "../components/ToggleSwitch.svelte";
  import type { Settings } from "../types/model.js";
  import { requestConfirm } from "../stores/confirmation.js";
  import { storageManager } from "../services/storage-manager.js";
  import Fa from "svelte-fa";
  import {
    faInfoCircle,
    faStar,
    faListCheck,
    faMousePointer,
    faMicrochip,
    faCheck,
    faCircleCheck,
    faPlayCircle,
    faBolt,
    faClockRotateLeft,
    faFileExport,
    faFileImport,
    faTrash,
    faFolderOpen,
    faHdd,
    faGear,
    faGlobe,
    faDatabase,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import { sineIn } from "svelte/easing";

  import {
    exportFullDatabaseBackup,
    importFullDatabaseBackup,
    downloadBackupFile,
  } from "../services/backup-service.js";

  const browser = (window as any).browser || (window as any).chrome;
  const HISTORY_KEY = "local_yt_history";

  function focusEl(node: HTMLElement) {
    node.focus();
  }

  const CREATE_NEW = "__create_new__";

  const PAGE_SIZES = [10, 20, 30, 40, 50, 100, 250, 500];
  const CACHE_DURATIONS = [
    { value: 5, label: "5 minutes" },
    { value: 15, label: "15 minutes" },
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
    { value: 1440, label: "24 hours" },
    { value: -1, label: "No expiration" },
  ];

  let settings: Settings | null = $state(null);
  let playlists: YtPlaylistInfoExtended[] = $state([]);
  let loadingPlaylists = $state(false);
  const status = new StatusManager();

  let selectedFavoriteId: string | null = $state(null);
  let showNamePrompt = $state(false);
  let showYtNativeInfo = $state(false);
  let showPlayAllInfo = $state(false);
  let newPlaylistName = $state("");
  let signedIn = $state(false);

  let storageMode = $state("browser");
  let storageNeedsAuth = $state(false);
  let isFileSystemSupported = "showDirectoryPicker" in window;
  let metadataCacheCount = $state<number>(0);

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
        message: "How would you like to restore this backup?\n\n• Merge: Safely adds playlists, updates video metadata, and preserves newest watch timestamps without deleting existing playlists.\n• Click Confirm to perform Merge restore.",
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
        await refresh();
      } else {
        window.error("Restore failed: " + (result.errors.join("; ") || "Unknown error"));
      }
    } catch (err: any) {
      window.error("Restore failed: " + (err.message || String(err)));
    } finally {
      isImportingBackup = false;
    }
  }

  async function loadMetadataCacheStats() {
    if (typeof window.getMetadataCacheCount === "function") {
      metadataCacheCount = await window.getMetadataCacheCount();
    }
  }

  function requestClearMetadataCache() {
    requestConfirm({
      title: "Clear Metadata Cache?",
      message: `Are you sure you want to clear all ${metadataCacheCount} cached video metadata entries from local storage? Missing data will be refetched on demand.`,
      color: "danger",
      onConfirm: async () => {
        if (typeof window.clearAllMetadataCache === "function") {
          await window.clearAllMetadataCache();
          await loadMetadataCacheStats();
        }
      },
    });
  }

  async function refresh() {
    await status.refresh(async () => {
      await loadPlaylists();
      await loadMetadataCacheStats();
      const s = await window.getSettings();
      settings = s;
    });
  }

  async function initStorage() {
    await storageManager.init();
    updateStorageUI();
    loadMetadataCacheStats();
  }

  function updateStorageUI() {
    storageMode = storageManager.mode;
    storageNeedsAuth = storageManager.needsAuth;
  }

  initStorage();

  window
    .getSettings()
    .then((s) => {
      settings = s;
      status.lastUpdated = Date.now();
    })
    .catch(async (e) => {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[SETTINGS] Failed to load settings:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[SETTINGS] Failed to load settings: ${errMsg}`,
        );
    });

  async function checkSignIn() {
    try {
      signedIn = await window.isSignedIn();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[SETTINGS] checkSignIn failed:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[SETTINGS] checkSignIn failed: ${errMsg}`,
        );
    }
  }
  checkSignIn();

  let initialized = $state(false);

  const handleAuthChange = (e: any) => {
    signedIn = e.detail.isSignedIn;
  };

  window.addEventListener("yt-auth-changed", handleAuthChange);

  $effect(() => {
    if (
      settings &&
      !loadingPlaylists &&
      !initialized &&
      settings?.watchLaterPlaylistId !== undefined
    ) {
      selectedFavoriteId = settings?.watchLaterPlaylistId ?? null;
      initialized = true;
    }
  });

  function onFavoriteSelectChange() {
    if (selectedFavoriteId === null && !signedIn) {
      showYtNativeInfo = true;
    }
  }

  async function loadPlaylists() {
    loadingPlaylists = true;
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        "[SETTINGS] Loading playlists for favorite selection",
      );
    try {
      playlists = await window.getAccountPlaylists();
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[SETTINGS] Loaded ${playlists.length} playlists`,
        );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to load playlists:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[SETTINGS] Failed to load playlists: ${errMsg}`,
        );
    } finally {
      loadingPlaylists = false;
    }
  }

  loadPlaylists();

  async function handleFavoriteAction() {
    if (selectedFavoriteId === settings?.watchLaterPlaylistId) return;

    if (selectedFavoriteId === CREATE_NEW) {
      newPlaylistName = "";
      showNamePrompt = true;
    } else if (selectedFavoriteId === null) {
      if (!signedIn) {
        showYtNativeInfo = true;
      } else {
        await saveFavorite(null);
      }
    } else {
      await saveFavorite(selectedFavoriteId);
    }
  }

  async function saveFavorite(id: string | null) {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        `[SETTINGS] Saving favorite playlist: ${id ?? "YouTube Native"}`,
      );
    await save("watchLaterPlaylistId", id, () => {
      window.invalidateCacheAndNotify();
      window.success("Favorite target updated");
      if (settings) settings!.watchLaterPlaylistId = id;
    });
  }

  async function confirmCreatePlaylist() {
    const title = newPlaylistName.trim();
    if (!title) return;

    showNamePrompt = false;
    await status.save(async () => {
      const newId = await window.savePlaylist(
        {
          id: "",
          title: title,
          videos: [],
          timestamp: Date.now(),
          isLocal: true,
          saved: true,
        },
        { syncToYoutube: false },
      );

      if (settings) settings!.watchLaterPlaylistId = newId;
      selectedFavoriteId = newId;

      await window.storeObject("watchLaterPlaylistId", newId);
      window.invalidateCacheAndNotify();
      await loadPlaylists();
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[SETTINGS] Created and set favorite: "${title}" (${newId})`,
        );
      window.success(`Created and set favorite: ${title}`);
    });
  }

  function handleRuntimeMessage(msg: any) {
    if (msg?.cmd === "update-saved-playlists") {
      loadPlaylists();
    }
  }

  browser.runtime.onMessage.addListener(handleRuntimeMessage);
  onDestroy(() => {
    browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    window.removeEventListener("yt-auth-changed", handleAuthChange);
  });

  async function save(key: keyof Settings, value: any, onDone?: () => void) {
    await status.save(async () => {
      try {
        await window.storeObject(key as string, value);
        if (onDone) onDone();
        if (window.logSystemEvent)
          await window.logSystemEvent("INFO", `[SETTINGS] Saved setting: ${key}`);
        if (window.success) window.success("Setting saved");
      } catch (e: any) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(`[SETTINGS] Failed to save ${key}:`, e);
        if (window.logSystemEvent)
          await window.logSystemEvent("ERROR", `[SETTINGS] Failed to save ${key}: ${errMsg}`);
        if (window.error) window.error(`Failed to save setting: ${errMsg}`);
        throw e;
      }
    });
  }

  async function clearWatchHistory() {
    requestConfirm({
      title: "Clear Watch History?",
      message:
        "This will reset all your saved video timestamps. This cannot be undone.",
      color: "danger",
      onConfirm: async () => {
        if (window.logSystemEvent)
          await window.logSystemEvent(
            "INFO",
            "[SETTINGS] Clearing watch history",
          );
        try {
          await browser.storage.local.remove(HISTORY_KEY);
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "INFO",
              "[SETTINGS] Watch history cleared",
            );
          window.success("Watch history cleared");
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "ERROR",
              `[SETTINGS] Failed to clear history: ${errMsg}`,
            );
          window.error("Failed to clear history");
        }
      },
    });
  }

  async function exportHistory() {
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", "[SETTINGS] Exporting watch history");
    try {
      const data = await browser.storage.local.get(HISTORY_KEY);
      const historyObj = data[HISTORY_KEY] || {};
      const blob = new Blob([JSON.stringify(historyObj, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "yph-watch-history.json";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          "[SETTINGS] Watch history exported successfully",
        );
      window.success("History exported successfully");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to export history:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[SETTINGS] Export failed: ${errMsg}`,
        );
      window.error("Export failed");
    }
  }

  function importHistory() {
    const fi = document.getElementById(
      "HistoryImportInput",
    ) as HTMLInputElement;
    fi.onchange = () => {
      const file = fi.files?.[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const importedData = JSON.parse(fr.result as string);
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "INFO",
              "[SETTINGS] Importing watch history from file",
            );

          await browser.storage.local.set({ [HISTORY_KEY]: importedData });

          if (window.logSystemEvent)
            await window.logSystemEvent(
              "INFO",
              "[SETTINGS] Watch history imported successfully",
            );
          window.success("History imported successfully");
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error("Failed to import history:", e);
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "ERROR",
              `[SETTINGS] Import failed: ${errMsg}`,
            );
          window.error("File is incorrectly formatted");
        }
        fi.value = "";
      };
      fr.readAsText(file);
    };
    fi.click();
  }
</script>

<main>
  <div class="view-header">
    <div class="top-left">
      <ViewHeader icon={faGear} title="Settings" />
    </div>

    <div class="btn-group right-align">
      <SaveStatus onclick={refresh} {status} />
    </div>
  </div>

  <div class="view-body">
    {#if settings}
      <div class="settings-grid">
        <!-- System Info -->
        <section class="card info-card">
          <div class="info-header">
            <Fa icon={faInfoCircle} />
            <h4>System Info</h4>
          </div>
          <div class="info-content">
            <div class="info-row">
              <span>Version</span>
              <strong>v{browser.runtime.getManifest().version}</strong>
            </div>
            <div class="info-row">
              <span>Environment</span>
              <strong>Manifest V3</strong>
            </div>
          </div>
        </section>

        <!-- Playback -->
        <section class="card">
          <h3><Fa icon={faPlayCircle} /> Playback</h3>
          <div class="toggle-row">
            <div class="toggle-info">
              <span>Open YouTube playlist page</span>
              <span class="sub-text"
                >When playing, use the official page instead of anonymous play</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.openPlaylistPage ?? false}
              onchange={(val) => {
                if (settings) settings!.openPlaylistPage = val;
                save("openPlaylistPage", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Split into multiple tabs</span>
              <span class="sub-text"
                >Open large playlists across multiple tabs instead of one</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.playAllChunkEnabled ?? false}
              onchange={(val) => {
                if (settings) settings!.playAllChunkEnabled = val;
                save("playAllChunkEnabled", val);
              }}
            />
          </div>

          <div class="field">
            <div class="label-with-info">
              <label for="playAllChunkSize">Videos per tab</label>
              <button
                class="info-icon-btn"
                onclick={() => (showPlayAllInfo = true)}
                title="Learn about video limits for signed-in vs guest users"
                aria-label="Show information about play all video limits"
              >
                <Fa icon={faInfoCircle} />
              </button>
            </div>
            <p class="sub-text">Maximum number of videos per tab.</p>
            <div class="number-input-group">
              <input
                aria-label="Play All Chunk Size"
                id="playAllChunkSize"
                type="number"
                min="1"
                max="500"
                step="1"
                bind:value={settings.playAllChunkSize}
                onblur={() =>
                  save("playAllChunkSize", settings?.playAllChunkSize)}
                onkeydown={(e) => {
                  if (e.key === "Enter") {
                    save("playAllChunkSize", settings?.playAllChunkSize);
                  }
                }}
              />
            </div>
          </div>
        </section>

        <!-- Watch History -->
        <section class="card">
          <h3><Fa icon={faClockRotateLeft} /> Watch History</h3>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Watch History Tracking</span>
              <span class="sub-text"
                >Track your watch progress and store it locally.</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.ruleEnabled ?? false}
              onchange={(val) => {
                if (settings) settings!.ruleEnabled = val;
                save("ruleEnabled", val);
              }}
            />
          </div>

          {#if settings?.ruleEnabled}
            <div class="toggle-row indent-row">
              <div class="toggle-info">
                <span>Save history on pause</span>
                <span class="sub-text"
                  >Update your timestamp whenever you pause the video.</span
                >
              </div>
              <ToggleSwitch
                checked={settings?.ruleTrackPause ?? false}
                onchange={(val) => {
                  if (settings) settings!.ruleTrackPause = val;
                  save("ruleTrackPause", val);
                }}
              />
            </div>

            <div class="toggle-row indent-row">
              <div class="toggle-info">
                <span>Save history on page leave</span>
                <span class="sub-text"
                  >Update your timestamp when closing the tab or navigating
                  away.</span
                >
              </div>
              <ToggleSwitch
                checked={settings?.ruleTrackUnload ?? false}
                onchange={(val) => {
                  if (settings) settings!.ruleTrackUnload = val;
                  save("ruleTrackUnload", val);
                }}
              />
            </div>

            <div class="toggle-row">
              <div class="toggle-info">
                <span>Auto-Delete when finished</span>
                <span class="sub-text"
                  >Remove the video from the local playlist once you finish
                  watching it.</span
                >
              </div>
              <ToggleSwitch
                checked={settings?.ruleAutoDelete ?? false}
                onchange={(val) => {
                  if (settings) settings!.ruleAutoDelete = val;
                  save("ruleAutoDelete", val);
                }}
              />
            </div>

            <div class="field">
              <label for="ruleCompletionThreshold"
                >Completion Threshold (%)</label
              >
              <p class="sub-text">
                Consider a video "finished" when this percentage is reached.
              </p>
              <input
                aria-label="Completion threshold percent"
                id="ruleCompletionThreshold"
                type="number"
                min="1"
                max="100"
                bind:value={settings.ruleCompletionThreshold}
                onchange={() =>
                  save(
                    "ruleCompletionThreshold",
                    settings?.ruleCompletionThreshold,
                  )}
              />
            </div>
          {/if}

          <div class="field">
            <label for="ruleHistoryRetentionDays">Keep History For (Days)</label
            >
            <p class="sub-text">
              How long your local watch history is stored before being pruned.
            </p>
            <input
              aria-label="History retention days"
              id="ruleHistoryRetentionDays"
              type="number"
              min="1"
              max="3650"
              bind:value={settings.ruleHistoryRetentionDays}
              onchange={() =>
                save(
                  "ruleHistoryRetentionDays",
                  settings?.ruleHistoryRetentionDays,
                )}
            />
          </div>

          <div class="field">
            <label for="ruleHistoryThrottleMs"
              >History Throttle Interval (ms)</label
            >
            <p class="sub-text">
              Minimum time between saves to prevent excessive storage writes.
            </p>
            <select
              aria-label="History throttle interval"
              id="ruleHistoryThrottleMs"
              bind:value={settings.ruleHistoryThrottleMs}
              onchange={() =>
                save("ruleHistoryThrottleMs", settings?.ruleHistoryThrottleMs)}
            >
              <option value={1000}>1 second</option>
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
            </select>
          </div>

          <div class="field">
            <label for="ruleHistoryDebounceMs"
              >History Debounce Delay (ms)</label
            >
            <p class="sub-text">
              Delay before saving after pause or tab switch to avoid momentary
              pauses.
            </p>
            <select
              aria-label="History debounce delay"
              id="ruleHistoryDebounceMs"
              bind:value={settings.ruleHistoryDebounceMs}
              onchange={() =>
                save("ruleHistoryDebounceMs", settings?.ruleHistoryDebounceMs)}
            >
              <option value={500}>0.5 seconds</option>
              <option value={1000}>1 second</option>
              <option value={2000}>2 seconds</option>
              <option value={5000}>5 seconds</option>
            </select>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Track During Playback</span>
              <span class="sub-text"
                >Periodically save position while video is playing (not just on
                pause).</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.ruleTrackDuringPlayback ?? false}
              onchange={(val) => {
                if (settings) settings!.ruleTrackDuringPlayback = val;
                save("ruleTrackDuringPlayback", val);
              }}
            />
          </div>

          <div class="data-management-section">
            <div class="field-label">Manage Data</div>
            <p class="sub-text">
              Export, import, or clear your local watch history timestamps.
            </p>
            <div class="button-group">
              <SimpleButton secondary onclick={exportHistory}>
                <Fa icon={faFileExport} fw /> Export
              </SimpleButton>
              <SimpleButton secondary onclick={importHistory}>
                <Fa icon={faFileImport} fw /> Import
              </SimpleButton>
              <SimpleButton danger onclick={clearWatchHistory}>
                <Fa icon={faTrash} fw /> Clear
              </SimpleButton>
            </div>
          </div>
        </section>

        <!-- Favorite Playlist -->
        <section class="card">
          <h3><Fa icon={faStar} /> Favorite Playlist</h3>
          <div class="field">
            <label for="watchLaterPlaylist">Target Playlist</label>
            <p class="sub-text">
              Pick a managed playlist to be your favorite. It will always be
              kept alive (recreated if deleted) and is used for quick-add
              shortcuts.
            </p>
            {#if settings!.watchLaterPlaylistId === null && !signedIn}
              <div class="status-warning">
                <Fa icon={faInfoCircle} />
                <span>Sign-in required for YouTube Native</span>
              </div>
            {/if}
            {#if loadingPlaylists}
              <p class="loading">Loading playlists...</p>
            {:else}
              <select
                id="watchLaterPlaylist"
                bind:value={selectedFavoriteId}
                disabled={status.saving}
                onchange={onFavoriteSelectChange}
              >
                <option value={CREATE_NEW}
                  >✚ Create new managed playlist...</option
                >
                <option value={null}>YouTube Native (Watch Later)</option>
                {#each playlists as playlist}
                  <option value={playlist.id}>{playlist.title}</option>
                {/each}
              </select>

              <div class="favorite-action-container">
                <SimpleButton
                  className="btn-full-width"
                  primary={selectedFavoriteId !==
                    settings?.watchLaterPlaylistId}
                  secondary={selectedFavoriteId ===
                    settings?.watchLaterPlaylistId}
                  onclick={handleFavoriteAction}
                  disabled={status.saving ||
                    selectedFavoriteId === settings?.watchLaterPlaylistId}
                  title="Apply favorite playlist target"
                >
                  {#if selectedFavoriteId === settings?.watchLaterPlaylistId}
                    <Fa icon={faCircleCheck} /> Current Favorite
                  {:else if selectedFavoriteId === CREATE_NEW}
                    Create New Playlist
                  {:else if selectedFavoriteId === null}
                    Use YouTube Native
                  {:else}
                    Set as Favorite
                  {/if}
                </SimpleButton>
              </div>
            {/if}
          </div>
        </section>

        <!-- Playlist Editor -->
        <section class="card">
          <h3><Fa icon={faListCheck} /> Playlist Editor</h3>
          <div class="toggle-row">
            <div class="toggle-info">
              <span>Open editor after creation</span>
              <span class="sub-text"
                >Instead of playing the playlist immediately</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.openPlaylistEditorAfterCreation ?? false}
              onchange={(val) => {
                if (settings) settings!.openPlaylistEditorAfterCreation = val;
                save("openPlaylistEditorAfterCreation", val);
              }}
            />
          </div>

          <div class="field">
            <label for="addToLatestPosition"
              >Add to latest playlist position</label
            >
            <p class="sub-text">
              Where to add new videos in the latest playlist
            </p>
            <select
              id="addToLatestPosition"
              bind:value={settings.addToLatestPosition}
              onchange={() =>
                save("addToLatestPosition", settings?.addToLatestPosition)}
            >
              <option value="bottom">Bottom (End of playlist)</option>
              <option value="top">Top (Beginning of playlist)</option>
            </select>
          </div>

          <div class="field">
            <label for="defaultEditorPage">Default page when opening</label>
            <select
              id="defaultEditorPage"
              bind:value={settings.defaultEditorPage}
              onchange={() =>
                save("defaultEditorPage", settings?.defaultEditorPage)}
            >
              <option value="/new">New playlist</option>
              <option value="/saved">Saved playlists</option>
            </select>
          </div>

          <div class="field">
            <label for="defaultPageSize">Videos per page</label>
            <select
              id="defaultPageSize"
              bind:value={settings.defaultPageSize}
              onchange={() =>
                save("defaultPageSize", settings?.defaultPageSize)}
            >
              {#each PAGE_SIZES as size}
                <option value={size}>{size}</option>
              {/each}
            </select>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Disable thumbnails</span>
              <span class="sub-text">Hide video previews to save bandwidth</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.disableThumbnails ?? false}
              onchange={(val) => {
                if (settings) settings!.disableThumbnails = val;
                save("disableThumbnails", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Auto-remove duplicates</span>
              <span class="sub-text"
                >Skip duplicate videos when adding to a playlist</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.autoRemoveDuplicates ?? false}
              onchange={(val) => {
                if (settings) settings!.autoRemoveDuplicates = val;
                save("autoRemoveDuplicates", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Auto-remove empty playlists</span>
              <span class="sub-text"
                >Automatically delete local or synced playlists if all their videos are deleted</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.autoDeleteEmptyPlaylists ?? false}
              onchange={(val) => {
                if (settings) settings!.autoDeleteEmptyPlaylists = val;
                save("autoDeleteEmptyPlaylists", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Auto-save changes</span>
              <span class="sub-text"
                >Automatically save playlist edits after a delay. When off, use
                the Refresh button to save manually.</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.autoSaveEditor ?? false}
              onchange={(val) => {
                if (settings) settings!.autoSaveEditor = val;
                save("autoSaveEditor", val);
              }}
            />
          </div>

          {#if settings?.autoSaveEditor}
            <div class="field">
              <label for="autoSaveInterval">Auto-save delay</label>
              <p class="sub-text">
                How long to wait after your last edit before saving
                automatically.
              </p>
              <select
                id="autoSaveInterval"
                bind:value={settings.autoSaveInterval}
                onchange={() =>
                  save("autoSaveInterval", settings?.autoSaveInterval)}
              >
                <option value={1}>1 second</option>
                <option value={2}>2 seconds</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
              </select>
            </div>
          {/if}
        </section>

        <!-- Video Metadata & Scraping Engine -->
        <section class="card">
          <h3><Fa icon={faGlobe} /> Video Metadata & Scraping</h3>
          <p class="sub-text">
            Configure how YouTube video titles, channels, and durations are fetched and prioritized.
          </p>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Auto-fetch metadata</span>
              <span class="sub-text"
                >Automatically fetch missing video titles and durations when loading a playlist</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.autoFetchMetadata ?? false}
              onchange={(val) => {
                if (settings) settings!.autoFetchMetadata = val;
                save("autoFetchMetadata", val);
              }}
            />
          </div>

          <div class="field">
            <label for="metadataExecutionStrategy">Execution Strategy</label>
            <p class="sub-text">
              Choose whether to prioritize zero-quota scraping or the official YouTube Data API.
            </p>
            <select
              id="metadataExecutionStrategy"
              bind:value={settings.metadataExecutionStrategy}
              onchange={() =>
                save("metadataExecutionStrategy", settings?.metadataExecutionStrategy)}
            >
              <option value="free_first">⚡ Zero-Quota / Free First (Recommended — Saves API Quota)</option>
              <option value="api_first">🔑 Official YouTube Data API First (Consumes Daily Quota)</option>
            </select>
          </div>

          <h4 style="margin: 1.2em 0 0.4em; font-size: 14px; color: var(--text-color);">Active Extraction Engines</h4>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Multi-Client Innertube Engine</span>
              <span class="sub-text"
                >Fast mobile/web endpoint (MWEB/WEB) — zero quota, complete duration and views</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableInnertubeScraping ?? true}
              onchange={(val) => {
                if (settings) settings!.enableInnertubeScraping = val;
                save("enableInnertubeScraping", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Embed Page Headless Scraper</span>
              <span class="sub-text"
                >Direct YouTube embed player response parser — zero quota fallback</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableEmbedScraping ?? true}
              onchange={(val) => {
                if (settings) settings!.enableEmbedScraping = val;
                save("enableEmbedScraping", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Official YouTube oEmbed</span>
              <span class="sub-text"
                >Fast unauthenticated Google endpoint guaranteeing title and channel</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableOEmbedScraping ?? true}
              onchange={(val) => {
                if (settings) settings!.enableOEmbedScraping = val;
                save("enableOEmbedScraping", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Piped & Invidious Fallback</span>
              <span class="sub-text"
                >Query mirrored public/self-hosted instances if YouTube blocks direct requests</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableInvidiousPiped ?? true}
              onchange={(val) => {
                if (settings) settings!.enableInvidiousPiped = val;
                save("enableInvidiousPiped", val);
              }}
            />
          </div>

          {#if settings?.enableInvidiousPiped}
            <div class="field" style="margin-top: 0.8em;">
              <label for="customInvidiousInstances">Custom Invidious Instances (Optional)</label>
              <p class="sub-text">
                Add self-hosted or trusted Invidious URLs (separated by comma or newline)
              </p>
              <input
                id="customInvidiousInstances"
                type="text"
                placeholder="https://inv.example.com, https://invidious.local"
                bind:value={settings.customInvidiousInstances}
                onblur={() => save("customInvidiousInstances", settings?.customInvidiousInstances)}
                onkeydown={(e) => {
                  if (e.key === "Enter") save("customInvidiousInstances", settings?.customInvidiousInstances);
                }}
              />
            </div>

            <div class="field">
              <label for="customPipedInstances">Custom Piped API Instances (Optional)</label>
              <p class="sub-text">
                Add self-hosted or trusted Piped API URLs (separated by comma or newline)
              </p>
              <input
                id="customPipedInstances"
                type="text"
                placeholder="https://pipedapi.example.com"
                bind:value={settings.customPipedInstances}
                onblur={() => save("customPipedInstances", settings?.customPipedInstances)}
                onkeydown={(e) => {
                  if (e.key === "Enter") save("customPipedInstances", settings?.customPipedInstances);
                }}
              />
            </div>
          {/if}

          <div style="margin-top: 1.2em; padding-top: 1em; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="font-weight: 500;"><Fa icon={faDatabase} /> Local Metadata Cache</span>
              <p class="sub-text" style="margin: 2px 0 0;">
                {metadataCacheCount} {metadataCacheCount === 1 ? 'video' : 'videos'} stored in IndexedDB (24h TTL)
              </p>
            </div>
            <SimpleButton
              danger={true}
              onclick={requestClearMetadataCache}
              title="Clear cached video titles and durations"
            >
              <Fa icon={faTrash} /> Clear Metadata Cache
            </SimpleButton>
          </div>
        </section>

        <!-- Quick Add & Tabs -->
        <section class="card">
          <h3><Fa icon={faBolt} /> Quick Add & Tabs</h3>
          <div class="field">
            <label for="defaultQuickAddTarget">Default Quick Add Target</label>
            <p class="sub-text">
              Default playlist targeted when opening the popup
            </p>
            <select
              id="defaultQuickAddTarget"
              bind:value={settings.defaultQuickAddTarget}
              onchange={() =>
                save("defaultQuickAddTarget", settings?.defaultQuickAddTarget)}
            >
              <option value="create">Create new playlist</option>
              <option value="latest">Latest Playlist</option>
              <option value="favorite">Favorite Playlist</option>
            </select>
          </div>

          <div class="field">
            <label for="defaultTabScope">Default Tab Scope</label>
            <p class="sub-text">Which tabs to add when clicking "Add Videos"</p>
            <select
              id="defaultTabScope"
              bind:value={settings.defaultTabScope}
              onchange={() =>
                save("defaultTabScope", settings?.defaultTabScope)}
            >
              <option value="current">Only this tab</option>
              <option value="left">Tabs to the left (this window)</option>
              <option value="right">Tabs to the right (this window)</option>
              <option value="all-this-window-include"
                >All tabs in this window (include this)</option
              >
              <option value="all-this-window-exclude"
                >All tabs in this window (exclude this)</option
              >
              <option value="all-windows">All tabs across all windows</option>
            </select>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Auto-save to YouTube</span>
              <span class="sub-text"
                >Automatically sync newly created playlists</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.saveCreatedPlaylists}
              onchange={(val) => {
                settings!.saveCreatedPlaylists = val;
                save("saveCreatedPlaylists", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Close YouTube tabs</span>
              <span class="sub-text"
                >Automatically close tabs after adding them</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.closeAddedTabs}
              onchange={(val) => {
                settings!.closeAddedTabs = val;
                save("closeAddedTabs", val);
              }}
            />
          </div>
        </section>

        <!-- Context Menu -->
        <section class="card">
          <h3><Fa icon={faMousePointer} /> Context Menu</h3>
          <div class="toggle-row">
            <div class="toggle-info">
              <span>Open saved playlist after add</span>
            </div>
            <ToggleSwitch
              checked={settings?.openSavedPlaylistAfterAdd}
              onchange={(val) => {
                settings!.openSavedPlaylistAfterAdd = val;
                save("openSavedPlaylistAfterAdd", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Open builder after add</span>
            </div>
            <ToggleSwitch
              checked={settings?.openPlaylistBuilderAfterAdd}
              onchange={(val) => {
                settings!.openPlaylistBuilderAfterAdd = val;
                save("openPlaylistBuilderAfterAdd", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Disable builder in context menu</span>
            </div>
            <ToggleSwitch
              checked={settings?.disableContextBuilder}
              onchange={(val) => {
                settings!.disableContextBuilder = val;
                save("disableContextBuilder", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Disable saved playlists in context menu</span>
            </div>
            <ToggleSwitch
              checked={settings?.disableContextSaved}
              onchange={(val) => {
                settings!.disableContextSaved = val;
                save("disableContextSaved", val);
              }}
            />
          </div>
        </section>

        <!-- Local Storage -->
        <section class="card">
          <h3><Fa icon={faHdd} /> Local Storage</h3>
          <div class="field">
            <div class="field-label">Storage Location</div>
            <p class="sub-text">
              Opt out of browser storage and save your extension data directly
              to a local file (`extension_data.json`).
            </p>
            {#if !isFileSystemSupported}
              <div
                class="status-warning"
                style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #ef4444;"
              >
                <Fa icon={faInfoCircle} />
                <span
                  >File System Access API is not supported in your browser.</span
                >
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
                <span
                  >Local Folder Access Revoked (Click Connect to re-authorize)</span
                >
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
                {storageMode === "local"
                  ? "Change Folder"
                  : "Connect Local Folder"}
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
                      window.error(
                        "Failed to disconnect folder: " + err.message,
                      );
                    }
                  }}
                >
                  Disconnect
                </SimpleButton>
              {/if}
            </div>
          </div>
        </section>

        <!-- Full Database Backup & Portable Restore -->
        <section class="card">
          <h3><Fa icon={faDatabase} /> Database Backup & Portable Restore</h3>
          <p class="sub-text">
            Create portable, zero-data-loss backups of your entire extension state (playlists, full IndexedDB video metadata cache, watch history progress, and settings). Transfer seamlessly across browsers and devices.
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
              Export comprehensive backup file or restore previously saved state with automatic schema validation and duplicate resolution.
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

        <!-- YouTube Features -->
        <section class="card">
          <h3><Fa icon={faPlayCircle} /> YouTube Features</h3>
          <p class="sub-text">
            Enable additional data fetching from your YouTube account. Disabling
            these hides them from the sidebar.
          </p>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Liked Videos</span>
              <span class="sub-text">Show your Liked Videos in the sidebar</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableLikedVideos}
              onchange={(val) => {
                settings!.enableLikedVideos = val;
                save("enableLikedVideos", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Uploaded Videos</span>
              <span class="sub-text"
                >Show your Uploaded Videos in the sidebar</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableUploadedVideos}
              onchange={(val) => {
                settings!.enableUploadedVideos = val;
                save("enableUploadedVideos", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Subscriptions</span>
              <span class="sub-text"
                >Show your Channel Subscriptions in the sidebar</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableSubscriptions}
              onchange={(val) => {
                settings!.enableSubscriptions = val;
                save("enableSubscriptions", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Recent Activities</span>
              <span class="sub-text"
                >Show your recent YouTube activities in the sidebar</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableActivities}
              onchange={(val) => {
                settings!.enableActivities = val;
                save("enableActivities", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Comments</span>
              <span class="sub-text"
                >Show your recent comments in the sidebar</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableComments}
              onchange={(val) => {
                settings!.enableComments = val;
                save("enableComments", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Search</span>
              <span class="sub-text"
                >Search for YouTube videos directly from the sidebar</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableSearch}
              onchange={(val) => {
                settings!.enableSearch = val;
                save("enableSearch", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable My Account Playlists</span>
              <span class="sub-text"
                >Show a dedicated button for your YouTube account playlists</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableAccountPlaylists}
              onchange={(val) => {
                settings!.enableAccountPlaylists = val;
                save("enableAccountPlaylists", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Watch Later</span>
              <span class="sub-text"
                >Show a direct button for the system Watch Later playlist</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableWatchLater}
              onchange={(val) => {
                settings!.enableWatchLater = val;
                save("enableWatchLater", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable Open by ID</span>
              <span class="sub-text"
                >Quickly open any YouTube playlist by its ID or URL</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableOpenById}
              onchange={(val) => {
                settings!.enableOpenById = val;
                save("enableOpenById", val);
              }}
            />
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span>Enable My Channel</span>
              <span class="sub-text"
                >Show your YouTube channel information and stats</span
              >
            </div>
            <ToggleSwitch
              checked={settings?.enableMyChannel}
              onchange={(val) => {
                settings!.enableMyChannel = val;
                save("enableMyChannel", val);
              }}
            />
          </div>
        </section>

        <!-- Advanced & Cache -->
        <section class="card">
          <h3><Fa icon={faMicrochip} /> Advanced & Cache</h3>
          <div class="field">
            <label for="defaultPrivacy">Default YouTube Privacy</label>
            <p class="sub-text">Privacy setting for newly synced playlists</p>
            <select
              id="defaultPrivacy"
              bind:value={settings.defaultPrivacy}
              onchange={() => save("defaultPrivacy", settings?.defaultPrivacy)}
            >
              <option value="private">Private (Only you)</option>
              <option value="unlisted">Unlisted (Anyone with link)</option>
              <option value="public">Public (Everyone)</option>
            </select>
          </div>

          <div class="field checkbox-field">
            <div class="checkbox-label">
              <label for="autoRetryEnabled">Auto-retry sync after quota reset</label>
              <p class="sub-text">
                Automatically resume playlist sync 24 hours after hitting API quota limit.
                Disable if you prefer to manually click Sync to resume.
              </p>
            </div>
            <ToggleSwitch
              checked={settings?.autoRetryEnabled}
              onchange={(val) => {
                settings!.autoRetryEnabled = val;
                save("autoRetryEnabled", val);
              }}
            />
          </div>

          <div class="field">
            <label for="cacheDuration">Cache duration</label>
            <p class="sub-text">
              How long playlist data is cached before refreshing.
            </p>
            <select
              id="cacheDuration"
              bind:value={settings.cacheDuration}
              onchange={() => {
                if (settings) {
                  save("cacheDuration", settings?.cacheDuration, () => {
                    window.invalidateCacheAndNotify();
                  });
                }
              }}
            >
              {#each CACHE_DURATIONS as duration}
                <option value={duration.value}>{duration.label}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for="maxLogLines">Max log lines stored</label>
            <input
              aria-label="Max log lines stored"
              id="maxLogLines"
              type="number"
              min="10"
              max="10000"
              bind:value={settings.maxLogLines}
              onchange={() =>
                settings && save("maxLogLines", Number(settings?.maxLogLines))}
            />
          </div>
        </section>
      </div>
    {:else}
      <div class="loading-state">
        <p>Loading settings…</p>
      </div>
    {/if}

    <input
      aria-label="Import history JSON file"
      id="HistoryImportInput"
      type="file"
      accept=".json"
      style="display:none"
    />

    {#if showNamePrompt}
      <div
        class="modal-overlay"
        onmousedown={(e) => {
          if (e.target === e.currentTarget) showNamePrompt = false;
        }}
        role="presentation"
      >
        <div
          class="modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <h3 id="modal-title">Enter Playlist Name</h3>
          <div class="field" style="margin: 20px 0;">
            <input
              aria-label="New playlist name"
              type="text"
              bind:value={newPlaylistName}
              placeholder="e.g. My Favorites"
              use:focusEl
            />
          </div>
          <div class="actions">
            <SimpleButton secondary onclick={() => (showNamePrompt = false)}
              >Cancel</SimpleButton
            >
            <SimpleButton
              primary
              onclick={confirmCreatePlaylist}
              disabled={!newPlaylistName.trim()}>Confirm</SimpleButton
            >
          </div>
        </div>
      </div>
    {/if}

    {#if showYtNativeInfo}
      <div
        class="modal-overlay"
        onmousedown={(e) => {
          if (e.target === e.currentTarget) showYtNativeInfo = false;
        }}
        role="presentation"
      >
        <div
          class="modal-content info-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yt-native-title"
        >
          <h3 id="yt-native-title">
            <Fa icon={faInfoCircle} /> YouTube Native Info
          </h3>
          <p class="modal-body">
            "YouTube Native" uses your account's official <strong
              >Watch Later</strong
            > playlist directly. This requires you to be signed in and cannot be
            managed by the extension.
          </p>
          <div class="actions">
            <SimpleButton
              secondary
              onclick={() => {
                showYtNativeInfo = false;
                selectedFavoriteId = settings?.watchLaterPlaylistId ?? null;
              }}>Cancel</SimpleButton
            >
            <SimpleButton
              primary
              onclick={async () => {
                showYtNativeInfo = false;
                try {
                  await window.signIn();
                  await checkSignIn();
                  if (await window.isSignedIn()) {
                    await saveFavorite(null);
                  }
                } catch (e) {
                  const errMsg = e instanceof Error ? e.message : String(e);
                  const code = (e as any)?.code;
                  if (code === "credentials_missing") {
                    if (window.info) window.info("Please fill in your API credentials first.");
                    push("/api-setup");
                  } else {
                    console.error("Sign in failed", e);
                    if (window.logSystemEvent)
                      await window.logSystemEvent(
                        "ERROR",
                        `[SETTINGS] Modal sign-in failed: ${errMsg}`,
                      );
                    if (window.error) window.error("Sign-in failed. Please try again.");
                  }
                }
              }}>Sign In</SimpleButton
            >
          </div>
        </div>
      </div>
    {/if}

    {#if showPlayAllInfo}
      <div
        class="modal-overlay"
        onmousedown={(e) => {
          if (e.target === e.currentTarget) showPlayAllInfo = false;
        }}
        role="presentation"
      >
        <div
          class="modal-content info-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="play-all-title"
        >
          <div class="modal-header">
            <h3 id="play-all-title">
              <Fa icon={faPlayCircle} /> Play All Video Limits
            </h3>
            <button
              class="close-btn"
              onclick={() => (showPlayAllInfo = false)}
              aria-label="Close dialog"
              title="Close (Esc)"
            >
              ×
            </button>
          </div>

          <div class="modal-body-content">
            <div class="info-section signed-in">
              <div class="section-header">
                <span class="section-badge">Signed In</span>
              </div>
              <p class="section-text">
                No video limit per tab. All videos can load in a single tab,
                giving you the best playback experience.
              </p>
            </div>

            <div class="info-section guest">
              <div class="section-header">
                <span class="section-badge guest-badge">Guest User</span>
              </div>
              <p class="section-text">
                YouTube enforces a limit of approximately <strong
                  >50 videos per tab</strong
                > regardless of your extension settings?. This is a YouTube server-side
                restriction and cannot be bypassed.
              </p>
            </div>

            <div class="info-note">
              <Fa icon={faInfoCircle} />
              <p>
                These limits apply when using the "Play All" feature to open
                your playlist on YouTube.
              </p>
            </div>
          </div>

          <div class="modal-footer">
            <SimpleButton primary onclick={() => (showPlayAllInfo = false)}>
              Got it
            </SimpleButton>
          </div>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .status-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(234, 179, 8, 0.08);
    border: 1px solid rgba(234, 179, 8, 0.2);
    border-radius: 12px;
    color: #b45309;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .status-warning :global(svg) {
    color: #d97706;
    font-size: 14px;
  }

  :global(.btn-full-width) {
    width: 100% !important;
    height: 42px !important;
    border-radius: 10px !important;
    margin-top: 4px !important;
  }

  .info-modal h3 {
    color: var(--primary-color) !important;
    margin-bottom: 16px !important;
    font-size: 20px !important;
  }

  .modal-body {
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-color);
    margin: 0;
    opacity: 0.9;
  }

  .modal-body strong {
    color: var(--primary-color);
    font-weight: 700;
  }

  .settings-grid {
    display: block;
    column-width: 400px;
    column-gap: 24px;
    width: 100%;
  }

  @media (max-width: 500px) {
    .settings-grid {
      column-count: 1;
    }
  }

  .card {
    display: inline-flex; /* inline for columns, flex for internal layout */
    flex-direction: column;
    width: 100%;
    break-inside: avoid;
    margin-bottom: 24px;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 32px;
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
    gap: 24px;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .card:hover {
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h3 :global(svg) {
    color: var(--primary-color);
    font-size: 16px;
    opacity: 0.8;
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toggle-info span:first-child {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }

  .sub-text {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0;
    opacity: 0.8;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }

  select,
  input[type="number"] {
    height: 42px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    color: var(--text-color);
    font-size: 14px;
    width: 100%;
    outline: none;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  select:hover,
  input[type="number"]:hover {
    background-color: var(--hover-color);
    border-color: var(--primary-color);
  }

  select:focus,
  input[type="number"]:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(62, 166, 255, 0.1);
  }

  /* Number Input Group */
  .number-input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .number-input-group input[type="number"] {
    font-size: 16px;
    font-weight: 500;
  }

  .number-input-group input[type="number"]::-webkit-outer-spin-button,
  .number-input-group input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: outer-spin-button;
    appearance: auto;
    cursor: pointer;
    opacity: 0.7;
  }


  .info-card {
    background: linear-gradient(
      to bottom right,
      rgba(6, 95, 212, 0.03),
      transparent
    );
    border-left: 4px solid var(--primary-color);
  }

  .info-header {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--primary-color);
  }

  .info-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }

  .info-content {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    color: var(--text-color);
  }

  .loading-state {
    display: flex;
    justify-content: center;
    padding: 80px;
    color: var(--text-muted);
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    padding: 20px;
  }
  .modal-content {
    background: var(--background-color);
    padding: 32px;
    border-radius: 20px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-color);
    animation: modal-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes modal-appear {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 32px;
  }
  .favorite-action-container {
    margin-top: 12px;
  }

  /* Label with Info Button */
  .label-with-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .label-with-info label {
    margin: 0;
  }

  .info-icon-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 16px;
    transition: all 0.2s ease;
    outline: none;
    touch-action: manipulation;
  }

  .info-icon-btn:hover {
    color: var(--primary-color);
    background-color: rgba(62, 166, 255, 0.08);
  }

  .info-icon-btn:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .info-icon-btn:active {
    transform: scale(0.95);
  }

  /* Enhanced Modal Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 24px;
  }

  .modal-header h3 {
    margin: 0;
    flex: 1;
    color: var(--primary-color) !important;
    font-size: 20px !important;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .modal-header h3 :global(svg) {
    font-size: 20px;
    color: var(--primary-color);
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 28px;
    color: var(--text-muted);
    padding: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s ease;
    flex-shrink: 0;
    touch-action: manipulation;
  }

  .close-btn:hover {
    color: var(--text-color);
    background-color: var(--bg-secondary);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  /* Modal Body Content */
  .modal-body-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 24px;
  }

  .info-section {
    padding: 16px;
    background-color: var(--bg-secondary);
    border-radius: 12px;
    border-left: 4px solid var(--primary-color);
    transition: all 0.2s ease;
  }

  .info-section:hover {
    background-color: var(--hover-color);
  }

  .info-section.guest {
    border-left-color: #f87171;
  }

  .section-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    gap: 8px;
  }

  .section-badge {
    display: inline-block;
    padding: 4px 12px;
    background: var(--primary-color);
    color: white;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }

  .section-badge.guest-badge {
    background-color: #f87171;
  }

  .section-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-color);
  }

  .section-text strong {
    color: var(--primary-color);
    font-weight: 600;
  }

  .info-section.guest .section-text strong {
    color: #e74c3c;
    font-weight: 700;
  }

  .info-note {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(62, 166, 255, 0.05);
    border-radius: 12px;
    color: var(--text-muted);
    font-size: 13px;
    align-items: flex-start;
  }

  .info-note :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--primary-color);
    font-size: 14px;
  }

  .info-note p {
    margin: 0;
    line-height: 1.5;
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  /* New History Section Styles */
  .indent-row {
    margin-left: 20px;
    border-left: 2px solid var(--border-color);
    padding-left: 16px;
  }

  .data-management-section {
    margin-top: 16px;
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }

  .button-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  :global(.button-group .btn) {
    flex: 1;
    min-width: 100px;
    justify-content: center;
  }
</style>
