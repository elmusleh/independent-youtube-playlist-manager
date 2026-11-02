<script lang="ts">
  import Fa from "svelte-fa";
  import { faFolderOpen, faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import type { DeviceCapabilities } from "../../services/sync/capabilities.js";

  let {
    enabled,
    caps,
    onToggle,
    onChooseFolder,
  }: {
    enabled: boolean;
    caps: DeviceCapabilities;
    onToggle: (v: boolean) => void;
    onChooseFolder: () => void;
  } = $props();

  const supported = $derived(caps.file === "yes");

  let expanded = $state(false);
</script>

<section class="card" class:enabled>
  <div class="backend-card-header">
    <Fa icon={faFolderOpen} />
    <div class="backend-card-title">
      <h3>File / Syncthing</h3>
      <span class="sub-text">
        {supported ? "Chrome / Edge desktop only" : "Not on this browser"}
      </span>
    </div>
    {#if supported}
      <input
        type="checkbox"
        checked={enabled}
        onchange={(e) => onToggle(e.currentTarget.checked)}
      />
    {:else}
      <span class="sync-badge sync-badge-no">❌ Not here</span>
    {/if}
  </div>
  <p class="sub-text">
    No cloud — a file in a folder you control. {!supported
      ? caps.fileNote
      : "Uses a folder you pick + the free Syncthing app."}
  </p>
  {#if enabled && supported}
    <SimpleButton secondary onclick={onChooseFolder}>
      <Fa icon={faFolderOpen} /> Choose folder
    </SimpleButton>
  {/if}
  <button type="button" class="learn-more" onclick={() => (expanded = !expanded)}>
    <Fa icon={expanded ? faChevronUp : faChevronDown} />
    {expanded ? "Hide" : "Learn more"}
  </button>
  {#if expanded}
    <div class="backend-detail">
      <p>
        <strong>How it works:</strong> 1) click "Choose folder" and pick any folder (e.g. a "Sync" folder),
        2) install Syncthing and share that folder between your computers, 3) each device reads and writes
        the same encrypted file.
      </p>
      <p>
        <strong>Privacy:</strong> nothing touches a server you don't control. The file is encrypted, so
        the folder is safe to sync through Dropbox / Google Drive too.
      </p>
    </div>
  {/if}
</section>
