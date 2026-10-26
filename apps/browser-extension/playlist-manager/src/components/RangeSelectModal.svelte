<script lang="ts">
  import Modal from "./Modal.svelte";
  import SimpleButton from "./SimpleButton.svelte";

  let {
    display = $bindable(false),
    title = "Select Videos",
    maxValue = 0,
    onConfirm,
  }: {
    display?: boolean;
    title?: string;
    maxValue?: number;
    onConfirm?: (count: number) => void;
  } = $props();

  const PRESETS = [25, 50, 100];

  let count = $state(50);
  let inputEl = $state<HTMLInputElement>();

  function getClampedCount() {
    const value = Number.isFinite(count) ? count : 50;
    return Math.min(Math.max(value, 1), Math.max(maxValue, 1));
  }

  function handleConfirm() {
    const clamped = getClampedCount();
    onConfirm?.(clamped);
    display = false;
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }
  }

  $effect(() => {
    if (display) {
      count = 50;
      // Focus the input once the modal has mounted on screen.
      requestAnimationFrame(() => inputEl?.select());
    }
  });
</script>

<Modal bind:display {title} onclose={() => (display = false)}>
  <p class="hint">Select up to {Math.max(maxValue, 0)} videos</p>

  <input
    bind:this={inputEl}
    bind:value={count}
    type="number"
    min="1"
    max={Math.max(maxValue, 1)}
    step="1"
    aria-label="Number of videos to select"
    onkeydown={handleInputKeydown}
  />

  <div class="presets">
    {#each PRESETS as preset}
      {#if preset <= maxValue}
        <SimpleButton
          secondary
          className={preset === count ? "preset-btn active" : "preset-btn"}
          onclick={() => (count = preset)}
        >
          <span>{preset}</span>
        </SimpleButton>
      {/if}
    {/each}
  </div>

  {#snippet footer()}
    <div class="modal-footer">
      <SimpleButton secondary onclick={() => (display = false)}>Cancel</SimpleButton>
      <SimpleButton primary onclick={handleConfirm}>
        <span>Select</span>
      </SimpleButton>
    </div>
  {/snippet}
</Modal>

<style>
  .hint {
    margin: 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  input[type="number"] {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--hover-color);
    color: var(--text-color);
    font-size: 16px;
    text-align: center;
    box-sizing: border-box;
    outline: none;
  }

  input[type="number"]:focus {
    border-color: var(--primary-color);
  }

  .presets {
    display: flex;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  :global(.preset-btn) {
    min-width: 56px;
  }

  :global(.preset-btn.active) {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }
</style>
