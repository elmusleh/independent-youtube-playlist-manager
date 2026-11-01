<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faCopy,
    faPlus,
    faCut,
    faInfoCircle,
    faCode,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import Modal from "../Modal.svelte";
  import SimpleButton from "../SimpleButton.svelte";
  import type { Playlist } from "../../types/model";

  let {
    display = $bindable(false),
    modalType = $bindable(null),
    importText = $bindable(""),
    exportText = $bindable(""),
    htmlText = $bindable(""),
    importAtTop = $bindable(false),
    selectedCount = 0,
    copyMoveAction = $bindable("copy"),
    copyMoveCreateNew = $bindable(false),
    copyMoveTargetPlaylistId = $bindable(null),
    copyMoveNewPlaylistTitle = $bindable(""),
    copyMovePosition = $bindable("bottom"),
    copyMoveTargetPlaylists = [],
    copyMoveLoading = false,
    onImport,
    onExport,
    onScrapeHtml,
    onExecuteCopyMove,
  }: {
    display: boolean;
    modalType: string | null;
    importText: string;
    exportText: string;
    htmlText: string;
    importAtTop: boolean;
    selectedCount: number;
    copyMoveAction: "copy" | "move";
    copyMoveCreateNew: boolean;
    copyMoveTargetPlaylistId: string | null;
    copyMoveNewPlaylistTitle: string;
    copyMovePosition: "top" | "bottom";
    copyMoveTargetPlaylists: Playlist[];
    copyMoveLoading: boolean;
    onImport: () => void;
    onExport: () => void;
    onScrapeHtml: () => void;
    onExecuteCopyMove: () => void;
  } = $props();

  let exportTextArea = $state<HTMLTextAreaElement>();
  let notificationText = $state("");

  function handleExport() {
    if (exportTextArea) {
      exportTextArea.select();
      exportTextArea.setSelectionRange(0, 99999);
      document.execCommand("copy");
      notificationText = "Copied!";
      setTimeout(() => (notificationText = ""), 2000);
      onExport();
    }
  }
</script>

{#if display}
  {#if modalType === "Export"}
    <Modal bind:display title="Export Video URLs" size="wide" onclose={onExport}>
      <textarea bind:value={exportText} bind:this={exportTextArea} readonly class="export-textarea"
      ></textarea>
      {#if notificationText}
        <p class="notification">{notificationText}</p>
      {/if}

      {#snippet footer()}
        <div class="modal-footer">
          <SimpleButton secondary onclick={handleExport}>
            <Fa icon={faCopy} fw />
            <span>Copy to Clipboard</span>
          </SimpleButton>
        </div>
      {/snippet}
    </Modal>
  {:else if modalType === "Import"}
    <Modal bind:display title="Import Videos" size="wide" onclose={() => (display = false)}>
      <textarea
        bind:value={importText}
        class="input-textarea"
        placeholder="Paste one or more YouTube URLs or Video IDs here (one per line)…"></textarea>

      <div class="import-options">
        <label class="check-label">
          <input aria-label="Add to top" type="checkbox" bind:checked={importAtTop} />
          <span>Add to top of playlist</span>
        </label>
      </div>

      {#snippet footer()}
        <div class="modal-footer">
          <SimpleButton onclick={onImport} primary>
            <Fa icon={faPlus} fw />
            <span>Import Video(s)</span>
          </SimpleButton>
        </div>
      {/snippet}
    </Modal>
  {:else if modalType === "CopyMove"}
    <Modal bind:display title="Copy/Move Videos" size="wide" onclose={() => (display = false)}>
      <p class="count-info">
        {selectedCount} video{selectedCount !== 1 ? "s" : ""} selected
      </p>

      <div class="form-body">
        <div class="form-group">
          <span class="label">Action</span>
          <div class="radio-group" role="radiogroup">
            <label class="radio-label">
              <input type="radio" bind:group={copyMoveAction} value="copy" />
              <span>Copy</span>
            </label>
            <label class="radio-label">
              <input type="radio" bind:group={copyMoveAction} value="move" />
              <span>Move</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <span class="label">Destination</span>
          <div class="dest-options">
            <label class="radio-label">
              <input type="radio" bind:group={copyMoveCreateNew} value={false} />
              <span>Existing playlist</span>
            </label>
            <label class="radio-label">
              <input type="radio" bind:group={copyMoveCreateNew} value={true} />
              <span>Create new playlist</span>
            </label>
          </div>

          {#if !copyMoveCreateNew}
            <select class="dest-select" bind:value={copyMoveTargetPlaylistId}>
              <option value={null} disabled>Select a playlist...</option>
              {#each copyMoveTargetPlaylists as p}
                <option value={p.id}>{p.title}</option>
              {/each}
            </select>
          {:else}
            <input
              type="text"
              class="new-input"
              placeholder="Enter new playlist name..."
              bind:value={copyMoveNewPlaylistTitle}
            />
          {/if}
        </div>

        {#if !copyMoveCreateNew}
          <div class="form-group">
            <span class="label">Position</span>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" bind:group={copyMovePosition} value="top" />
                <span>Add to top</span>
              </label>
              <label class="radio-label">
                <input type="radio" bind:group={copyMovePosition} value="bottom" />
                <span>Add to bottom</span>
              </label>
            </div>
          </div>
        {/if}
      </div>

      {#snippet footer()}
        <div class="modal-footer">
          <SimpleButton secondary onclick={() => (display = false)}>Cancel</SimpleButton>
          <SimpleButton
            onclick={onExecuteCopyMove}
            primary
            disabled={(copyMoveCreateNew && !copyMoveNewPlaylistTitle.trim()) ||
              (!copyMoveCreateNew && !copyMoveTargetPlaylistId) ||
              copyMoveLoading}
          >
            {#if copyMoveLoading}
              <span>Processing...</span>
            {:else}
              <Fa icon={copyMoveAction === "copy" ? faCopy : faCut} fw />
              <span>{copyMoveAction === "copy" ? "Copy" : "Move"}</span>
            {/if}
          </SimpleButton>
        </div>
      {/snippet}
    </Modal>
  {:else if modalType === "PlayAllInfo"}
    <Modal
      bind:display
      title="Play All Video Limits"
      size="standard"
      onclose={() => (display = false)}
    >
      <div class="info-scroll">
        <div class="info-section signed-in">
          <div class="section-header">
            <span class="section-badge">Signed In</span>
          </div>
          <p class="section-text">
            No video limit per tab. All videos can load in a single tab, giving you the best
            playback experience.
          </p>
        </div>

        <div class="info-section guest">
          <div class="section-header">
            <span class="section-badge guest-badge">Guest User</span>
          </div>
          <p class="section-text">
            YouTube enforces a limit of approximately <strong>50 videos per tab</strong>
            regardless of your extension settings. This is a YouTube server-side restriction and cannot
            be bypassed.
          </p>
        </div>

        <div class="info-note">
          <Fa icon={faInfoCircle} />
          <p>
            These limits apply when using the "Play All" feature to open your playlist on YouTube.
          </p>
        </div>
      </div>

      {#snippet footer()}
        <div class="modal-footer">
          <SimpleButton primary onclick={() => (display = false)}>Got it</SimpleButton>
        </div>
      {/snippet}
    </Modal>
  {:else if modalType === "ScrapeHtml"}
    <Modal
      bind:display
      title="Scrape YouTube Links from HTML"
      size="wide"
      onclose={() => (display = false)}
    >
      <textarea
        bind:value={htmlText}
        class="input-textarea"
        placeholder="Paste the HTML content of a webpage here. The tool will extract all YouTube video links and add them to your playlist."
      ></textarea>

      {#snippet footer()}
        <div class="modal-footer">
          <SimpleButton secondary onclick={() => (display = false)}>Cancel</SimpleButton>
          <SimpleButton primary onclick={onScrapeHtml}>
            <Fa icon={faCode} fw />
            <span>Scrape Links</span>
          </SimpleButton>
        </div>
      {/snippet}
    </Modal>
  {/if}
{/if}

<style>
  .export-textarea {
    width: 100%;
    min-height: min(240px, 35dvh);
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--hover-color);
    color: var(--text-color);
    font-family: monospace;
    font-size: 14px;
    line-height: 1.5;
    resize: vertical;
    box-sizing: border-box;
  }

  .input-textarea {
    width: 100%;
    min-height: min(200px, 35dvh);
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--hover-color);
    color: var(--text-color);
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    resize: vertical;
    box-sizing: border-box;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .input-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(62, 166, 255, 0.12);
  }

  .input-textarea::placeholder {
    color: var(--text-muted);
  }

  .notification {
    color: var(--success-color, #43a047);
    font-size: 13px;
    font-weight: 600;
    margin-top: 12px;
  }

  .import-options {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .check-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    cursor: pointer;
    user-select: none;
  }

  .check-label input {
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color);
  }

  .count-info {
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
    margin: 0;
  }

  .form-body {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    font-size: 14px;
    font-weight: 600;
  }

  .radio-group,
  .dest-options {
    display: flex;
    gap: 20px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
  }

  .radio-label input {
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color);
  }

  .dest-select,
  .new-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--hover-color);
    color: var(--text-color);
    font-size: 14px;
    box-sizing: border-box;
  }

  .info-scroll {
    max-height: 50vh;
    overflow-y: auto;
    font-size: 14px;
    line-height: 1.6;
    padding-right: 10px;
  }

  .info-scroll ul {
    padding-left: 20px;
  }

  .info-scroll li {
    margin-bottom: 12px;
  }

  .info-section {
    margin-bottom: 20px;
    padding: 16px;
    border-radius: 12px;
    background: var(--hover-color);
    border: 1px solid var(--border-color);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .section-badge {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--primary-color);
    color: white;
  }

  .guest-badge {
    background: var(--text-muted);
  }

  .section-text {
    margin: 0;
    color: var(--text-color);
  }

  .info-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(62, 166, 255, 0.1);
    border: 1px solid var(--primary-color);
    border-radius: 8px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  @media (max-width: 600px) {
    .radio-group,
    .dest-options {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
