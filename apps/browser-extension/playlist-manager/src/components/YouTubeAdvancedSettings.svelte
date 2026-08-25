<script lang="ts">
  import Fa from "svelte-fa";
  import { faPlayCircle, faMicrochip } from "@fortawesome/free-solid-svg-icons";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import type { Settings } from "../types/model.js";
  import { CACHE_DURATIONS } from "../services/settings-utils.js";

  let {
    settings,
    save,
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
  } = $props();
</script>

<!-- YouTube Features -->
<section class="card">
  <h3><Fa icon={faPlayCircle} /> YouTube Features</h3>
  <p class="sub-text">
    Enable additional data fetching from your YouTube account. Disabling these hides them from the
    sidebar.
  </p>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Liked Videos</span>
      <span class="sub-text">Show your Liked Videos in the sidebar</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableLikedVideos}
      onchange={(val) => {
        settings!.enableLikedVideos = val;
        save("enableLikedVideos", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Uploaded Videos</span>
      <span class="sub-text">Show your Uploaded Videos in the sidebar</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableUploadedVideos}
      onchange={(val) => {
        settings!.enableUploadedVideos = val;
        save("enableUploadedVideos", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Subscriptions</span>
      <span class="sub-text">Show your Channel Subscriptions in the sidebar</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableSubscriptions}
      onchange={(val) => {
        settings!.enableSubscriptions = val;
        save("enableSubscriptions", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Recent Activities</span>
      <span class="sub-text">Show your recent YouTube activities in the sidebar</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableActivities}
      onchange={(val) => {
        settings!.enableActivities = val;
        save("enableActivities", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Comments</span>
      <span class="sub-text">Show your recent comments in the sidebar</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableComments}
      onchange={(val) => {
        settings!.enableComments = val;
        save("enableComments", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Search</span>
      <span class="sub-text">Search for YouTube videos directly from the sidebar</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableSearch}
      onchange={(val) => {
        settings!.enableSearch = val;
        save("enableSearch", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable My Account Playlists</span>
      <span class="sub-text">Show a dedicated button for your YouTube account playlists</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableAccountPlaylists}
      onchange={(val) => {
        settings!.enableAccountPlaylists = val;
        save("enableAccountPlaylists", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Watch Later</span>
      <span class="sub-text">Show a direct button for the system Watch Later playlist</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableWatchLater}
      onchange={(val) => {
        settings!.enableWatchLater = val;
        save("enableWatchLater", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Open by ID</span>
      <span class="sub-text">Quickly open any YouTube playlist by its ID or URL</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableOpenById}
      onchange={(val) => {
        settings!.enableOpenById = val;
        save("enableOpenById", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable My Channel</span>
      <span class="sub-text">Show your YouTube channel information and stats</span>
    </div>
    <ToggleSwitch
      checked={settings?.enableMyChannel}
      onchange={(val) => {
        settings!.enableMyChannel = val;
        save("enableMyChannel", val);
      }}
    />
  </div>
</section>

<!-- Advanced & Cache -->
<section class="card">
  <h3><Fa icon={faMicrochip} /> Advanced & Cache</h3>
  <div class="field">
    <label for="defaultPrivacy">Default YouTube Privacy</label>
    <p class="sub-text">Privacy setting for newly synced playlists</p>
    <select
      id="defaultPrivacy"
      bind:value={settings!.defaultPrivacy}
      onchange={() => save("defaultPrivacy", settings?.defaultPrivacy)}
    >
      <option value="private">Private (Only you)</option>
      <option value="unlisted">Unlisted (Anyone with link)</option>
      <option value="public">Public (Everyone)</option>
    </select>
  </div>

  <div class="field checkbox-field">
    <div class="checkbox-label">
      <label for="autoRetryEnabled">Auto-retry sync after quota reset</label>
      <p class="sub-text">
        Automatically resume playlist sync 24 hours after hitting API quota limit. Disable if you
        prefer to manually click Sync to resume.
      </p>
    </div>
    <ToggleSwitch
      checked={settings?.autoRetryEnabled}
      onchange={(val) => {
        settings!.autoRetryEnabled = val;
        save("autoRetryEnabled", val);
      }}
    />
  </div>

  <div class="field">
    <label for="cacheDuration">Cache duration</label>
    <p class="sub-text">How long playlist data is cached before refreshing.</p>
    <select
      id="cacheDuration"
      bind:value={settings!.cacheDuration}
      onchange={() => {
        if (settings) {
          save("cacheDuration", settings?.cacheDuration, () => {
            window.invalidateCacheAndNotify();
          });
        }
      }}
    >
      {#each CACHE_DURATIONS as duration}
        <option value={duration.value}>{duration.label}</option>
      {/each}
    </select>
  </div>

  <div class="field">
    <label for="maxLogLines">Max log lines stored</label>
    <input
      aria-label="Max log lines stored"
      id="maxLogLines"
      type="number"
      min="10"
      max="10000"
      bind:value={settings!.maxLogLines}
      onchange={() => settings && save("maxLogLines", Number(settings?.maxLogLines))}
    />
  </div>
</section>
