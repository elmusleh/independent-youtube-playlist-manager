<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faKey,
    faShieldHalved,
    faCopy,
    faCheck,
    faArrowsRotate,
    faCircleExclamation,
    faInfoCircle,
    faTrash,
    faLink,
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
  // "pair" | "generate" | null — which path the user is taking when no key is set.
  let mode = $state<"pair" | "generate" | null>(null);
  // Confirmation state for destructive actions.
  let confirmAction = $state<null | "regenerate" | "remove">(null);
  let showInfo = $state(false);

  function generate() {
    config.syncKey = generateSyncKey();
    inputKey = "";
    copied = false;
    error = "";
    mode = null;
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
    mode = null;
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

  function requestRegenerate() {
    confirmAction = "regenerate";
  }

  function requestRemove() {
    confirmAction = "remove";
  }

  function confirmRegenerate() {
    confirmAction = null;
    generate();
  }

  function confirmRemove() {
    confirmAction = null;
    config.syncKey = null;
    inputKey = "";
    error = "";
    onPersist();
  }

  function cancelConfirm() {
    confirmAction = null;
  }
</script>

<section class="card">
  <h3><Fa icon={faShieldHalved} /> Your sync key</h3>
  <p class="sub-text">
    One key links every device. Generate a new key on your first device, then paste that
    <strong>same key</strong> into every other device. No account is needed. Keep it secret:
    <strong>lose the key and your synced data cannot be recovered.</strong>
  </p>

  <button type="button" class="link-btn info-toggle" onclick={() => (showInfo = !showInfo)}>
    <Fa icon={faInfoCircle} />
    {showInfo ? "Hide" : "What is this key?"}
  </button>
  {#if showInfo}
    <div class="info-box">
      <ul>
        <li>
          <strong>What it is:</strong> a 32-character secret. It encrypts your data and derives the storage
          address on the relay. The relay only ever sees ciphertext.
        </li>
        <li>
          <strong>One key, all devices:</strong> every device must use the <em>identical</em>
          key. A different key means a different address — devices will never see each other.
        </li>
        <li>
          <strong>Generate vs. pair:</strong> generate a new key on your first device, then
          <em>pair</em> every other device by pasting that key. Do not generate a second key.
        </li>
        <li>
          <strong>Removing the key</strong> stops syncing on this device only; data already on the relay
          stays there until it expires.
        </li>
        <li>
          <strong>Regenerating</strong> creates a brand-new key and a brand-new address. Your other devices
          keep using the old key and will stop receiving updates. You must paste the new key into every
          device again.
        </li>
        <li>
          <strong>Losing the key</strong> means the encrypted data on the relay is unrecoverable — there
          is no reset or recovery.
        </li>
      </ul>
    </div>
  {/if}

  {#if config.syncKey}
    <div class="key-display">
      <code class="key-value">{config.syncKey}</code>
      <div class="key-actions">
        <SimpleButton secondary onclick={copyKey}>
          <Fa icon={copied ? faCheck : faCopy} />
          {copied ? "Copied" : "Copy"}
        </SimpleButton>
        <SimpleButton secondary onclick={requestRegenerate}>
          <Fa icon={faArrowsRotate} /> Replace key
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
    <button type="button" class="link-btn danger" onclick={requestRemove}>
      <Fa icon={faTrash} /> Remove key from this device
    </button>
  {:else if mode === null}
    <div class="key-actions two-paths">
      <SimpleButton primary onclick={() => (mode = "generate")}>
        <Fa icon={faKey} /> Generate a new key
      </SimpleButton>
      <SimpleButton secondary onclick={() => (mode = "pair")}>
        <Fa icon={faLink} /> Pair with an existing key
      </SimpleButton>
    </div>
    <p class="sub-text path-hint">
      Choose one: generate a new key on your first device, or paste a key you already have.
    </p>
  {:else if mode === "generate"}
    <div class="path-panel">
      <p class="sub-text">
        This creates a brand-new key. Only do this on your <strong>first</strong> device, or when you
        intentionally want to start over.
      </p>
      <div class="key-actions">
        <SimpleButton primary onclick={generate}>
          <Fa icon={faKey} /> Generate now
        </SimpleButton>
        <SimpleButton secondary onclick={() => (mode = null)}>Cancel</SimpleButton>
      </div>
    </div>
  {:else if mode === "pair"}
    <div class="path-panel">
      <p class="sub-text">Paste the key exactly as it appears on your other device.</p>
      <div class="field">
        <input
          id="enter-key"
          type="text"
          bind:value={inputKey}
          placeholder="ABCDE-FGHJK-MNPQR-STVWX"
          aria-label="Sync key"
        />
        <SimpleButton secondary onclick={saveEntered}>
          <Fa icon={faCheck} /> Pair with this key
        </SimpleButton>
      </div>
      <button type="button" class="link-btn" onclick={() => (mode = null)}>Cancel</button>
    </div>
  {/if}

  {#if error}
    <p class="sync-error"><Fa icon={faCircleExclamation} /> {error}</p>
  {/if}

  {#if confirmAction}
    <div class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="confirm-box">
        <h4 id="confirm-title">
          {confirmAction === "regenerate" ? "Replace this sync key?" : "Remove sync key?"}
        </h4>
        {#if confirmAction === "regenerate"}
          <p>
            This generates a <strong>new key</strong> and a new storage address. Your other devices keep
            using the old key and will stop receiving updates until you paste the new key into them. Data
            already synced under the old key is not deleted.
          </p>
        {:else}
          <p>
            This removes the key from <strong>this device only</strong>. Sync stops here, but data
            already on the relay remains until it expires. Other devices are unaffected.
          </p>
        {/if}
        <div class="key-actions">
          <SimpleButton
            primary
            onclick={confirmAction === "regenerate" ? confirmRegenerate : confirmRemove}
          >
            {confirmAction === "regenerate" ? "Yes, replace" : "Yes, remove"}
          </SimpleButton>
          <SimpleButton secondary onclick={cancelConfirm}>Cancel</SimpleButton>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .two-paths {
    flex-direction: column;
    gap: 0.5rem;
  }
  .path-hint {
    margin-top: 0.5rem;
  }
  .path-panel {
    margin-top: 0.5rem;
  }
  .info-box {
    margin: 0.75rem 0;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border, #ccc);
    border-radius: 8px;
    background: var(--card, #f7f7f7);
    font-size: 0.9rem;
  }
  .info-box ul {
    margin: 0;
    padding-left: 1.25rem;
  }
  .info-box li {
    margin-bottom: 0.4rem;
  }
  .info-toggle {
    margin-top: 0.25rem;
  }
  .link-btn.danger {
    color: var(--danger, #c0392b);
  }
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .confirm-box {
    background: var(--card, #fff);
    padding: 1.25rem 1.5rem;
    border-radius: 10px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }
  .confirm-box h4 {
    margin-top: 0;
  }
  .confirm-box .key-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
</style>
