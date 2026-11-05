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
    formatWhen: (ts: number | null) => string;
  } = $props();
</script>

<!-- What to Sync with Per-Category Status -->
<section class="card">
  <h3><Fa icon={faDatabase} /> Sync status</h3>
  <p class="sub-text">All categories sync automatically. Each shows its own last sync time.</p>

  <div class="sync-category enabled">
    <div class="category-header">
      <div class="category-info">
        <Fa icon={faDatabase} class="cat-icon" />
        <div>
          <span class="category-name">Playlists</span>
          <span class="sub-text">Your saved and local playlists</span>
        </div>
      </div>
      <div class="category-status">
        {#if categoryTimestamps.playlists}
          <span class="synced-at"
            ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.playlists)}</span
          >
        {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
          <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
        {:else}
          <span class="never-synced">Never synced</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="sync-category enabled">
    <div class="category-header">
      <div class="category-info">
        <Fa icon={faCog} class="cat-icon" />
        <div>
          <span class="category-name">Settings</span>
          <span class="sub-text">Preferences, theme, layout, etc.</span>
        </div>
      </div>
      <div class="category-status">
        {#if categoryTimestamps.settings}
          <span class="synced-at"
            ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.settings)}</span
          >
        {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
          <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
        {:else}
          <span class="never-synced">Never synced</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="sync-category enabled">
    <div class="category-header">
      <div class="category-info">
        <Fa icon={faHistory} class="cat-icon" />
        <div>
          <span class="category-name">Watch History</span>
          <span class="sub-text">What you've watched on each device</span>
        </div>
      </div>
      <div class="category-status">
        {#if categoryTimestamps.history}
          <span class="synced-at"
            ><Fa icon={faClock} /> {formatWhen(categoryTimestamps.history)}</span
          >
        {:else if isSyncing && (syncStage === "pulling" || syncStage === "pushing")}
          <span class="syncing-now"><Fa icon={faSpinner} class="spin" /> Syncing…</span>
        {:else}
          <span class="never-synced">Never synced</span>
        {/if}
      </div>
    </div>
  </div>
</section>

<style>
  .sync-category {
    padding: 0.5rem 0;
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
  .category-info > div {
    display: flex;
    flex-direction: column;
    gap: 0;
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
  .category-name {
    font-weight: 500;
    color: var(--foreground, #111);
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
