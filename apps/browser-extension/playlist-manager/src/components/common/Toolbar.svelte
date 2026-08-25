<script lang="ts">
  import Fa from "svelte-fa";
  import { faRotateRight, faSpinner } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";

  let {
    title = "",
    loading = false,
    saving = false,
    onRefresh = undefined,
    icon = undefined,
    count = undefined,
    leftActions = undefined,
    rightControls = undefined,
  }: {
    title?: string;
    loading?: boolean;
    saving?: boolean;
    onRefresh?: () => void;
    icon?: any;
    count?: number;
    leftActions?: import("svelte").Snippet;
    rightControls?: import("svelte").Snippet;
  } = $props();
</script>

<div class="toolbar">
  <div class="toolbar-left">
    {#if leftActions}
      {@render leftActions()}
    {/if}
  </div>

  <div class="toolbar-right">
    {#if rightControls}
      {@render rightControls()}
    {/if}

    {#if onRefresh}
      <SimpleButton onclick={onRefresh} secondary disabled={loading} title="Refresh list">
        {#if loading}
          <Fa icon={faSpinner} class="spin-icon" fw />
        {:else}
          <Fa icon={faRotateRight} fw />
        {/if}
        <span>{loading ? "Refreshing..." : "Refresh"}</span>
      </SimpleButton>
    {/if}
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: var(--hover-color);
    border-bottom: 1px solid var(--border-color);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.spin-icon) {
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

  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .toolbar-left,
    .toolbar-right {
      width: 100%;
    }

    .toolbar-right {
      justify-content: flex-start;
    }
  }
</style>
