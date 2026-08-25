<script lang="ts">
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import Fa from "svelte-fa";
  import { faListCheck } from "@fortawesome/free-solid-svg-icons";
  import type { Settings } from "../types/model.js";
  import { PAGE_SIZES } from "../services/settings-utils.js";

  let {
    settings,
    save,
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
  } = $props();
</script>

<section class="card">
  <h3><Fa icon={faListCheck} /> Playlist Manager</h3>
  <div class="toggle-row">
    <div class="toggle-info">
      <span>Open editor after creation</span>
      <span class="sub-text">Instead of playing the playlist immediately</span>
    </div>
    <ToggleSwitch
      checked={settings?.openPlaylistEditorAfterCreation ?? false}
      onchange={(val) => {
        if (settings) settings!.openPlaylistEditorAfterCreation = val;
        save("openPlaylistEditorAfterCreation", val);
      }}
    />
  </div>

  <div class="field">
    <label for="addToLatestPosition">Add to latest playlist position</label>
    <p class="sub-text">Where to add new videos in the latest playlist</p>
    <select
      id="addToLatestPosition"
      bind:value={settings!.addToLatestPosition}
      onchange={() => save("addToLatestPosition", settings?.addToLatestPosition)}
    >
      <option value="bottom">Bottom (End of playlist)</option>
      <option value="top">Top (Beginning of playlist)</option>
    </select>
  </div>

  <div class="field">
    <label for="defaultEditorPage">Default page when opening</label>
    <select
      id="defaultEditorPage"
      bind:value={settings!.defaultEditorPage}
      onchange={() => save("defaultEditorPage", settings?.defaultEditorPage)}
    >
      <option value="/new">New playlist</option>
      <option value="/saved">Saved playlists</option>
    </select>
  </div>

  <div class="field">
    <label for="defaultPageSize">Videos per page</label>
    <select
      id="defaultPageSize"
      bind:value={settings!.defaultPageSize}
      onchange={() => save("defaultPageSize", settings?.defaultPageSize)}
    >
      {#each PAGE_SIZES as size}
        <option value={size}>{size}</option>
      {/each}
    </select>
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Disable thumbnails</span>
      <span class="sub-text">Hide video previews to save bandwidth</span>
    </div>
    <ToggleSwitch
      checked={settings?.disableThumbnails ?? false}
      onchange={(val) => {
        if (settings) settings!.disableThumbnails = val;
        save("disableThumbnails", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Auto-remove duplicates</span>
      <span class="sub-text">Skip duplicate videos when adding to a playlist</span>
    </div>
    <ToggleSwitch
      checked={settings?.autoRemoveDuplicates ?? false}
      onchange={(val) => {
        if (settings) settings!.autoRemoveDuplicates = val;
        save("autoRemoveDuplicates", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Auto-remove empty playlists</span>
      <span class="sub-text"
        >Automatically delete local or synced playlists if all their videos are deleted</span
      >
    </div>
    <ToggleSwitch
      checked={settings?.autoDeleteEmptyPlaylists ?? false}
      onchange={(val) => {
        if (settings) settings!.autoDeleteEmptyPlaylists = val;
        save("autoDeleteEmptyPlaylists", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Auto-save changes</span>
      <span class="sub-text"
        >Automatically save playlist edits after a delay. When off, use the Refresh button to save
        manually.</span
      >
    </div>
    <ToggleSwitch
      checked={settings?.autoSaveEditor ?? false}
      onchange={(val) => {
        if (settings) settings!.autoSaveEditor = val;
        save("autoSaveEditor", val);
      }}
    />
  </div>

  {#if settings?.autoSaveEditor}
    <div class="field">
      <label for="autoSaveInterval">Auto-save delay</label>
      <p class="sub-text">How long to wait after your last edit before saving automatically.</p>
      <select
        id="autoSaveInterval"
        bind:value={settings!.autoSaveInterval}
        onchange={() => save("autoSaveInterval", settings?.autoSaveInterval)}
      >
        <option value={1}>1 second</option>
        <option value={2}>2 seconds</option>
        <option value={5}>5 seconds</option>
        <option value={10}>10 seconds</option>
        <option value={30}>30 seconds</option>
        <option value={60}>1 minute</option>
      </select>
    </div>
  {/if}
</section>
