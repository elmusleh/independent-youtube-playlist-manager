<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faCloud,
    faChevronDown,
    faChevronUp,
    faCircleCheck,
    faCircleExclamation,
    faSpinner,
    faPlugCircleCheck,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import type { ConnectionCheckResult } from "../../services/sync/sync-diagnostics.js";

  let {
    enabled,
    ready,
    hasSyncKey = false,
    permissionGranted = null,
    isTesting = false,
    testResult = null,
    onToggle,
    onRequestPermission,
    onTestConnection,
  }: {
    enabled: boolean;
    ready: boolean;
    hasSyncKey?: boolean;
    permissionGranted?: boolean | null;
    isTesting?: boolean;
    testResult?: ConnectionCheckResult | null;
    onToggle: (v: boolean) => void;
    onRequestPermission?: () => void;
    onTestConnection?: () => void | Promise<void>;
  } = $props();

  let expanded = $state(false);
</script>

<section class="card" class:enabled>
  <div class="backend-card-header">
    <Fa icon={faCloud} />
    <div class="backend-card-title">
      <h3>IYPM hosted (Beta)</h3>
      <span class="sub-text">
        {ready ? "Zero setup" : "Coming soon"}
      </span>
    </div>
    {#if ready}
      <input
        type="checkbox"
        checked={enabled}
        onchange={(e) => onToggle(e.currentTarget.checked)}
      />
    {:else}
      <span class="sync-badge sync-badge-beta">Beta · coming soon</span>
    {/if}
  </div>
  <p class="sub-text">
    {ready
      ? "Zero setup — uses IYPM's hosted service. Nothing but encrypted data is stored."
      : "Not live yet. We're setting up the hosted service — use your own Supabase project below for now."}
  </p>

  {#if ready && enabled && permissionGranted !== null}
    <div class="permission-row" class:needs-access={!permissionGranted}>
      {#if permissionGranted}
        <span class="perm-ok">
          <Fa icon={faCircleCheck} /> Relay host access granted
        </span>
      {:else}
        <span class="perm-warn">
          <Fa icon={faCircleExclamation} /> Browser permission needed to reach the sync relay
        </span>
        {#if onRequestPermission}
          <SimpleButton secondary onclick={onRequestPermission} className="grant-relay-btn">
            Allow relay access
          </SimpleButton>
        {/if}
      {/if}
    </div>
  {/if}

  {#if ready && enabled && onTestConnection}
    <div class="conn-actions">
      <SimpleButton
        secondary
        disabled={isTesting || !hasSyncKey}
        title={hasSyncKey
          ? "Verifies encrypted IYPM hosted relay access and checks how many records exist in your cloud space"
          : "Enter or generate a sync key first to test your encrypted space on IYPM hosted"}
        onclick={() => onTestConnection?.()}
      >
        {#if isTesting}
          <Fa icon={faSpinner} spin /> Testing…
        {:else}
          <Fa icon={faPlugCircleCheck} /> Test connection
        {/if}
      </SimpleButton>
    </div>
  {/if}

  {#if testResult}
    <div class="conn-result" class:ok={testResult.ok} class:err={!testResult.ok}>
      <Fa icon={testResult.ok ? faCircleCheck : faCircleExclamation} />
      <div class="conn-result-body">
        <strong>{testResult.ok ? "Connected to IYPM hosted" : "Connection failed"}</strong>
        <span>{testResult.summary}</span>
        {#if testResult.endpointHost}
          <span class="conn-meta">
            Host: <code>{testResult.endpointHost}</code>
            {#if testResult.spacePrefix}
              · Space: <code>#{testResult.spacePrefix}</code>
            {/if}
            {#if testResult.latencyMs > 0}
              · {testResult.latencyMs} ms
            {/if}
          </span>
        {/if}
      </div>
    </div>
  {/if}

  <button type="button" class="learn-more" onclick={() => (expanded = !expanded)}>
    <Fa icon={expanded ? faChevronUp : faChevronDown} />
    {expanded ? "Hide" : "Learn more"}
  </button>
  {#if expanded}
    <div class="backend-detail">
      <p>
        <strong>Where your data goes:</strong> encrypted on this device with AES-256-GCM, then only ciphertext
        is uploaded to IYPM's hosted relay.
      </p>
      <p>
        <strong>Privacy:</strong> the server stores ciphertext only — nobody (including IYPM) can read
        it without your key.
      </p>
    </div>
  {/if}
</section>

<style>
  .permission-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.5rem 0;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    background: var(--muted, #f3f4f6);
    font-size: 0.8rem;
  }
  .permission-row.needs-access {
    border: 1px solid var(--warning, #f59e0b);
  }
  .perm-ok {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--success, #10b981);
    font-weight: 500;
  }
  .perm-warn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--warning, #d97706);
    font-weight: 500;
  }
</style>
