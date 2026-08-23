<script lang="ts">
  import Fa from "svelte-fa";
  import { 
    faFileExport, 
    faCodeMerge, 
    faCloudArrowDown,
    faTrash,
    faXmark
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import ProgressBar from "../ProgressBar.svelte";

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
    onExecuteExport
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
    onExecuteExport: () => void;
  } = $props();

  let mergeRawTotal = $derived(selectedPlaylists.reduce((s, p) => s + (p.videoCount || 0), 0));
</script>

{#if showMerge}
  <div class="overlay" onclick={() => (showMerge = false)} onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showMerge = false)} role="button" tabindex="-1" aria-label="Close dialog">
    <div class="dialog" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <h3 class="dialog-title">Merge Playlists</h3>
      <p class="dialog-msg">
        Merge {selectedPlaylists.length} playlists into one. This will accumulate <strong>~{mergeRawTotal}</strong> videos before de-duplication.
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

      {#if mergeTargetId === 'new'}
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

      <div class="dialog-actions">
        <SimpleButton secondary onclick={() => (showMerge = false)}>Cancel</SimpleButton>
        <SimpleButton primary onclick={onExecuteMerge}>
          <Fa icon={faCodeMerge} fw />
          <span>Merge Now</span>
        </SimpleButton>
      </div>
    </div>
  </div>
{/if}

{#if showSaveOffline}
  <div class="overlay" onclick={() => (showSaveOffline = false)} onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showSaveOffline = false)} role="button" tabindex="-1" aria-label="Close dialog">
    <div class="dialog large" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <h3 class="dialog-title">Save YouTube Playlists Offline</h3>
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
                  <input type="radio" value="sync" bind:group={offlineSaveMode[yt.id]} onchange={() => onModeChange(yt.id, 'sync')} />
                  Sync with existing: "{local.title}"
                </label>
              {/if}
              <label class="radio-label">
                <input type="radio" value="new" bind:group={offlineSaveMode[yt.id]} onchange={() => onModeChange(yt.id, 'new')} />
                Save as new local playlist
              </label>
              {#if offlineSaveMode[yt.id] === 'new'}
                <input type="text" class="text-input offline-title-input" bind:value={offlineTitles[yt.id]} placeholder="Local Title" />
              {/if}
              <label class="radio-label">
                <input type="radio" value="skip" bind:group={offlineSaveMode[yt.id]} onchange={() => onModeChange(yt.id, 'skip')} />
                Skip this playlist
              </label>
            </div>
          </div>
        {/each}
      </div>

      <div class="dialog-actions">
        <SimpleButton secondary onclick={() => (showSaveOffline = false)}>Cancel</SimpleButton>
        <SimpleButton primary onclick={onExecuteSaveOffline}>
          <Fa icon={faCloudArrowDown} fw />
          <span>Save Selected</span>
        </SimpleButton>
      </div>
    </div>
  </div>
{/if}

{#if prog.active}
  <div class="overlay prog-dialog" role="presentation">
    <div class="dialog" role="dialog">
      <h3 class="dialog-title">{prog.title}</h3>
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

      {#if prog.done || prog.error}
        <div class="dialog-actions">
          <SimpleButton primary onclick={() => (prog.active = false)}>Close</SimpleButton>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @import "../../css/view-layout.css";

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 20px;
    backdrop-filter: blur(8px);
  }

  .dialog {
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 32px;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .dialog.large {
    max-width: 600px;
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

  .text-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--background-color);
    color: var(--text-color);
  }

  .dialog-error {
    color: #f44336;
    background: rgba(244, 67, 54, 0.1);
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }
</style>
