<script lang="ts">
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import { faKey, faCopy, faCheck, faSync } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "./SimpleButton.svelte";
  import {
    generateSyncKey,
    formatSyncKey,
    isValidSyncKey,
    normalizeSyncKey,
  } from "../services/sync/sync-key.js";

  let syncKey = $state("");
  let inputKey = $state("");
  let copied = $state(false);
  let saved = $state(false);
  let error = $state("");

  onMount(() => {
    const stored = localStorage.getItem("yph_sync_key");
    if (stored) {
      syncKey = stored;
      saved = true;
    }
  });

  function handleGenerate() {
    syncKey = generateSyncKey();
    saved = false;
    copied = false;
    error = "";
  }

  function handleSaveKey() {
    const normalized = normalizeSyncKey(inputKey);
    if (!isValidSyncKey(normalized)) {
      error = "Invalid sync key. A sync key is 20 characters (e.g. ABCDE-FGHJK-MNPQR-STVWX).";
      return;
    }
    syncKey = formatSyncKey(normalized);
    localStorage.setItem("yph_sync_key", syncKey);
    saved = true;
    error = "";
    inputKey = "";
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(syncKey);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (e) {
      error = "Failed to copy to clipboard.";
    }
  }

  function handleClear() {
    syncKey = "";
    saved = false;
    localStorage.removeItem("yph_sync_key");
  }
</script>

<div class="sync-settings">
  <div class="sync-card">
    <h3>Device Pairing &amp; Sync Key</h3>
    <p class="sync-description">
      Your sync key is the only credential for cross-device sync. Share it with your other devices
      to sync playlists. <strong>Lose the key = lose the data.</strong>
    </p>

    {#if syncKey}
      <div class="key-display">
        <div class="key-value">{syncKey}</div>
        <div class="key-actions">
          <SimpleButton secondary onclick={handleCopy}>
            <Fa icon={copied ? faCheck : faCopy} />
            {copied ? "Copied!" : "Copy"}
          </SimpleButton>
          <SimpleButton secondary onclick={handleGenerate}>
            <Fa icon={faSync} /> Generate New
          </SimpleButton>
        </div>
      </div>
      {#if saved}
        <p class="sync-status success">Sync key saved. This device is paired.</p>
      {:else}
        <p class="sync-status pending">Save this key on your other devices to pair them.</p>
      {/if}
      <SimpleButton danger onclick={handleClear}>
        <Fa icon={faKey} /> Clear Key
      </SimpleButton>
    {:else}
      <div class="key-generate">
        <SimpleButton primary onclick={handleGenerate}>
          <Fa icon={faKey} /> Generate Sync Key
        </SimpleButton>
      </div>
      <div class="key-enter">
        <p>Or enter a key from another device:</p>
        <input
          type="text"
          bind:value={inputKey}
          placeholder="ABCDE-FGHJK-MNPQR-STVWX"
          class="key-input"
        />
        {#if error}
          <p class="sync-error">{error}</p>
        {/if}
        <SimpleButton primary onclick={handleSaveKey}>
          <Fa icon={faCheck} /> Save Key
        </SimpleButton>
      </div>
    {/if}
  </div>
</div>

<style>
  .sync-settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sync-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sync-description {
    font-size: 14px;
    color: var(--text-secondary, #666);
    line-height: 1.5;
  }

  .key-display {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 8px;
    border: 1px solid var(--border-color, #ddd);
  }

  .key-value {
    font-family: monospace;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 2px;
    text-align: center;
    word-break: break-all;
  }

  .key-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .key-generate {
    display: flex;
    justify-content: center;
    padding: 16px;
  }

  .key-enter {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .key-input {
    padding: 8px 12px;
    font-family: monospace;
    font-size: 16px;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 6px;
    width: 100%;
    box-sizing: border-box;
  }

  .sync-status {
    font-size: 13px;
    margin: 0;
  }

  .sync-status.success {
    color: var(--success-color, #22c55e);
  }

  .sync-status.pending {
    color: var(--warning-color, #f59e0b);
  }

  .sync-error {
    color: var(--error-color, #ef4444);
    font-size: 13px;
    margin: 0;
  }
</style>
