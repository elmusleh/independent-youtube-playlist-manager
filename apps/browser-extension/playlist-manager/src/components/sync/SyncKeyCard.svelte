<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faKey,
    faShieldHalved,
    faCopy,
    faCheck,
    faArrowsRotate,
    faCircleExclamation,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import {
    generateSyncKey,
    formatSyncKey,
    isValidSyncKey,
    normalizeSyncKey,
  } from "../../services/sync/sync-key.js";
  import type { SyncConfig } from "../../services/sync/sync-config.js";

  let { config, onPersist }: { config: SyncConfig; onPersist: () => void } = $props();

  let inputKey = $state("");
  let copied = $state(false);
  let error = $state("");

  function generate() {
    config.syncKey = generateSyncKey();
    inputKey = "";
    copied = false;
    error = "";
    onPersist();
  }

  function saveEntered() {
    const normalized = normalizeSyncKey(inputKey);
    if (!isValidSyncKey(normalized)) {
      error = "That is not a valid sync key. A key looks like ABCDE-FGHJK-MNPQR-STVWX.";
      return;
    }
    config.syncKey = formatSyncKey(normalized);
    inputKey = "";
    error = "";
    copied = false;
    onPersist();
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(config.syncKey ?? "");
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      error = "Could not copy. Select and copy the key manually.";
    }
  }

  function clearKey() {
    config.syncKey = null;
    error = "";
    onPersist();
  }
</script>

<section class="card">
  <h3><Fa icon={faShieldHalved} /> Your sync key</h3>
  <p class="sub-text">
    Pairing = using the <strong>same key</strong> on every device. Generate one here, or paste the
    key from another device — including your phone. No account, no separate code. Keep it secret:
    <strong>lose the key and your data cannot be recovered.</strong>
  </p>
  {#if config.syncKey}
    <div class="key-display">
      <code class="key-value">{config.syncKey}</code>
      <div class="key-actions">
        <SimpleButton secondary onclick={copyKey}>
          <Fa icon={copied ? faCheck : faCopy} />
          {copied ? "Copied" : "Copy"}
        </SimpleButton>
        <SimpleButton secondary onclick={generate}>
          <Fa icon={faArrowsRotate} /> New key
        </SimpleButton>
      </div>
    </div>
    <div class="field">
      <input
        type="text"
        bind:value={inputKey}
        placeholder="Paste a key from another device…"
        aria-label="Sync key"
      />
      <SimpleButton primary onclick={saveEntered}>
        <Fa icon={faCheck} /> Use this key
      </SimpleButton>
    </div>
    <button type="button" class="link-btn" onclick={clearKey}>Remove key</button>
  {:else}
    <div class="key-actions">
      <SimpleButton primary onclick={generate}>
        <Fa icon={faKey} /> Generate a key
      </SimpleButton>
    </div>
    <div class="field">
      <label for="enter-key">…or paste a key from another device</label>
      <input
        id="enter-key"
        type="text"
        bind:value={inputKey}
        placeholder="ABCDE-FGHJK-MNPQR-STVWX"
      />
      <SimpleButton secondary onclick={saveEntered}>
        <Fa icon={faCheck} /> Pair with this key
      </SimpleButton>
    </div>
  {/if}
  {#if error}
    <p class="sync-error"><Fa icon={faCircleExclamation} /> {error}</p>
  {/if}
</section>
