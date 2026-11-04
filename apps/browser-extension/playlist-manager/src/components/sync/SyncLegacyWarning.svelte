<script lang="ts">
  import SimpleButton from "../SimpleButton.svelte";
  import { needsV2RelayAcknowledgement } from "../../services/sync/sync-config-compatibility";
  import type { SyncConfig } from "../../services/sync/sync-config";

  let {
    config,
    onPersist,
    onContinue,
  }: {
    config: SyncConfig;
    onPersist: () => void | Promise<void>;
    onContinue: () => void | Promise<void>;
  } = $props();
  let confirmed = $state(false);
  const visible = $derived(needsV2RelayAcknowledgement(config));

  $effect(() => {
    if (!visible) confirmed = false;
  });

  async function acknowledgeAndContinue() {
    if (!visible || !confirmed) return;
    config.legacyV2AcknowledgedAt = Date.now();
    config.syncConfigVersion = 2;
    await onPersist();
    await onContinue();
  }
</script>

{#if visible}
  <section
    class="legacy-sync-warning"
    aria-labelledby="legacy-sync-title"
    data-testid="legacy-sync-warning"
  >
    <div class="warning-copy">
      <h3 id="legacy-sync-title">Review this device's previous sync setup</h3>
      <p>
        The hosted legacy v1 snapshot table is currently unavailable. Remote-only data may not be
        recoverable, and this app cannot confirm that anything was migrated. Your local data remains
        unchanged until you choose to continue.
      </p>
      <p>
        Before continuing, export a full JSON backup from <strong>every device</strong> that still has
        the data you need. If another device still has the older sync setup, keep it and its local data
        intact until you have verified your backup.
      </p>
      <label class="acknowledgement">
        <input type="checkbox" bind:checked={confirmed} />
        I have backed up the devices I can access, or I accept that remote-only v1 data may be unavailable.
      </label>
      <SimpleButton primary disabled={!confirmed} onclick={acknowledgeAndContinue}>
        Continue with sync v2
      </SimpleButton>
    </div>
  </section>
{/if}

<style>
  .legacy-sync-warning {
    margin: 0 0 1rem;
    padding: 1rem 1.25rem;
    border: 1px solid var(--danger, #b42318);
    border-left-width: 4px;
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--danger, #b42318) 7%, var(--card, #fff));
    color: var(--foreground, #1f2937);
  }

  .warning-copy {
    display: grid;
    gap: 0.75rem;
    max-width: 72ch;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 1rem;
    font-weight: 700;
  }

  p {
    line-height: 1.5;
    color: var(--muted-foreground, #4b5563);
  }

  .acknowledgement {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    line-height: 1.5;
  }

  input {
    flex: 0 0 auto;
    margin-top: 0.25rem;
    accent-color: var(--accent, #2563eb);
  }
</style>
