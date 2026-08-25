<script lang="ts">
  import Fa from "svelte-fa";
  import { faBolt, faMousePointer } from "@fortawesome/free-solid-svg-icons";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import type { Settings } from "../types/model.js";

  let {
    settings,
    save,
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
  } = $props();
</script>

<section class="card">
  <h3><Fa icon={faBolt} /> Quick Add & Tabs</h3>
  <div class="field">
    <label for="defaultQuickAddTarget">Default Quick Add Target</label>
    <p class="sub-text">Default playlist targeted when opening the popup</p>
    <select
      id="defaultQuickAddTarget"
      bind:value={settings!.defaultQuickAddTarget}
      onchange={() => save("defaultQuickAddTarget", settings?.defaultQuickAddTarget)}
    >
      <option value="create">Create new playlist</option>
      <option value="latest">Latest Playlist</option>
      <option value="favorite">Favorite Playlist</option>
    </select>
  </div>

  <div class="field">
    <label for="defaultTabScope">Default Tab Scope</label>
    <p class="sub-text">Which tabs to add when clicking "Add Videos"</p>
    <select
      id="defaultTabScope"
      bind:value={settings!.defaultTabScope}
      onchange={() => save("defaultTabScope", settings?.defaultTabScope)}
    >
      <option value="current">Only this tab</option>
      <option value="left">Tabs to the left (this window)</option>
      <option value="right">Tabs to the right (this window)</option>
      <option value="all-this-window-include">All tabs in this window (include this)</option>
      <option value="all-this-window-exclude">All tabs in this window (exclude this)</option>
      <option value="all-windows">All tabs across all windows</option>
    </select>
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Auto-save to YouTube</span>
      <span class="sub-text">Automatically sync newly created playlists</span>
    </div>
    <ToggleSwitch
      checked={settings?.saveCreatedPlaylists}
      onchange={(val) => {
        settings!.saveCreatedPlaylists = val;
        save("saveCreatedPlaylists", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Close YouTube tabs</span>
      <span class="sub-text">Automatically close tabs after adding them</span>
    </div>
    <ToggleSwitch
      checked={settings?.closeAddedTabs}
      onchange={(val) => {
        settings!.closeAddedTabs = val;
        save("closeAddedTabs", val);
      }}
    />
  </div>
</section>

<section class="card">
  <h3><Fa icon={faMousePointer} /> Context Menu</h3>
  <div class="toggle-row">
    <div class="toggle-info">
      <span>Open saved playlist after add</span>
    </div>
    <ToggleSwitch
      checked={settings?.openSavedPlaylistAfterAdd}
      onchange={(val) => {
        settings!.openSavedPlaylistAfterAdd = val;
        save("openSavedPlaylistAfterAdd", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Open builder after add</span>
    </div>
    <ToggleSwitch
      checked={settings?.openPlaylistBuilderAfterAdd}
      onchange={(val) => {
        settings!.openPlaylistBuilderAfterAdd = val;
        save("openPlaylistBuilderAfterAdd", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Disable builder in context menu</span>
    </div>
    <ToggleSwitch
      checked={settings?.disableContextBuilder}
      onchange={(val) => {
        settings!.disableContextBuilder = val;
        save("disableContextBuilder", val);
      }}
    />
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Disable saved playlists in context menu</span>
    </div>
    <ToggleSwitch
      checked={settings?.disableContextSaved}
      onchange={(val) => {
        settings!.disableContextSaved = val;
        save("disableContextSaved", val);
      }}
    />
  </div>
</section>
