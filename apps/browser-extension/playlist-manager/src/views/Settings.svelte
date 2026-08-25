<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Settings } from "../types/model.js";
  import { faGear } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import { saveSetting } from "../services/settings-utils.js";
  import { logger } from "../services/logger";

  // Card components
  import PlaybackSettings from "../components/PlaybackSettings.svelte";
  import HistorySettings from "../components/HistorySettings.svelte";
  import FavoriteSettings from "../components/FavoriteSettings.svelte";
  import EditorSettings from "../components/EditorSettings.svelte";
  import MetadataSettings from "../components/MetadataSettings.svelte";
  import IntegrationSettings from "../components/IntegrationSettings.svelte";
  import StorageSettings from "../components/StorageSettings.svelte";
  import BackupSettings from "../components/BackupSettings.svelte";
  import YouTubeAdvancedSettings from "../components/YouTubeAdvancedSettings.svelte";

  const browser = (window as any).browser || (window as any).chrome;

  let settings: Settings | null = $state(null);
  const status = new StatusManager();
  let signedIn = $state(false);
  let showPlayAllInfo = $state(false);

  // ─── Initialization ──────────────────────────────────────────────────────

  async function refresh() {
    await status.refresh(async () => {
      const s = await window.getSettings();
      settings = s;
    });
  }

  window
    .getSettings()
    .then((s) => {
      settings = s;
      status.lastUpdated = Date.now();
    })
    .catch(async (e) => {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error("[SETTINGS] Failed to load settings:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[SETTINGS] Failed to load settings: ${errMsg}`);
    });

  // ─── Auth ────────────────────────────────────────────────────────────────

  async function checkSignIn() {
    try {
      signedIn = await window.isSignedIn();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error("[SETTINGS] checkSignIn failed:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[SETTINGS] checkSignIn failed: ${errMsg}`);
    }
  }
  checkSignIn();

  const handleAuthChange = (e: any) => {
    signedIn = e.detail.isSignedIn;
  };

  window.addEventListener("yt-auth-changed", handleAuthChange);

  // ─── Runtime messages ────────────────────────────────────────────────────

  function handleRuntimeMessage(msg: any) {
    if (msg?.cmd === "update-saved-playlists") {
      // Playlist list refreshed by child components
    }
  }

  browser.runtime.onMessage.addListener(handleRuntimeMessage);
  onDestroy(() => {
    browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    window.removeEventListener("yt-auth-changed", handleAuthChange);
  });

  // ─── Save wrapper ────────────────────────────────────────────────────────

  async function save(key: keyof Settings, value: unknown, onDone?: () => void) {
    await saveSetting(key, value, status, onDone);
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
        <PlaybackSettings
          {settings}
          {save}
          {showPlayAllInfo}
          setShowPlayAllInfo={(v) => (showPlayAllInfo = v)}
        />
        <HistorySettings {settings} {save} {status} />
        <FavoriteSettings {settings} {save} {status} {signedIn} />
        <EditorSettings {settings} {save} />
        <MetadataSettings {settings} {save} />
        <IntegrationSettings {settings} {save} />
        <StorageSettings />
        <BackupSettings />
        <YouTubeAdvancedSettings {settings} {save} />
      </div>
    {:else}
      <div class="loading-state">
        <p>Loading settings…</p>
      </div>
    {/if}
  </div>
</main>

<style>
  @import "./settings.css";
</style>
