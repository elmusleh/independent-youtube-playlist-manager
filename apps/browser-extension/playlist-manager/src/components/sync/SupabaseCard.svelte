<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faServer,
    faChevronDown,
    faChevronUp,
    faCircleCheck,
    faCircleExclamation,
    faSpinner,
    faPlugCircleCheck,
    faUpRightFromSquare,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import type { ConnectionCheckResult } from "../../services/sync/sync-diagnostics.js";

  const SQL_SCHEMA_URL =
    "https://github.com/elmusleh/independent-youtube-playlist-manager/blob/next/docs/sync-relay-v2.sql";

  let {
    enabled,
    url,
    key,
    hasSyncKey = false,
    isTesting = false,
    testResult = null,
    onToggle,
    onSetUrl,
    onSetKey,
    onTestConnection,
  }: {
    enabled: boolean;
    url: string;
    key: string;
    hasSyncKey?: boolean;
    isTesting?: boolean;
    testResult?: ConnectionCheckResult | null;
    onToggle: (v: boolean) => void;
    onSetUrl: (v: string) => void;
    onSetKey: (v: string) => void;
    onTestConnection?: () => void | Promise<void>;
  } = $props();

  let expanded = $state(false);
</script>

<section class="card" class:enabled>
  <div class="backend-card-header">
    <Fa icon={faServer} />
    <div class="backend-card-title">
      <h3>Your own Supabase project</h3>
      <span class="sub-text">Free · self-hosted cloud</span>
    </div>
    <input type="checkbox" checked={enabled} onchange={(e) => onToggle(e.currentTarget.checked)} />
  </div>
  <p class="sub-text">
    Run the exact same zero-knowledge Sync v2 engine on your own free Supabase project (requires
    running the one-time SQL bootstrap below).
  </p>
  {#if enabled}
    <div class="field">
      <label for="sb-url">Project URL</label>
      <input
        id="sb-url"
        type="text"
        value={url}
        placeholder="https://yourproject.supabase.co"
        oninput={(e) => onSetUrl(e.currentTarget.value)}
      />
      <label for="sb-key">Publishable / Anon public key</label>
      <input
        id="sb-key"
        type="text"
        value={key}
        placeholder="sb_publishable_… or eyJ…"
        oninput={(e) => onSetKey(e.currentTarget.value)}
      />
    </div>

    {#if onTestConnection}
      <div class="conn-actions">
        <SimpleButton
          secondary
          disabled={isTesting || !hasSyncKey || !url.trim() || !key.trim()}
          title="Verifies your Supabase URL, key, and Sync v2 SQL RPC functions"
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
          <strong
            >{testResult.ok
              ? "Supabase schema verified"
              : "Connection / schema check failed"}</strong
          >
          <span>{testResult.summary}</span>
        </div>
      </div>
    {/if}
  {/if}
  <button type="button" class="learn-more" onclick={() => (expanded = !expanded)}>
    <Fa icon={expanded ? faChevronUp : faChevronDown} />
    {expanded ? "Hide setup guide" : "How schema & setup work"}
  </button>
  {#if expanded}
    <div class="backend-detail">
      <p>
        <strong>1. One-time database setup:</strong> open your Supabase project's
        <em>SQL Editor</em> and run
        <a href={SQL_SCHEMA_URL} target="_blank" rel="noopener noreferrer" class="api-link">
          docs/sync-relay-v2.sql <Fa icon={faUpRightFromSquare} />
        </a>.
      </p>
      <p>
        <strong>2. How data &amp; security are managed:</strong> the script creates
        <code>sync_spaces</code>, <code>sync_records</code>, and <code>sync_rate_limit</code> with
        RLS blocking direct table access, exposing only 4 RPCs (<code>sync_claim</code>,
        <code>sync_pull</code>, <code>sync_push</code>, <code>sync_delete_space</code>).
      </p>
      <p>
        <strong>3. Verify:</strong> paste your Project URL and Publishable/Anon key above, then
        click
        <strong>Test connection</strong> to confirm the RPC schema is live.
      </p>
    </div>
  {/if}
</section>
