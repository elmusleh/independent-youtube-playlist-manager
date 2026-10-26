<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faFileExport,
    faCodeMerge,
    faCloudArrowDown,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import ProgressBar from "../ProgressBar.svelte";
  import Modal from "../Modal.svelte";

  let {
    // Merge Modal
    showMerge = $bindable(false),
    mergeTitle = $bindable(""),
    mergeTargetId = $bindable("new"),
    selectedPlaylists = [],
    onExecuteMerge,

    // Save Offline Modal
    showSaveOffline = $bindable(false),
    offlinePlaylists = [],
    offlineSaveMode = $bindable({}),
    offlineTitles = $bindable({}),
    onExecuteSaveOffline,
    onModeChange,

    // Progress Modal
    prog = $bindable({}),
    progressPct = 0,
    elapsedDisplay = "0:00",
    etaDisplay = "—",

    // Export Selection
    showExport = $bindable(false),
    selectedCount = $bindable(0),
    onExecuteExport,
  }: {
    showMerge: boolean;
    mergeTitle: string;
    mergeTargetId: string;
    selectedPlaylists: any[];
    onExecuteMerge: () => void;

    showSaveOffline: boolean;
    offlinePlaylists: any[];
    offlineSaveMode: any;
    offlineTitles: any;
    onExecuteSaveOffline: () => void;
    onModeChange: (ytId: string, mode: "new" | "sync" | "skip") => void;

    prog: any;
    progressPct: number;
    elapsedDisplay: string;
    etaDisplay: string;

    showExport: boolean;
    selectedCount: number;
    onExecuteExport: () => void;
  } = $props();

  let mergeRawTotal = $derived(selectedPlaylists.reduce((s, p) => s + (p.videoCount || 0), 0));
</script>

{#if showMerge}
  <Modal bind:display={showMerge} title="Merge Playlists" onclose={() => (showMerge = false)}>
    <p class="dialog-msg">
      Merge {selectedPlaylists.length} playlists into one. This will accumulate
      <strong>~{mergeRawTotal}</strong> videos before de-duplication.
    </p>

    <div class="field-group">
      <label class="field-label" for="merge-target">Destination</label>
      <select id="merge-target" bind:value={mergeTargetId} class="text-input">
        <option value="new">Create New Playlist</option>
        {#each selectedPlaylists as p}
          <option value={p.id}>Append to: {p.title}</option>
        {/each}
      </select>
    </div>

    {#if mergeTargetId === "new"}
      <div class="field-group">
        <label class="field-label" for="merge-title">New Playlist Title</label>
        <input
          id="merge-title"
          type="text"
          class="text-input"
          bind:value={mergeTitle}
          placeholder="Combined Playlist"
        />
      </div>
    {/if}

    {#snippet footer()}
      <div class="dialog-actions">
        <SimpleButton secondary onclick={() => (showMerge = false)}>Cancel</SimpleButton>
        <SimpleButton primary onclick={onExecuteMerge}>
          <Fa icon={faCodeMerge} fw />
          <span>Merge Now</span>
        </SimpleButton>
      </div>
    {/snippet}
  </Modal>
{/if}

{#if showSaveOffline}
  <Modal
    bind:display={showSaveOffline}
    title="Save YouTube Playlists Offline"
    size="wide"
    onclose={() => (showSaveOffline = false)}
  >
    <p class="dialog-msg">Select how you want to save these playlists to your local storage.</p>

    <div class="offline-playlist-list">
      {#each offlinePlaylists as { yt, local }}
        <div class="offline-playlist-item">
          <div class="offline-playlist-info">
            <span class="offline-playlist-title">{yt.title}</span>
            <span class="offline-playlist-meta">{yt.videoCount} videos • {yt.privacyStatus}</span>
          </div>
          <div class="offline-playlist-options">
            {#if local}
              <label class="radio-label">
                <input
                  type="radio"
                  value="sync"
                  bind:group={offlineSaveMode[yt.id]}
                  onchange={() => onModeChange(yt.id, "sync")}
                />
                Sync with existing: "{local.title}"
              </label>
            {/if}
            <label class="radio-label">
              <input
                type="radio"
                value="new"
                bind:group={offlineSaveMode[yt.id]}
                onchange={() => onModeChange(yt.id, "new")}
              />
              Save as new local playlist
            </label>
            {#if offlineSaveMode[yt.id] === "new"}
              <input
                type="text"
                class="text-input offline-title-input"
                bind:value={offlineTitles[yt.id]}
                placeholder="Local Title"
              />
            {/if}
            <label class="radio-label">
              <input
                type="radio"
                value="skip"
                bind:group={offlineSaveMode[yt.id]}
                onchange={() => onModeChange(yt.id, "skip")}
              />
              Skip this playlist
            </label>
          </div>
        </div>
      {/each}
    </div>

    {#snippet footer()}
      <div class="dialog-actions">
        <SimpleButton secondary onclick={() => (showSaveOffline = false)}>Cancel</SimpleButton>
        <SimpleButton primary onclick={onExecuteSaveOffline}>
          <Fa icon={faCloudArrowDown} fw />
          <span>Save Offline</span>
        </SimpleButton>
      </div>
    {/snippet}
  </Modal>
{/if}

{#if prog.active}
  <Modal
    display={prog.active}
    onclose={() => (prog.active = false)}
    dismissible={!!(prog.done || prog.error)}
    title={prog.title || "Working"}
    showHeader
  >
    <p class="dialog-msg">{prog.message || "Working..."}</p>

    <div class="prog-container">
      <ProgressBar progress={progressPct} />
      <div class="prog-meta">
        <span>{prog.current} / {prog.total} items</span>
        <span>{progressPct}%</span>
      </div>
      <div class="prog-meta">
        <span>Elapsed: {elapsedDisplay}</span>
        <span>ETA: {etaDisplay}</span>
      </div>
    </div>

    {#if prog.error}
      <p class="dialog-error">{prog.error}</p>
    {/if}

    {#snippet footer()}
      {#if prog.done || prog.error}
        <div class="dialog-actions">
          <SimpleButton primary onclick={() => (prog.active = false)}>Done</SimpleButton>
        </div>
      {/if}
    {/snippet}
  </Modal>
{/if}

{#if showExport}
  <Modal bind:display={showExport} title="Export Videos" onclose={() => (showExport = false)}>
    <p class="dialog-msg">
      Export <strong>{selectedCount}</strong> video{selectedCount !== 1 ? "s" : ""}?
    </p>

    {#snippet footer()}
      <div class="dialog-actions">
        <SimpleButton secondary onclick={() => (showExport = false)}>Cancel</SimpleButton>
        <SimpleButton primary onclick={onExecuteExport}>
          <Fa icon={faFileExport} fw />
          <span>Export</span>
        </SimpleButton>
      </div>
    {/snippet}
  </Modal>
{/if}

<style>
  .dialog-msg {
    margin: 0;
    font-size: 14px;
    color: var(--text-color);
    line-height: 1.6;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  }

  .field-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
  }

  .text-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--background-color);
    color: var(--text-color);
    font-size: 14px;
    box-sizing: border-box;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .offline-playlist-list {
    max-height: 350px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 8px;
  }

  .offline-playlist-item {
    background: var(--hover-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
  }

  .offline-playlist-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .offline-playlist-title {
    font-weight: 500;
    color: var(--text-color);
  }

  .offline-playlist-meta {
    font-size: 13px;
    color: var(--text-muted);
  }

  .offline-playlist-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    cursor: pointer;
  }

  .offline-title-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--background-color);
    color: var(--text-color);
    font-size: 14px;
    box-sizing: border-box;
  }

  .dialog-error {
    color: #f44336;
    background: rgba(244, 67, 54, 0.1);
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    margin-top: 16px;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  .prog-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }

  .prog-meta {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }
</style>
