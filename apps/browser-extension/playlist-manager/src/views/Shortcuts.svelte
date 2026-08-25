<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    shortcutsStore,
    defaultMappings,
    type ShortcutAction,
    type ShortcutKey,
  } from "../stores/shortcuts";
  import { StatusManager } from "../services/status-manager.svelte";
  import ToggleSwitch from "../components/ToggleSwitch.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { faRotateLeft, faKeyboard } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
  import ViewHeader from "../components/ViewHeader.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";

  let config = $state({ enabled: true, mappings: { ...defaultMappings } });
  const status = new StatusManager();

  async function refresh() {
    await status.refresh(async () => {
      // Just re-subscribe or re-load from store
      const value = await new Promise((resolve) => {
        const unsub = shortcutsStore.subscribe((val) => {
          unsub();
          resolve(val);
        });
      });
      config = JSON.parse(JSON.stringify(value));
    });
  }

  async function saveConfig(newConfig: any) {
    await status.save(async () => {
      await shortcutsStore.save(newConfig);
    });
  }

  // Subscribe directly at module level (onMount is broken in this project)
  const unsubscribe = shortcutsStore.subscribe((value) => {
    config = JSON.parse(JSON.stringify(value));
  });

  onDestroy(() => {
    unsubscribe();
  });

  let recordingAction: ShortcutAction | null = $state(null);
  let errorMessage = $state("");

  const actionLabels: Record<ShortcutAction, string> = {
    newPlaylist: "New Playlist",
    manage: "Manage Playlists",
    history: "Watch History",
    favorite: "Favorite Playlist",
    saved: "All Playlists",
    settings: "Settings",
  };

  const reservedShortcuts = [
    "CTRL+C",
    "CTRL+V",
    "CTRL+T",
    "CTRL+W",
    "CTRL+R",
    "CTRL+N",
    "CMD+C",
    "CMD+V",
    "CMD+T",
    "CMD+W",
    "CMD+R",
    "CMD+N",
  ];

  function formatKey(shortcut: ShortcutKey): string {
    const parts = [];
    if (shortcut.ctrlKey) parts.push("Ctrl");
    if (shortcut.metaKey) parts.push("Cmd");
    if (shortcut.altKey) parts.push("Alt");
    if (shortcut.shiftKey) parts.push("Shift");
    parts.push(shortcut.key.toUpperCase());
    return parts.join(" + ");
  }

  function handleToggle(checked: boolean) {
    saveConfig({ ...config, enabled: checked });
  }

  function startRecording(action: ShortcutAction) {
    recordingAction = action;
    errorMessage = "";
  }

  function handleStartRecording(actionString: string) {
    startRecording(actionString as ShortcutAction);
  }

  function getShortcut(actionString: string) {
    return config.mappings[actionString as ShortcutAction];
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!recordingAction) return;

    e.preventDefault();
    e.stopPropagation();

    // Ignore just modifier keys being pressed
    if (e.key === "Control" || e.key === "Alt" || e.key === "Shift" || e.key === "Meta") {
      return;
    }

    // Require at least one modifier key (Ctrl, Alt, Meta) to prevent single-key overrides
    // Not requiring shift as it's often used for uppercase but doesn't feel like a proper modifier for standard actions
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      errorMessage =
        "Shortcut must include a modifier key (Ctrl, Alt, or Cmd). Single keys are not allowed.";
      return;
    }

    const newShortcut: ShortcutKey = {
      key: e.key,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    };

    const formattedKey = formatKey(newShortcut).toUpperCase().replace(/ /g, "");
    if (reservedShortcuts.includes(formattedKey)) {
      errorMessage = "This shortcut is reserved by the browser and cannot be used.";
      return;
    }

    // Check for duplicates
    for (const [existingAction, existingShortcut] of Object.entries(config.mappings)) {
      if (
        existingAction !== recordingAction &&
        formatKey(existingShortcut) === formatKey(newShortcut)
      ) {
        errorMessage = `This shortcut is already used for "${actionLabels[existingAction as ShortcutAction]}".`;
        return;
      }
    }

    config.mappings[recordingAction] = newShortcut;
    saveConfig(config);
    recordingAction = null;
    errorMessage = "";
  }

  function cancelRecording() {
    recordingAction = null;
    errorMessage = "";
  }

  function resetDefaults() {
    shortcutsStore.reset();
    errorMessage = "";
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<main class="view-scroll-container">
  <div class="view-body">
    <StickyHeader>
      {#snippet children()}
        <ViewHeader icon={faKeyboard} title="Keyboard Shortcuts">
          {#snippet rightActions()}
            <SimpleButton onclick={resetDefaults} secondary>
              <Fa icon={faRotateLeft} fw />
              <span>Reset to Default</span>
            </SimpleButton>
            <SaveStatus onclick={refresh} {status} />
          {/snippet}
        </ViewHeader>
      {/snippet}
    </StickyHeader>

    <div class="shortcuts-container">
      <div class="setting-row">
        <div class="setting-info">
          <h3>Enable Shortcuts</h3>
          <p>Allow keyboard shortcuts to navigate the extension.</p>
        </div>
        <ToggleSwitch checked={config.enabled} onchange={handleToggle} />
      </div>

      {#if errorMessage}
        <div class="error-banner">
          {errorMessage}
        </div>
      {/if}

      <div class="shortcuts-list" class:disabled={!config.enabled}>
        {#each Object.entries(actionLabels) as [action, label]}
          <div class="shortcut-item">
            <div class="shortcut-info">
              <span class="shortcut-label">{label}</span>
            </div>
            <div class="shortcut-action">
              {#if recordingAction === action}
                <div class="recording-box">
                  <span class="recording-text">Press keys now...</span>
                  <button class="cancel-btn" onclick={cancelRecording}>Cancel</button>
                </div>
              {:else}
                <button
                  class="key-btn"
                  onclick={() => handleStartRecording(action)}
                  disabled={!config.enabled}
                >
                  {formatKey(getShortcut(action))}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</main>

<style>
  @import "../css/view-layout.css";

  .shortcuts-container {
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .setting-info h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    color: var(--text-color);
  }

  .setting-info p {
    margin: 0;
    font-size: 14px;
    color: var(--text-muted);
  }

  .error-banner {
    background-color: rgba(244, 67, 54, 0.1);
    color: #f44336;
    padding: 12px 24px;
    font-size: 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .shortcuts-list {
    padding: 0;
    transition: opacity 0.2s ease;
  }

  .shortcuts-list.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .shortcut-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .shortcut-item:last-child {
    border-bottom: none;
  }

  .shortcut-label {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-color);
  }

  .key-btn {
    background: var(--hover-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 14px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 140px;
    text-align: center;
  }

  .key-btn:hover:not(:disabled) {
    background: var(--active-bg-color);
    border-color: var(--primary-color);
  }

  .key-btn:disabled {
    cursor: not-allowed;
  }

  .recording-box {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--active-bg-color);
    border: 1px solid var(--primary-color);
    border-radius: 8px;
    padding: 4px 8px 4px 16px;
    box-shadow: 0 0 0 2px rgba(62, 166, 255, 0.2);
  }

  .recording-text {
    font-size: 14px;
    color: var(--primary-color);
    font-weight: 500;
    animation: pulse 1.5s infinite;
  }

  .cancel-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .cancel-btn:hover {
    color: var(--text-color);
    background: var(--hover-color);
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }

  @media (max-width: 600px) {
    .setting-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }

    .shortcut-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
