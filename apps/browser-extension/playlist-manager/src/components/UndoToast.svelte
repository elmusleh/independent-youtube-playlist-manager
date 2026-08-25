<script lang="ts">
  import { onDestroy } from "svelte";
  import { fly } from "svelte/transition";
  import { faUndo, faXmark, faTrash } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";

  let {
    count = 0,
    onUndo,
    onExpire,
  }: {
    count: number;
    onUndo: () => void;
    onExpire: () => void;
  } = $props();

  /** Undo window duration in milliseconds. */
  const DURATION_MS = 6000;
  const TICK_MS = 100;

  let progress = $state(100); // percent remaining, 100 → 0
  let remainingMs = DURATION_MS;
  let visible = $state(true);
  let hasExpired = false;

  const ticker = setInterval(() => {
    remainingMs -= TICK_MS;
    progress = Math.max(0, Math.round((remainingMs / DURATION_MS) * 100));
    if (remainingMs <= 0) {
      expire();
    }
  }, TICK_MS);

  function expire() {
    if (hasExpired) return;
    hasExpired = true;
    visible = false;
    clearInterval(ticker);
    onExpire();
  }

  function handleUndo() {
    if (hasExpired) return;
    hasExpired = true;
    visible = false;
    clearInterval(ticker);
    onUndo();
  }

  onDestroy(() => {
    clearInterval(ticker);
  });
</script>

{#if visible}
  <div class="undo-toast-container" transition:fly={{ y: 50, duration: 300 }}>
    <div class="undo-toast" role="alert" aria-live="polite">
      <div class="undo-toast-icon">
        <Fa icon={faTrash} />
      </div>
      <div class="undo-toast-message">
        <span class="undo-toast-text">{count} video(s) removed</span>
        <span class="undo-toast-hint">Undo available for 6 seconds</span>
      </div>
      <button
        class="undo-action"
        onclick={handleUndo}
        aria-label="Undo deletion"
        title="Undo deletion"
      >
        <Fa icon={faUndo} />
        <span>Undo</span>
      </button>
      <button
        class="undo-close"
        onclick={expire}
        aria-label="Dismiss"
        title="Dismiss (keep deletion)"
      >
        <Fa icon={faXmark} />
      </button>
      <div class="undo-progress-bar" aria-hidden="true">
        <div class="undo-progress-fill" style="width: {progress}%"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .undo-toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    pointer-events: none;
  }

  .undo-toast {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--background-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    min-width: 320px;
    max-width: 90vw;
    pointer-events: auto;
    overflow: hidden;
  }

  :global([data-theme="dark"]) .undo-toast {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    background: #282828;
  }

  .undo-toast-icon {
    color: #f44336;
    display: flex;
    align-items: center;
  }

  .undo-toast-message {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .undo-toast-text {
    font-size: 14px;
    font-weight: 600;
  }

  .undo-toast-hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .undo-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--primary-color);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    transition:
      background-color 0.2s,
      color 0.2s;
    flex-shrink: 0;
  }

  .undo-action:hover {
    background-color: var(--hover-color);
    text-decoration: underline;
  }

  .undo-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition:
      background-color 0.2s,
      color 0.2s;
    flex-shrink: 0;
  }

  .undo-close:hover {
    background-color: var(--hover-color);
    color: var(--text-color);
  }

  .undo-progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--border-color);
  }

  .undo-progress-fill {
    height: 100%;
    background: var(--primary-color);
    transition: width 0.1s linear;
  }
</style>
