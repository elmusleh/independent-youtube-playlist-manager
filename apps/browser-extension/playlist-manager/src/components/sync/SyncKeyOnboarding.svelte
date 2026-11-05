<script lang="ts">
  import Fa from "svelte-fa";
  import { faPlus, faCamera, faLink } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";

  let {
    keyInput = $bindable(""),
    keyError = null,
    onCreateSpace,
    onScanQr,
    onSaveKey,
  }: {
    keyInput?: string;
    keyError?: string | null;
    onCreateSpace: () => void;
    onScanQr: () => void;
    onSaveKey: () => void;
  } = $props();
</script>

<div class="onboarding-choices">
  <!-- Option 1: New Setup -->
  <div class="choice-card">
    <div class="choice-header">
      <span class="choice-num">Option 1</span>
      <h4>New Sync Space</h4>
    </div>
    <p class="choice-desc">First time syncing? Generate a fresh encryption key for this device.</p>
    <SimpleButton primary onclick={onCreateSpace}>
      <Fa icon={faPlus} /> Create new Sync Space
    </SimpleButton>
  </div>

  <!-- Option 2: Join Existing -->
  <div class="choice-card highlight">
    <div class="choice-header">
      <span class="choice-num">Option 2</span>
      <h4>Connect Existing Device</h4>
    </div>
    <p class="choice-desc">
      Scan the QR code shown on your other device, or paste your 20-character key.
    </p>
    <div class="choice-actions">
      <SimpleButton secondary onclick={onScanQr} title="Scan QR code using camera">
        <Fa icon={faCamera} /> Scan QR Code
      </SimpleButton>
    </div>
    <div class="key-input-group">
      <input
        type="text"
        bind:value={keyInput}
        placeholder="Or paste key (ABCDE-FGHJK-...)"
        class="key-input"
        onkeydown={(e) => {
          if (e.key === "Enter") onSaveKey();
        }}
      />
      <SimpleButton primary onclick={onSaveKey}>
        <Fa icon={faLink} /> Link
      </SimpleButton>
    </div>
    {#if keyError}
      <p class="error-text" role="alert">{keyError}</p>
    {/if}
  </div>
</div>

<style>
  .onboarding-choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
  .choice-card {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    background: var(--card-bg, #fafafa);
    gap: 0.75rem;
  }
  .choice-card.highlight {
    border-color: var(--primary-color, #3b82f6);
  }
  .choice-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .choice-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }
  .choice-num {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--active-bg-color, #e0e7ff);
    color: var(--primary-color, #3b82f6);
  }
  .choice-desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted, #6b7280);
    line-height: 1.4;
    flex-grow: 1;
  }
  .choice-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .key-input-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .key-input {
    flex: 1 1 180px;
    min-width: 0;
    padding: 0.45rem 0.65rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.82rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 6px;
    background: var(--input-bg, #fff);
    color: var(--text-color, #111);
  }
  .error-text {
    color: var(--danger, #ef4444);
    font-size: 0.82rem;
    margin: 0;
  }
</style>
