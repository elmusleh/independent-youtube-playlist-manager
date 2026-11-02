<script lang="ts">
  import Fa from "svelte-fa";
  import { faServer, faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";

  let {
    enabled,
    url,
    key,
    onToggle,
    onSetUrl,
    onSetKey,
  }: {
    enabled: boolean;
    url: string;
    key: string;
    onToggle: (v: boolean) => void;
    onSetUrl: (v: string) => void;
    onSetKey: (v: string) => void;
  } = $props();

  let expanded = $state(false);
</script>

<section class="card" class:enabled>
  <div class="backend-card-header">
    <Fa icon={faServer} />
    <div class="backend-card-title">
      <h3>Your own Supabase project</h3>
      <span class="sub-text">Free · works everywhere</span>
    </div>
    <input type="checkbox" checked={enabled} onchange={(e) => onToggle(e.currentTarget.checked)} />
  </div>
  <p class="sub-text">
    Sync over your own free Supabase project — the only backend that works on every browser and
    phone.
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
      <label for="sb-key">Anon (public) key</label>
      <input
        id="sb-key"
        type="text"
        value={key}
        placeholder="eyJ…"
        oninput={(e) => onSetKey(e.currentTarget.value)}
      />
    </div>
  {/if}
  <button type="button" class="learn-more" onclick={() => (expanded = !expanded)}>
    <Fa icon={expanded ? faChevronUp : faChevronDown} />
    {expanded ? "Hide" : "Learn more"}
  </button>
  {#if expanded}
    <div class="backend-detail">
      <p>
        <strong>Setup:</strong> 1) create a free project at supabase.com, 2) run the one-time SQL
        from <em>docs/sync-relay.sql</em>, 3) paste the Project URL and anon key above.
      </p>
      <p>
        <strong>Privacy:</strong> you own the server, but it stores ciphertext only — even you can't read
        the data there without your key.
      </p>
    </div>
  {/if}
</section>
