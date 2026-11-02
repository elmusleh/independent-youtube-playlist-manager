<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faCloud,
    faServer,
    faFolderOpen,
    faChevronDown,
    faChevronUp,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import { supportsFileTransport } from "../../services/sync/file-sync-service.js";
  import {
    isRelayConfigured,
    type SyncConfig,
    type SyncBackend,
  } from "../../services/sync/sync-config.js";
  import type { DeviceCapabilities } from "../../services/sync/capabilities.js";

  let {
    config,
    caps,
    onSetBackend,
    onChooseFolder,
    onSetUrl,
    onSetKey,
  }: {
    config: SyncConfig;
    caps: DeviceCapabilities;
    onSetBackend: (b: SyncBackend) => void;
    onChooseFolder: () => void;
    onSetUrl: (v: string) => void;
    onSetKey: (v: string) => void;
  } = $props();

  const fileSupported = supportsFileTransport();
  const relayReady = isRelayConfigured();

  let expanded = $state<string | null>(null);
  function toggle(id: string) {
    expanded = expanded === id ? null : id;
  }
</script>

<section class="card">
  <h3><Fa icon={faCloud} /> How your data travels</h3>
  <p class="sub-text">
    Pick where your encrypted data lives, then set the same key on every device. You're on{" "}
    <strong>{caps.platformLabel}</strong>.
  </p>

  <div class="backend-option" class:selected={config.backend === "relay"}>
    <label>
      <input
        type="radio"
        name="backend"
        value="relay"
        checked={config.backend === "relay"}
        onchange={() => onSetBackend("relay")}
        disabled={!relayReady}
      />
      <Fa icon={faCloud} />
      <span class="backend-name">IYPM hosted (Beta)</span>
      {#if relayReady}
        <span class="sync-badge sync-badge-yes">✅ Works here</span>
      {:else}
        <span class="sync-badge sync-badge-beta">Beta · coming soon</span>
      {/if}
    </label>
    <p class="sub-text">
      {relayReady
        ? "Zero setup — uses IYPM's hosted service. Nothing but encrypted data is stored."
        : "Not live yet. Use your own Supabase project below for now."}
    </p>
    <button type="button" class="learn-more" onclick={() => toggle("relay")}>
      <Fa icon={expanded === "relay" ? faChevronUp : faChevronDown} />
      {expanded === "relay" ? "Hide details" : "Learn more"}
    </button>
    {#if expanded === "relay"}
      <div class="backend-detail">
        <p>
          <strong>Where your data goes:</strong> your playlists, settings and watch history are encrypted
          on this device before anything leaves it. Only the encrypted blob is uploaded to IYPM's hosted
          server.
        </p>
        <p>
          <strong>Privacy:</strong> the server stores ciphertext only — nobody (including IYPM) can read
          it without your sync key. There is no account; your key is the only identity.
        </p>
      </div>
    {/if}
  </div>

  <div class="backend-option" class:selected={config.backend === "supabase-byo"}>
    <label>
      <input
        type="radio"
        name="backend"
        value="supabase-byo"
        checked={config.backend === "supabase-byo"}
        onchange={() => onSetBackend("supabase-byo")}
      />
      <Fa icon={faServer} />
      <span class="backend-name">Your own Supabase project</span>
      <span class="sync-badge sync-badge-yes">✅ Works everywhere</span>
    </label>
    <p class="sub-text">
      Free tier, works on every browser and phone. You supply the project; only encrypted data is
      stored.
    </p>
    <button type="button" class="learn-more" onclick={() => toggle("supabase-byo")}>
      <Fa icon={expanded === "supabase-byo" ? faChevronUp : faChevronDown} />
      {expanded === "supabase-byo" ? "Hide details" : "Learn more"}
    </button>
    {#if expanded === "supabase-byo"}
      <div class="backend-detail">
        <p>
          <strong>Setup:</strong> 1) create a free project at supabase.com, 2) run the one-time SQL
          from <em>docs/sync-relay.sql</em>, 3) paste the Project URL and anon key below.
        </p>
        <p>
          <strong>Privacy:</strong> you own the server, but it still stores ciphertext only — even you
          can't read the data there without your key.
        </p>
      </div>
    {/if}
    {#if config.backend === "supabase-byo"}
      <div class="field">
        <label for="sb-url">Project URL</label>
        <input
          id="sb-url"
          type="text"
          value={config.supabaseUrl}
          placeholder="https://yourproject.supabase.co"
          oninput={(e) => onSetUrl(e.currentTarget.value)}
        />
        <label for="sb-key">Anon (public) key</label>
        <input
          id="sb-key"
          type="text"
          value={config.supabaseKey}
          placeholder="eyJ…"
          oninput={(e) => onSetKey(e.currentTarget.value)}
        />
      </div>
    {/if}
  </div>

  <div class="backend-option" class:selected={config.backend === "file"}>
    <label>
      <input
        type="radio"
        name="backend"
        value="file"
        checked={config.backend === "file"}
        onchange={() => onSetBackend("file")}
        disabled={!fileSupported}
      />
      <Fa icon={faFolderOpen} />
      <span class="backend-name">File / Syncthing</span>
      <span class={caps.file === "yes" ? "sync-badge sync-badge-yes" : "sync-badge sync-badge-no"}>
        {caps.file === "yes" ? "✅ Chrome/Edge" : "❌ Not here"}
      </span>
    </label>
    <p class="sub-text">
      No cloud — a file in a folder you control.
      {!fileSupported ? ` ${caps.fileNote}` : " Needs Chrome or Edge on a desktop."}
    </p>
    <button type="button" class="learn-more" onclick={() => toggle("file")}>
      <Fa icon={expanded === "file" ? faChevronUp : faChevronDown} />
      {expanded === "file" ? "Hide details" : "Learn more"}
    </button>
    {#if expanded === "file"}
      <div class="backend-detail">
        <p>
          <strong>How it works:</strong> 1) click "Choose folder" and pick any folder (e.g. a "Sync" folder),
          2) install Syncthing and share that folder between your computers, 3) each device reads and
          writes the same encrypted file.
        </p>
        <p>
          <strong>Privacy:</strong> nothing touches a server you don't control. The file is encrypted,
          so the folder is safe to sync through Dropbox / Google Drive too.
        </p>
      </div>
    {/if}
    {#if config.backend === "file"}
      <SimpleButton secondary onclick={onChooseFolder}>
        <Fa icon={faFolderOpen} /> Choose folder
      </SimpleButton>
    {/if}
  </div>
</section>
