<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faDatabase,
    faCog,
    faHistory,
    faClock,
    faSpinner,
  } from "@fortawesome/free-solid-svg-icons";
  import type { SyncConfig } from "../../services/sync/sync-config.js";

  let {
    config,
    categoryTimestamps,
    isSyncing,
    syncStage,
    onToggleContent,
    formatWhen,
  }: {
    config: SyncConfig;
    categoryTimestamps: {
      playlists: number | null;
      settings: number | null;
      history: number | null;
    };
    isSyncing: boolean;
    syncStage: string;
    onToggleContent: (key: "playlists" | "settings" | "history") => void;
    formatWhen: (ts: number | null) => string;
  } = $props();
</script>

<!-- What to Sync with Per-Category Status -->
<section class="card">
  <h3><Fa icon={faDatabase} /> What to Sync</h3>
  <p class="sub-text">
    Choose which data categories travel between devices. Each shows its own last sync time.
  </p>

  <div class="sync-category" class:enabled={config.content.playlists}>
    <div class="category-header">
      <div class="category-info">
        <Fa icon={faDatabase} class="cat-icon" />
        <div>
          <label>
            <input
              type="checkbox"
              checked={config.content.playlists}
              onchange={() => onToggleContent("playlists")}
            />
            <span>Playlists</span>
          </label>
          <span class="sub-text">Your saved and local playlists</span>
        </div>
      </div>
      <div class="category-status">
        {#if config.content.playlists}
          {#if categoryTimestamps.playlists}
            <span class="synced-at"
              ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.playlists)}</span
            >
          {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
            <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
          {:else}
            <span class="never-synced">Never synced</span>
          {/if}
        {:else}
          <span class="disabled">Disabled</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="sync-category" class:enabled={config.content.settings}>
    <div class="category-header">
      <div class="category-info">
        <Fa icon={faCog} class="cat-icon" />
        <div>
          <label>
            <input
              type="checkbox"
              checked={config.content.settings}
              onchange={() => onToggleContent("settings")}
            />
            <span>Settings</span>
          </label>
          <span class="sub-text">Preferences, theme, layout, etc.</span>
        </div>
      </div>
      <div class="category-status">
        {#if config.content.settings}
          {#if categoryTimestamps.settings}
            <span class="synced-at"
              ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.settings)}</span
            >
          {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
            <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
          {:else}
            <span class="never-synced">Never synced</span>
          {/if}
        {:else}
          <span class="disabled">Disabled</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="sync-category" class:enabled={config.content.history}>
    <div class="category-header">
      <div class="category-info">
        <Fa icon={faHistory} class="cat-icon" />
        <div>
          <label>
            <input
              type="checkbox"
              checked={config.content.history}
              onchange={() => onToggleContent("history")}
            />
            <span>Watch History</span>
          </label>
          <span class="sub-text">What you've watched on each device</span>
        </div>
      </div>
      <div class="category-status">
        {#if config.content.history}
          {#if categoryTimestamps.history}
            <span class="synced-at"
              ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.history)}</span
            >
          {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
            <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
          {:else}
            <span class="never-synced">Never synced</span>
          {/if}
        {:else}
          <span class="disabled">Disabled</span>
        {/if}
      </div>
    </div>
  </div>
</section>

<style>
  .sync-category {
    padding: 0.75rem 0;
    border-top: 1px solid var(--border, #e5e7eb);
  }
  .sync-category:first-child {
    border-top: none;
    padding-top: 0;
  }
  .sync-category:last-child {
    padding-bottom: 0;
  }
  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .category-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 200px;
  }
  :global(.cat-icon) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--muted, #f3f4f6);
    color: var(--accent, #3b82f6);
  }
  .category-info label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--foreground, #111);
  }
  .category-info label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--accent, #3b82f6);
  }
  .category-info .sub-text {
    margin: 0.15rem 0 0;
    font-size: 0.8rem;
    color: var(--muted-foreground, #6b7280);
  }
  .category-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .synced-at {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--success, #10b981);
    font-weight: 500;
  }
  .syncing-now {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--accent, #3b82f6);
    font-weight: 500;
  }
  .never-synced {
    color: var(--muted-foreground, #9ca3af);
  }
  .disabled {
    color: var(--muted-foreground, #9ca3af);
    font-style: italic;
  }
  :global(.fa-spinner.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
