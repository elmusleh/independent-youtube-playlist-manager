<script lang="ts">
  import Fa from "svelte-fa";
  import { faTriangleExclamation, faRotate, faGear } from "@fortawesome/free-solid-svg-icons";

  let {
    icon = faTriangleExclamation,
    title = "Something Went Wrong",
    message = "An error occurred while loading. Please try again.",
    onRetry = undefined,
    showSettings = false,
  }: {
    icon?: any;
    title?: string;
    message?: string;
    onRetry?: () => void;
    showSettings?: boolean;
  } = $props();
</script>

<div class="error-state">
  <div class="icon-wrapper">
    <Fa {icon} size="3x" />
  </div>
  <h2>{title}</h2>
  <p>{message}</p>
  <div class="actions">
    {#if onRetry}
      <button class="btn secondary" onclick={onRetry}>
        <Fa icon={faRotate} fw />
        Try Again
      </button>
    {/if}
    {#if showSettings}
      <a href="#/settings" class="btn primary">
        <Fa icon={faGear} fw />
        Settings
      </a>
    {/if}
  </div>
</div>

<style>
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    gap: 12px;
    background: rgba(239, 68, 68, 0.05);
    border-radius: 16px;
    border: 2px dashed #ef4444;
  }

  :global([data-theme="dark"]) .error-state {
    background-color: rgba(239, 68, 68, 0.1);
  }

  .icon-wrapper {
    color: #ef4444;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-color);
  }

  p {
    margin: 0;
    font-size: 14px;
    color: var(--text-muted);
    max-width: 400px;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 8px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition:
      background 0.15s,
      filter 0.15s;
    border: none;
    cursor: pointer;
  }

  .btn.primary {
    background-color: #3ea6ff;
    color: white;
  }

  .btn.primary:hover {
    filter: brightness(1.1);
  }

  .btn.secondary {
    background-color: var(--hover-color, #f2f2f2);
    color: var(--text-color);
  }

  .btn.secondary:hover {
    background-color: var(--active-bg-color-secondary, #e5e5e5);
  }

  :global([data-theme="dark"]) .btn.secondary {
    background-color: rgba(255, 255, 255, 0.1);
  }
</style>
