<script lang="ts">
  import Fa from "svelte-fa";
  import { faGlobe, faDatabase, faTrash } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "./SimpleButton.svelte";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import type { Settings } from "../types/model.js";
  import { requestConfirm } from "../stores/confirmation.js";

  let {
    settings,
    save,
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
  } = $props();

  let metadataCacheCount = $state<number>(0);

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

  loadMetadataCacheStats();
</script>

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
      bind:value={settings!.metadataExecutionStrategy}
      onchange={() => save("metadataExecutionStrategy", settings?.metadataExecutionStrategy)}
    >
      <option value="free_first">⚡ Zero-Quota / Free First (Recommended — Saves API Quota)</option>
      <option value="api_first">🔑 Official YouTube Data API First (Consumes Daily Quota)</option>
    </select>
  </div>

  <h4 style="margin: 1.2em 0 0.4em; font-size: 14px; color: var(--text-color);">
    Active Extraction Engines
  </h4>

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
      <span class="sub-text">Direct YouTube embed player response parser — zero quota fallback</span
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
        bind:value={settings!.customInvidiousInstances}
        onblur={() => save("customInvidiousInstances", settings?.customInvidiousInstances)}
        onkeydown={(e) => {
          if (e.key === "Enter")
            save("customInvidiousInstances", settings?.customInvidiousInstances);
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
        bind:value={settings!.customPipedInstances}
        onblur={() => save("customPipedInstances", settings?.customPipedInstances)}
        onkeydown={(e) => {
          if (e.key === "Enter") save("customPipedInstances", settings?.customPipedInstances);
        }}
      />
    </div>
  {/if}

  <div
    style="margin-top: 1.2em; padding-top: 1em; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;"
  >
    <div>
      <span style="font-weight: 500;"><Fa icon={faDatabase} /> Local Metadata Cache</span>
      <p class="sub-text" style="margin: 2px 0 0;">
        {metadataCacheCount}
        {metadataCacheCount === 1 ? "video" : "videos"} stored in IndexedDB (24h TTL)
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
