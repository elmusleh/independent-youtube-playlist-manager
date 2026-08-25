<script lang="ts">
  import Fa from "svelte-fa";
  import { faCopy, faPlus, faCut, faInfoCircle, faCode } from "@fortawesome/free-solid-svg-icons";
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
      notificationText = "Copied !";
      setTimeout(() => (notificationText = ""), 2000);
      onExport();
    }
  }
</script>

<Modal bind:display>
  {#if modalType === "Export"}
    <div class="modal-container">
      <h3>Export Video URLs</h3>
      <textarea bind:value={exportText} bind:this={exportTextArea} readonly></textarea>
      <div class="modal-footer">
        <SimpleButton onclick={handleExport} secondary>
          <Fa icon={faCopy} fw />
          <span>Copy to Clipboard</span>
        </SimpleButton>
        <span class="notification">{notificationText}</span>
      </div>
    </div>
  {:else if modalType === "Import"}
    <div class="modal-container">
      <h3>Import Videos</h3>
      <textarea
        bind:value={importText}
        placeholder="Paste one or more YouTube URLs or Video IDs here (one per line)…"></textarea>
      <div class="import-footer">
        <div class="import-options">
          <label class="check-label">
            <input aria-label="Add to top" type="checkbox" bind:checked={importAtTop} />
            <span>Add to top of playlist</span>
          </label>
        </div>
        <div class="modal-footer">
          <SimpleButton onclick={onImport} primary>
            <Fa icon={faPlus} fw />
            <span>Import Video(s)</span>
          </SimpleButton>
        </div>
      </div>
    </div>
  {:else if modalType === "CopyMove"}
    <div class="modal-container">
      <h3>Copy/Move Videos</h3>
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

      <div class="modal-footer">
        <SimpleButton onclick={() => (display = false)} secondary>
          <span>Cancel</span>
        </SimpleButton>
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
    </div>
  {:else if modalType === "PlayAllInfo"}
    <div class="modal-container info-modal">
      <h3>About Temporary Playlists</h3>
      <div class="info-scroll">
        <p>
          Because this playlist is generated on the fly, it will always default to <strong
            >"Untitled List"</strong
          > on YouTube.
        </p>
        <ul>
          <li>
            <strong>Ephemeral:</strong> Queue URLs expire periodically. Share the base generator link
            instead.
          </li>
          <li>
            <strong>No Privacy Controls:</strong> Concept does not apply to anonymous queues.
          </li>
          <li>
            <strong>Locked Order:</strong> Once generated, the order is fixed in the URL.
          </li>
        </ul>
      </div>
      <div class="modal-footer">
        <SimpleButton onclick={() => (display = false)} primary>
          <span>Got it!</span>
        </SimpleButton>
      </div>
    </div>
  {:else if modalType === "ScrapeHtml"}
    <div class="modal-container">
      <h3>Scrape YouTube Links from HTML</h3>
      <textarea
        bind:value={htmlText}
        placeholder="Paste the HTML content of a webpage here. The tool will extract all YouTube video links and add them to your playlist."
      ></textarea>
      <div class="modal-footer">
        <SimpleButton onclick={() => (display = false)} secondary>
          <span>Cancel</span>
        </SimpleButton>
        <SimpleButton onclick={onScrapeHtml} primary>
          <Fa icon={faCode} fw />
          <span>Scrape Links</span>
        </SimpleButton>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .modal-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px;
  }

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    text-align: center;
  }

  textarea {
    width: 100%;
    min-height: 350px;
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

  .modal-footer {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
    position: relative;
  }

  .notification {
    position: absolute;
    right: 0;
    color: var(--success-color, #43a047);
    font-size: 13px;
    font-weight: 600;
  }

  .import-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
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

  @media (max-width: 600px) {
    .import-footer,
    .radio-group,
    .dest-options {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
