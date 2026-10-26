<script lang="ts">
  import Fa from "svelte-fa";
  import { faInfoCircle, faPlayCircle } from "@fortawesome/free-solid-svg-icons";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import SimpleButton from "./SimpleButton.svelte";
  import Modal from "./Modal.svelte";
  import type { Settings } from "../types/model.js";

  const browser = (window as any).browser || (window as any).chrome;

  let {
    settings,
    save,
    showPlayAllInfo = $bindable(false),
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
    showPlayAllInfo: boolean;
  } = $props();
</script>

<!-- System Info -->
<section class="card info-card">
  <div class="info-header">
    <Fa icon={faInfoCircle} />
    <h4>System Info</h4>
  </div>
  <div class="info-content">
    <div class="info-row">
      <span>Version</span>
      <strong>v{browser.runtime.getManifest().version}</strong>
    </div>
    <div class="info-row">
      <span>Environment</span>
      <strong>Manifest V3</strong>
    </div>
  </div>
</section>

<!-- Playback -->
{#if settings}
  <section class="card">
    <h3><Fa icon={faPlayCircle} /> Playback</h3>
    <div class="toggle-row">
      <div class="toggle-info">
        <span>Open YouTube playlist page</span>
        <span class="sub-text">When playing, use the official page instead of anonymous play</span>
      </div>
      <ToggleSwitch
        checked={settings.openPlaylistPage ?? false}
        onchange={(val) => {
          settings!.openPlaylistPage = val;
          save("openPlaylistPage", val);
        }}
      />
    </div>

    <div class="toggle-row">
      <div class="toggle-info">
        <span>Split into multiple tabs</span>
        <span class="sub-text">Open large playlists across multiple tabs instead of one</span>
      </div>
      <ToggleSwitch
        checked={settings.playAllChunkEnabled ?? false}
        onchange={(val) => {
          settings!.playAllChunkEnabled = val;
          save("playAllChunkEnabled", val);
        }}
      />
    </div>

    <div class="field">
      <div class="label-with-info">
        <label for="playAllChunkSize">Videos per tab</label>
        <button
          class="info-icon-btn"
          onclick={() => (showPlayAllInfo = true)}
          title="Learn about video limits for signed-in vs guest users"
          aria-label="Show information about play all video limits"
        >
          <Fa icon={faInfoCircle} />
        </button>
      </div>
      <p class="sub-text">Maximum number of videos per tab.</p>
      <div class="number-input-group">
        <input
          aria-label="Play All Chunk Size"
          id="playAllChunkSize"
          type="number"
          min="1"
          max="500"
          step="1"
          bind:value={settings!.playAllChunkSize}
          onblur={() => save("playAllChunkSize", settings.playAllChunkSize)}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              save("playAllChunkSize", settings.playAllChunkSize);
            }
          }}
        />
      </div>
    </div>
  </section>
{/if}

<Modal
  bind:display={showPlayAllInfo}
  title="Play All Video Limits"
  onclose={() => (showPlayAllInfo = false)}
>
  <div class="info-scroll">
    <div class="info-section signed-in">
      <div class="section-header">
        <span class="section-badge">Signed In</span>
      </div>
      <p class="section-text">
        No video limit per tab. All videos can load in a single tab, giving you the best playback
        experience.
      </p>
    </div>

    <div class="info-section guest">
      <div class="section-header">
        <span class="section-badge guest-badge">Guest User</span>
      </div>
      <p class="section-text">
        YouTube enforces a limit of approximately <strong>50 videos per tab</strong>
        regardless of your extension settings. This is a YouTube server-side restriction and cannot be
        bypassed.
      </p>
    </div>

    <div class="info-note">
      <Fa icon={faInfoCircle} />
      <p>These limits apply when using the "Play All" feature to open your playlist on YouTube.</p>
    </div>
  </div>

  {#snippet footer()}
    <div class="modal-footer">
      <SimpleButton primary onclick={() => (showPlayAllInfo = false)}>Got it</SimpleButton>
    </div>
  {/snippet}
</Modal>

<style>
  .card {
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .info-card {
    background: rgba(62, 166, 255, 0.08);
    border-color: var(--primary-color);
  }

  .info-header,
  .card h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color);
  }

  .info-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color);
  }

  .toggle-row:last-child {
    border-bottom: none;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sub-text {
    font-size: 13px;
    color: var(--text-muted);
  }

  .field {
    margin-top: 16px;
  }

  .label-with-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .label-with-info label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }

  .info-icon-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--text-muted);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .info-icon-btn:hover {
    background: var(--hover-color);
    color: var(--primary-color);
  }

  .number-input-group input {
    width: 100%;
    max-width: 120px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--background-color);
    color: var(--text-color);
    font-size: 14px;
  }

  /* Modal styles */
  .info-scroll {
    max-height: 50vh;
    overflow-y: auto;
    font-size: 14px;
    line-height: 1.6;
    padding-right: 10px;
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
</style>
