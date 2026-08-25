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

<Modal bind:display>
  <div class="range-modal">
    <h3>{title}</h3>
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

    <div class="modal-footer">
      <SimpleButton onclick={() => (display = false)} secondary>
        <span>Cancel</span>
      </SimpleButton>
      <SimpleButton onclick={handleConfirm} primary>
        <span>Select</span>
      </SimpleButton>
    </div>
  </div>
</Modal>

<style>
  .range-modal {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px;
  }

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    text-align: center;
  }

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
    justify-content: center;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }
</style>
