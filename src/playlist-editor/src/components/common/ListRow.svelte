<script lang="ts">
  import Fa from "svelte-fa";
  import { faGripVertical } from "@fortawesome/free-solid-svg-icons";

  let {
    selected = false,
    draggable = false,
    selectable = false,
    dragging = false,
    dragOver = false,
    onclick = undefined,
    onSelect = undefined,
    onDragStart = undefined,
    onDragOver = undefined,
    onDragLeave = undefined,
    onDrop = undefined,
    index = undefined,
    children,
    dragHandle,
    checkbox,
    content,
    actions,
  }: {
    selected?: boolean;
    draggable?: boolean;
    selectable?: boolean;
    dragging?: boolean;
    dragOver?: boolean;
    onclick?: () => void;
    onSelect?: () => void;
    onDragStart?: (e: DragEvent, index: number) => void;
    onDragOver?: (e: DragEvent, index: number) => void;
    onDragLeave?: () => void;
    onDrop?: (e: DragEvent, index: number) => void;
    index?: number;
    children?: import("svelte").Snippet;
    dragHandle?: import("svelte").Snippet;
    checkbox?: import("svelte").Snippet;
    content?: import("svelte").Snippet;
    actions?: import("svelte").Snippet;
  } = $props();

  function handleClick(e: MouseEvent) {
    if (onclick) onclick();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onclick) onclick();
    }
  }

  function handleDragStart(e: DragEvent) {
    if (onDragStart && index !== undefined) {
      onDragStart(e, index);
    }
  }

  function handleDragOver(e: DragEvent) {
    if (onDragOver && index !== undefined) {
      onDragOver(e, index);
    }
  }

  function handleDragLeave() {
    if (onDragLeave) onDragLeave();
  }

  function handleDrop(e: DragEvent) {
    if (onDrop && index !== undefined) {
      onDrop(e, index);
    }
  }
</script>

<div
  class="list-row"
  class:selected
  class:dragging
  class:drag-over={dragOver}
  class:draggable
  {draggable}
  ondragstart={handleDragStart}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
>
  {#if draggable}
    <div class="drag-handle-cell">
      {#if dragHandle}
        {@render dragHandle()}
      {:else}
        <div class="drag-handle" title="Drag to reorder">
          <Fa icon={faGripVertical} />
        </div>
      {/if}
    </div>
  {/if}

  {#if selectable}
    <div class="checkbox-cell">
      {#if checkbox}
        {@render checkbox()}
      {:else}
        <input
          aria-label="Select item"
          type="checkbox"
          checked={selected}
          onchange={() => onSelect?.()}
          onclick={(e) => e.stopPropagation()}
        />
      {/if}
    </div>
  {/if}

  {#if content}
    <div class="content-cell">
      {@render content()}
    </div>
  {/if}

  {#if actions}
    <div class="actions-cell">
      {@render actions()}
    </div>
  {/if}

  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .list-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    transition:
      background 0.15s,
      opacity 0.2s;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    position: relative;
  }

  .list-row:last-child {
    border-bottom: none;
  }

  .list-row:hover {
    background: var(--hover-color);
  }

  .list-row.selected {
    background: var(--active-bg-color);
  }

  .list-row.dragging {
    opacity: 0.5;
    background: var(--hover-color);
  }

  .list-row.drag-over {
    border-top: 2px solid var(--primary-color);
    background: rgba(62, 166, 255, 0.1);
  }

  .drag-handle-cell {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .drag-handle {
    width: 24px;
    height: 24px;
    color: var(--text-muted);
    cursor: grab;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .list-row:hover .drag-handle {
    opacity: 1;
  }

  .checkbox-cell {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .checkbox-cell input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--primary-color);
  }

  .content-cell {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 12px;
  }

  .actions-cell {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }

  .list-row:hover .actions-cell {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .actions-cell {
      opacity: 1;
    }

    .drag-handle {
      opacity: 1;
    }
  }
</style>
