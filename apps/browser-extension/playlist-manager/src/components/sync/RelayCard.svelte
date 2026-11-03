<script lang="ts">
  import Fa from "svelte-fa";
  import { faCloud, faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";

  let {
    enabled,
    ready,
    onToggle,
  }: {
    enabled: boolean;
    ready: boolean;
    onToggle: (v: boolean) => void;
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
  <button type="button" class="learn-more" onclick={() => (expanded = !expanded)}>
    <Fa icon={expanded ? faChevronUp : faChevronDown} />
    {expanded ? "Hide" : "Learn more"}
  </button>
  {#if expanded}
    <div class="backend-detail">
      <p>
        <strong>Where your data goes:</strong> encrypted on this device, then the encrypted blob is uploaded
        to IYPM's server.
      </p>
      <p>
        <strong>Privacy:</strong> the server stores ciphertext only — nobody (including IYPM) can read
        it without your key.
      </p>
    </div>
  {/if}
</section>
