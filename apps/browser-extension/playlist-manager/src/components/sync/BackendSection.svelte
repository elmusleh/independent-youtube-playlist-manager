<script lang="ts">
  import Fa from "svelte-fa";
  import { faCloud, faServer, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
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
    {#if config.backend === "file"}
      <SimpleButton secondary onclick={onChooseFolder}>
        <Fa icon={faFolderOpen} /> Choose folder
      </SimpleButton>
    {/if}
  </div>
</section>
