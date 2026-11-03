<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Settings } from "../types/model.js";
  import { faThumbTack } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import { saveSetting } from "../services/settings-utils.js";
  import { logger } from "../services/logger";
  import FavoritesManager from "../components/FavoritesManager.svelte";

  const browser = (window as any).browser || (window as any).chrome;

  let settings: Settings | null = $state(null);
  const status = new StatusManager();
  let signedIn = $state(false);

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
      logger.error("[PINNED] Failed to load settings:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[PINNED] Failed to load settings: ${errMsg}`);
    });

  async function checkSignIn() {
    try {
      signedIn = await window.isSignedIn();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error("[PINNED] checkSignIn failed:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[PINNED] checkSignIn failed: ${errMsg}`);
    }
  }
  checkSignIn();

  const handleAuthChange = (e: any) => {
    signedIn = e.detail.isSignedIn;
  };
  window.addEventListener("yt-auth-changed", handleAuthChange);

  browser.runtime.onMessage.addListener((msg: any) => {
    if (msg?.cmd === "update-saved-playlists") {
      refresh();
    }
  });

  onDestroy(() => {
    browser.runtime.onMessage.removeListener(() => {});
    window.removeEventListener("yt-auth-changed", handleAuthChange);
  });

  async function save(key: keyof Settings, value: unknown, onDone?: () => void) {
    await saveSetting(key, value, status, onDone);
  }
</script>

<main class="view-scroll-container">
  <div class="view-body">
    <StickyHeader>
      {#snippet children()}
        <ViewHeader icon={faThumbTack} title="Pinned">
          {#snippet rightActions()}
            <SaveStatus onclick={refresh} {status} />
          {/snippet}
        </ViewHeader>
      {/snippet}
    </StickyHeader>

    {#if settings}
      <FavoritesManager {settings} {save} {status} {signedIn} />
    {:else}
      <div class="loading-state">
        <p>Loading…</p>
      </div>
    {/if}
  </div>
</main>

<style>
  .loading-state {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-muted);
  }
</style>
