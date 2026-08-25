<script lang="ts">
  import Fa from "svelte-fa";
  import { faArrowsRotate, faCircleExclamation, faCheck } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "./SimpleButton.svelte";
  import type { StatusManager } from "../services/status-manager.svelte";

  let {
    onclick,
    status,
    isDirty = false,
    saving = false,
    refreshing = false,
    hasSavedOnce = false,
    title = "",
  }: {
    onclick?: () => void;
    status?: StatusManager;
    isDirty?: boolean;
    saving?: boolean;
    refreshing?: boolean;
    hasSavedOnce?: boolean;
    title?: string;
  } = $props();

  const _isDirty = $derived(isDirty !== undefined ? isDirty : status ? status.isDirty : false);
  const _saving = $derived(status ? status.saving : saving);
  const _refreshing = $derived(status ? status.refreshing : refreshing);
  const _hasSavedOnce = $derived(status ? status.hasSavedOnce : hasSavedOnce);
  const _error = $derived(status?.error);

  const buttonTitle = $derived(title || (_isDirty && !_saving ? "Save & Refresh" : "Refresh"));

  const showRefreshText = $derived(onclick && !_isDirty && !_saving && !_refreshing && !_error);

  let justSaved = $state(false);
  $effect(() => {
    if (status?.lastSuccess) {
      const diff = Date.now() - status.lastSuccess;
      if (diff < 2000) {
        justSaved = true;
        const timer = setTimeout(() => {
          justSaved = false;
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  });

  // Force reactivity when isDirty prop changes
  $effect(() => {
    if (isDirty !== undefined) {
      console.log("SaveStatus: isDirty prop changed to", isDirty);
    }
  });

  const progress = $derived(status?.progress);
  const icon = $derived(_error ? faCircleExclamation : justSaved ? faCheck : faArrowsRotate);
</script>

<SimpleButton {onclick} secondary title={_error || buttonTitle}>
  <span class="refresh-icon" class:spinning={_saving || _refreshing} class:success={justSaved}>
    <Fa {icon} fw />
  </span>
  {#if _error}
    <span class="auto-save-status error" title={_error}>Error</span>
  {:else if _saving}
    <span class="auto-save-status saving">
      {progress !== null ? `Saving (${progress}%)…` : "Saving…"}
    </span>
  {:else if _refreshing}
    <span class="auto-save-status saving">Refreshing…</span>
  {:else if justSaved}
    <span class="auto-save-status saved success-pulse">Saved</span>
  {:else if _isDirty}
    <span class="auto-save-status unsaved">Unsaved</span>
  {:else if _hasSavedOnce && !showRefreshText}
    <span class="auto-save-status saved">Saved</span>
  {:else if showRefreshText}
    <span class="auto-save-status refresh">Refresh</span>
  {/if}
</SimpleButton>

<style>
  .auto-save-status {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    margin-left: 4px;
  }

  .auto-save-status.saved {
    color: var(--success-color, #22c55e);
  }

  .auto-save-status.unsaved {
    color: var(--warning-color, #f59e0b);
  }

  .auto-save-status.saving {
    color: var(--text-muted);
    font-style: italic;
  }

  .auto-save-status.error {
    color: var(--danger-color, #ef4444);
  }

  .auto-save-status.refresh {
    color: var(--text-color);
    opacity: 0.8;
  }

  .refresh-icon {
    display: inline-flex;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .refresh-icon.spinning :global(svg) {
    animation: spin 0.8s linear infinite;
  }

  .refresh-icon.success {
    color: var(--success-color, #22c55e);
    transform: scale(1.2);
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }

  .success-pulse {
    animation: pulse 0.5s ease-in-out;
  }
</style>
