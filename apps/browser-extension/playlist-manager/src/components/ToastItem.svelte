<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faCheckCircle,
    faExclamationCircle,
    faInfoCircle,
    faTriangleExclamation,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import type { ToastMessage } from "../stores/toast";

  interface Props {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
  }

  let { toast, onDismiss }: Props = $props();

  const icon = $derived(
    toast.type === "success"
      ? faCheckCircle
      : toast.type === "error"
        ? faExclamationCircle
        : toast.type === "warning"
          ? faTriangleExclamation
          : faInfoCircle
  );

  function handleAction() {
    toast.action?.onClick();
    onDismiss(toast.id);
  }
</script>

<div class="toast toast--{toast.type}" role="alert" aria-live="assertive">
  <div class="toast-icon">
    <Fa {icon} />
  </div>
  <div class="toast-body">
    <div class="toast-message">
      <span>{toast.message}</span>
      {#if (toast.count ?? 0) > 1}
        <span class="toast-count" aria-label={`${toast.count} occurrences`}>(×{toast.count})</span>
      {/if}
    </div>
    {#if toast.action}
      <button class="toast-action" onclick={handleAction}>{toast.action.label}</button>
    {/if}
  </div>
  {#if toast.dismissible}
    <button class="toast-close" onclick={() => onDismiss(toast.id)} aria-label="Close notification">
      <Fa icon={faXmark} />
    </button>
  {/if}
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--background-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border-color);
    border-left-width: 4px;
    color: var(--text-color);
    min-width: 260px;
    max-width: min(380px, calc(100vw - 32px));
  }

  :global([data-theme="dark"]) .toast {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    background: #282828;
  }

  .toast--success {
    border-left-color: #4caf50;
  }
  .toast--error {
    border-left-color: #f44336;
  }
  .toast--warning {
    border-left-color: #ff9800;
  }
  .toast--info {
    border-left-color: #2196f3;
  }

  .toast--success .toast-icon {
    color: #4caf50;
  }
  .toast--error .toast-icon {
    color: #f44336;
  }
  .toast--warning .toast-icon {
    color: #ff9800;
  }
  .toast--info .toast-icon {
    color: #2196f3;
  }

  .toast-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .toast-body {
    flex: 1;
    min-width: 0;
  }

  .toast-message {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
  }

  .toast-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .toast-action {
    margin-top: 6px;
    background: none;
    border: none;
    padding: 0;
    color: var(--primary-color, #007bff);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }

  .toast-action:hover {
    opacity: 0.85;
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
    flex-shrink: 0;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  .toast-close:hover {
    background-color: var(--hover-color);
    color: var(--text-color);
  }
</style>
