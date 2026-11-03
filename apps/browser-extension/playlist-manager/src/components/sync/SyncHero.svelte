<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faArrowsRotate,
    faCheck,
    faCircleCheck,
    faCircleExclamation,
    faSpinner,
    faLink,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";

  let {
    syncIsOn,
    isSyncing,
    knownDevices,
    setupHint,
    syncStage,
    syncStageDetail,
    syncProgress,
    lastError,
    lastSyncSummary,
    getStageLabel,
    onSyncNow,
  }: {
    syncIsOn: boolean;
    isSyncing: boolean;
    knownDevices: number;
    setupHint: string | null;
    syncStage: string;
    syncStageDetail: string;
    syncProgress: number;
    lastError: string | null;
    lastSyncSummary: string | null;
    getStageLabel: (stage: string) => string;
    onSyncNow: () => void;
  } = $props();
</script>

<!-- Main Status Banner -->
<section class="sync-status-banner" class:active={syncIsOn} class:syncing={isSyncing}>
  <div class="banner-main">
    <div class="status-icon-wrapper" class:syncing={isSyncing}>
      <Fa
        icon={isSyncing ? faSpinner : syncIsOn ? faCircleCheck : faCircleExclamation}
        class="status-icon"
      />
    </div>
    <div class="status-content">
      <h3>
        {#if syncIsOn}
          <span class="device-count">
            <Fa icon={faLink} /> Sync active across {knownDevices > 0 ? knownDevices : 1} device{knownDevices >
            1
              ? "s"
              : ""}
          </span>
          {#if isSyncing}
            <span class="syncing-badge">Syncing…</span>
          {/if}
        {:else}
          Sync not set up
        {/if}
      </h3>
      <p class="status-message">
        {#if setupHint}
          {setupHint}
        {:else if isSyncing}
          {syncStageDetail || getStageLabel(syncStage)}
        {:else if lastError}
          <span class="error-text"><Fa icon={faCircleExclamation} /> {lastError}</span>
        {:else if lastSyncSummary}
          <Fa icon={faCircleCheck} /> {lastSyncSummary}
        {:else}
          Ready to sync. Click "Sync now" to begin.
        {/if}
      </p>
      {#if isSyncing && syncProgress > 0 && syncProgress < 100}
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: {syncProgress}%"></div>
          <span class="progress-text">{syncProgress}%</span>
        </div>
      {/if}
    </div>
  </div>
  <div class="banner-actions">
    <SimpleButton
      secondary
      onclick={onSyncNow}
      disabled={isSyncing || !syncIsOn}
      className="sync-now-btn"
    >
      <span class:spin={isSyncing}><Fa icon={isSyncing ? faSpinner : faArrowsRotate} /></span>
      {isSyncing ? "Syncing…" : "Sync now"}
    </SimpleButton>
  </div>
</section>

<style>
  .sync-status-banner {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    background: var(--card, #fff);
    border: 1px solid var(--border, #e0e0e0);
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .sync-status-banner.active {
    border-color: var(--accent, #3b82f6);
    box-shadow: 0 0 0 1px var(--accent, #3b82f6);
  }
  .sync-status-banner.syncing {
    border-color: var(--accent, #3b82f6);
    animation: pulse-border 2s ease-in-out infinite;
  }
  @keyframes pulse-border {
    0%,
    100% {
      box-shadow: 0 0 0 1px var(--accent, #3b82f6);
    }
    50% {
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
    }
  }
  .banner-main {
    flex: 1 1 280px;
    min-width: 0;
  }
  .status-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--muted, #f3f4f6);
  }
  .status-icon-wrapper.syncing :global(.status-icon) {
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
  :global(.status-icon) {
    font-size: 1.25rem;
    color: var(--muted-foreground, #6b7280);
  }
  .sync-status-banner.active :global(.status-icon) {
    color: var(--success, #10b981);
  }
  .sync-status-banner.syncing :global(.status-icon) {
    color: var(--accent, #3b82f6);
  }
  .status-content h3 {
    margin: 0 0 0.35rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground, #111);
  }
  .device-count {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .syncing-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: 0.5rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--accent, #3b82f6);
    background: rgba(59, 130, 246, 0.1);
    border-radius: 999px;
  }
  .syncing-badge :global(.fa-spinner) {
    animation: spin 1s linear infinite;
  }
  .status-message {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted-foreground, #6b7280);
    line-height: 1.5;
  }
  .status-message .error-text {
    color: var(--danger, #ef4444);
    font-weight: 500;
  }
  .progress-bar-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    height: 6px;
    background: var(--muted, #f3f4f6);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-bar {
    height: 100%;
    background: var(--accent, #3b82f6);
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .progress-text {
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted-foreground, #6b7280);
    min-width: 3ch;
  }
  .banner-actions {
    flex-shrink: 0;
  }
  :global(.sync-now-btn) {
    min-width: 0;
  }
  :global(.fa-spinner.spin) {
    animation: spin 1s linear infinite;
  }
</style>
