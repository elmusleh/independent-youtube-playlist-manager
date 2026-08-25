<script lang="ts">
  import { toast } from "../stores/toast";
  import { fade, fly } from "svelte/transition";
  import {
    faCheckCircle,
    faExclamationCircle,
    faInfoCircle,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";

  let icon = $derived(
    $toast.type === "success"
      ? faCheckCircle
      : $toast.type === "error"
        ? faExclamationCircle
        : faInfoCircle
  );
</script>

{#if $toast.visible}
  <div class="toast-container" transition:fly={{ y: 50, duration: 300 }}>
    <div class="toast {$toast.type}" role="alert" aria-live="assertive">
      <div class="toast-icon">
        <Fa {icon} />
      </div>
      <div class="toast-message">
        {$toast.message}
      </div>
      <button class="toast-close" onclick={() => toast.hide()} aria-label="Close notification">
        <Fa icon={faXmark} />
      </button>
    </div>
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--background-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    min-width: 280px;
    max-width: 90vw;
    pointer-events: auto;
  }

  :global([data-theme="dark"]) .toast {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    background: #282828;
  }

  .toast.success .toast-icon {
    color: #4caf50;
  }
  .toast.error .toast-icon {
    color: #f44336;
  }
  .toast.info .toast-icon {
    color: #2196f3;
  }

  .toast-message {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
  }

  .toast-close {
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
  }

  .toast-close:hover {
    background-color: var(--hover-color);
    color: var(--text-color);
  }
</style>
