<script lang="ts">
  import Fa from "svelte-fa";
  import { faInfoCircle, faPlayCircle } from "@fortawesome/free-solid-svg-icons";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import SimpleButton from "./SimpleButton.svelte";
  import type { Settings } from "../types/model.js";

  const browser = (window as any).browser || (window as any).chrome;

  let {
    settings,
    save,
    showPlayAllInfo,
    setShowPlayAllInfo,
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
    showPlayAllInfo: boolean;
    setShowPlayAllInfo: (val: boolean) => void;
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
          onclick={() => setShowPlayAllInfo(true)}
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

{#if showPlayAllInfo}
  <div
    class="modal-overlay"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) setShowPlayAllInfo(false);
    }}
    role="presentation"
  >
    <div
      class="modal-content info-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="play-all-title"
    >
      <div class="modal-header">
        <h3 id="play-all-title">
          <Fa icon={faPlayCircle} /> Play All Video Limits
        </h3>
        <button
          class="close-btn"
          onclick={() => setShowPlayAllInfo(false)}
          aria-label="Close dialog"
          title="Close (Esc)"
        >
          ×
        </button>
      </div>

      <div class="modal-body-content">
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
            YouTube enforces a limit of approximately <strong>50 videos per tab</strong> regardless of
            your extension settings?. This is a YouTube server-side restriction and cannot be bypassed.
          </p>
        </div>

        <div class="info-note">
          <Fa icon={faInfoCircle} />
          <p>
            These limits apply when using the "Play All" feature to open your playlist on YouTube.
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <SimpleButton primary onclick={() => setShowPlayAllInfo(false)}>Got it</SimpleButton>
      </div>
    </div>
  </div>
{/if}

<style>
  @import "../views/settings.css";
</style>
