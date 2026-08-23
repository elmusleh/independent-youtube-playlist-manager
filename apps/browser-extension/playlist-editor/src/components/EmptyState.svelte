<script lang="ts">
  import Fa from "svelte-fa";
  import SimpleButton from "./SimpleButton.svelte";

  let {
    icon,
    title,
    message,
    actionLabel = undefined,
    actionHref = undefined,
    actionOnClick = undefined,
  }: {
    icon: any;
    title: string;
    message: string;
    actionLabel?: string;
    actionHref?: string;
    actionOnClick?: () => void;
  } = $props();
</script>

<div class="empty-state">
  <div class="icon-wrapper">
    <Fa {icon} size="4x" />
  </div>
  <h2>{title}</h2>
  <p>{message}</p>
  {#if actionLabel && (actionHref || actionOnClick)}
    <div class="action">
      {#if actionHref}
        <a href={actionHref} class="btn primary">
          {actionLabel}
        </a>
      {:else if actionOnClick}
        <button class="btn primary" onclick={actionOnClick}>
          {actionLabel}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    text-align: center;
    gap: 16px;
    background: var(--hover-color);
    border-radius: 16px;
    border: 2px dashed var(--border-color);
  }

  :global([data-theme="dark"]) .empty-state {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .icon-wrapper {
    color: var(--text-muted);
    opacity: 0.6;
  }

  h2 {
    margin: 0;
    font-size: 20px;
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

  .action {
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
    transition: background 0.15s, filter 0.15s;
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
</style>
