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
  import type { SyncConfig, SyncBackend } from "../../services/sync/sync-config.js";
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

  let expanded = $state<string | null>(null);
  function toggle(id: string) {
    expanded = expanded === id ? null : id;
  }
</script>

<section class="card">
  <h3><Fa icon={faCloud} /> How your data travels</h3>
  <p class="sub-text">
    Pick where your encrypted data lives. Every option is end-to-end encrypted.
  </p>

  <div class="backend-option" class:selected={config.backend === "relay"}>
    <label>
      <input
        type="radio"
        name="backend"
        value="relay"
        checked={config.backend === "relay"}
        onchange={() => onSetBackend("relay")}
      />
      <Fa icon={faCloud} />
      <span class="backend-name">Recommended (IYPM hosted)</span>
      <span class="sync-badge sync-badge-yes">✅ Works here</span>
    </label>
    <p class="sub-text">
      Easiest. Uses IYPM's hosted sync service. Nothing but encrypted data is stored.
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
      <span class="sync-badge sync-badge-yes">✅ Works here</span>
    </label>
    <p class="sub-text">
      Free tier. You supply the project; the extension stores only encrypted data.
    </p>
    <button type="button" class="learn-more" onclick={() => toggle("supabase-byo")}>
      <Fa icon={expanded === "supabase-byo" ? faChevronUp : faChevronDown} />
      {expanded === "supabase-byo" ? "Hide details" : "Learn more"}
    </button>
    {#if expanded === "supabase-byo"}
      <div class="backend-detail">
        <p>
          <strong>Where your data goes:</strong> same encryption. The encrypted blob is uploaded to your
          own Supabase project (a free-tier database you control).
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
        {caps.file === "yes" ? "✅ Works" : "❌ Not available"}
      </span>
    </label>
    <p class="sub-text">
      Your own files, no account. A tool like Syncthing moves the file between devices.
      {!fileSupported ? ` ${caps.fileNote}` : ""}
    </p>
    <button type="button" class="learn-more" onclick={() => toggle("file")}>
      <Fa icon={expanded === "file" ? faChevronUp : faChevronDown} />
      {expanded === "file" ? "Hide details" : "Learn more"}
    </button>
    {#if expanded === "file"}
      <div class="backend-detail">
        <p>
          <strong>Where your data goes:</strong> the encrypted blob is written as a single file in a folder
          you choose on this device.
        </p>
        <p>
          <strong>Privacy:</strong> nothing touches a server you don't control. Use Syncthing (or Dropbox
          / Google Drive) to move that file between your devices — each device reads and writes the same
          file.
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
