<script lang="ts">
  import Fa from "svelte-fa";
  import { faRotateRight } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";

  let {
    isSelectMode = false,
    onRefresh = undefined,
    standardActions,
    bulkActions,
    children
  }: {
    isSelectMode?: boolean;
    onRefresh?: () => void;
    standardActions?: import("svelte").Snippet;
    bulkActions?: import("svelte").Snippet;
    children?: import("svelte").Snippet;
  } = $props();
</script>

<div class="view-toolbar {isSelectMode ? 'select-mode' : ''}">
  {#if isSelectMode}
    <div class="toolbar-group bulk">
      {@render bulkActions?.()}
    </div>
  {:else}
    <div class="toolbar-group standard">
      {@render standardActions?.()}
      
      {#if children}
        {@render children()}
      {/if}

      {#if onRefresh}
        <div class="toolbar-group right">
          <SimpleButton secondary onclick={onRefresh} title="Refresh list">
            <Fa icon={faRotateRight} fw />
            <span>Refresh</span>
          </SimpleButton>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  @import "../../css/view-layout.css";

  .view-toolbar {
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border-bottom: 1px solid var(--border-color);
  }

  .view-toolbar.select-mode {
    background-color: var(--active-bg-color);
    border-bottom-color: var(--primary-color);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .toolbar-group.bulk {
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 768px) {
    .toolbar-group {
      flex-direction: column;
      align-items: stretch;
    }
    
    .toolbar-group.right {
      margin-left: 0;
    }
  }
</style>
