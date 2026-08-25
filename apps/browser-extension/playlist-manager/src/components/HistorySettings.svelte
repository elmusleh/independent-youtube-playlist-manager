<script lang="ts">
  import SimpleButton from "./SimpleButton.svelte";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import type { Settings } from "../types/model.js";
  import { requestConfirm } from "../stores/confirmation.js";
  import Fa from "svelte-fa";
  import {
    faClockRotateLeft,
    faFileExport,
    faFileImport,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import { StatusManager } from "../services/status-manager.svelte";
  import { logger } from "../services/logger";

  const {
    settings,
    save,
    status,
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
    status: StatusManager;
  } = $props();

  const HISTORY_KEY = "local_yt_history";
  const browser = (window as any).browser || (window as any).chrome;

  async function clearWatchHistory() {
    requestConfirm({
      title: "Clear Watch History?",
      message: "This will reset all your saved video timestamps. This cannot be undone.",
      color: "danger",
      onConfirm: async () => {
        if (window.logSystemEvent)
          await window.logSystemEvent("INFO", "[SETTINGS] Clearing watch history");
        try {
          await browser.storage.local.remove(HISTORY_KEY);
          if (window.logSystemEvent)
            await window.logSystemEvent("INFO", "[SETTINGS] Watch history cleared");
          window.success("Watch history cleared");
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          if (window.logSystemEvent)
            await window.logSystemEvent("ERROR", `[SETTINGS] Failed to clear history: ${errMsg}`);
          window.error("Failed to clear history");
        }
      },
    });
  }

  async function exportHistory() {
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", "[SETTINGS] Exporting watch history");
    try {
      const data = await browser.storage.local.get(HISTORY_KEY);
      const historyObj = data[HISTORY_KEY] || {};
      const blob = new Blob([JSON.stringify(historyObj, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "yph-watch-history.json";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.logSystemEvent)
        await window.logSystemEvent("INFO", "[SETTINGS] Watch history exported successfully");
      window.success("History exported successfully");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error("Failed to export history:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[SETTINGS] Export failed: ${errMsg}`);
      window.error("Export failed");
    }
  }

  function importHistory() {
    const fi = document.getElementById("HistoryImportInput") as HTMLInputElement;
    fi.onchange = () => {
      const file = fi.files?.[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const importedData = JSON.parse(fr.result as string);
          if (window.logSystemEvent)
            await window.logSystemEvent("INFO", "[SETTINGS] Importing watch history from file");
          await browser.storage.local.set({ [HISTORY_KEY]: importedData });
          if (window.logSystemEvent)
            await window.logSystemEvent("INFO", "[SETTINGS] Watch history imported successfully");
          window.success("History imported successfully");
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          logger.error("Failed to import history:", e);
          if (window.logSystemEvent)
            await window.logSystemEvent("ERROR", `[SETTINGS] Import failed: ${errMsg}`);
          window.error("File is incorrectly formatted");
        }
        fi.value = "";
      };
      fr.readAsText(file);
    };
    fi.click();
  }
</script>

<section class="card">
  <h3><Fa icon={faClockRotateLeft} /> Watch History</h3>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Enable Watch History Tracking</span>
      <span class="sub-text">Track your watch progress and store it locally.</span>
    </div>
    <ToggleSwitch
      checked={settings?.ruleEnabled ?? false}
      onchange={(val) => {
        if (settings) settings!.ruleEnabled = val;
        save("ruleEnabled", val);
      }}
    />
  </div>

  {#if settings?.ruleEnabled}
    <div class="toggle-row indent-row">
      <div class="toggle-info">
        <span>Save history on pause</span>
        <span class="sub-text">Update your timestamp whenever you pause the video.</span>
      </div>
      <ToggleSwitch
        checked={settings?.ruleTrackPause ?? false}
        onchange={(val) => {
          if (settings) settings!.ruleTrackPause = val;
          save("ruleTrackPause", val);
        }}
      />
    </div>

    <div class="toggle-row indent-row">
      <div class="toggle-info">
        <span>Save history on page leave</span>
        <span class="sub-text">Update your timestamp when closing the tab or navigating away.</span>
      </div>
      <ToggleSwitch
        checked={settings?.ruleTrackUnload ?? false}
        onchange={(val) => {
          if (settings) settings!.ruleTrackUnload = val;
          save("ruleTrackUnload", val);
        }}
      />
    </div>

    <div class="toggle-row">
      <div class="toggle-info">
        <span>Auto-Delete when finished</span>
        <span class="sub-text"
          >Remove the video from the local playlist once you finish watching it.</span
        >
      </div>
      <ToggleSwitch
        checked={settings?.ruleAutoDelete ?? false}
        onchange={(val) => {
          if (settings) settings!.ruleAutoDelete = val;
          save("ruleAutoDelete", val);
        }}
      />
    </div>

    <div class="field">
      <label for="ruleCompletionThreshold">Completion Threshold (%)</label>
      <p class="sub-text">Consider a video "finished" when this percentage is reached.</p>
      <input
        aria-label="Completion threshold percent"
        id="ruleCompletionThreshold"
        type="number"
        min="1"
        max="100"
        bind:value={settings!.ruleCompletionThreshold}
        onchange={() => save("ruleCompletionThreshold", settings?.ruleCompletionThreshold)}
      />
    </div>
  {/if}

  <div class="field">
    <label for="ruleHistoryRetentionDays">Keep History For (Days)</label>
    <p class="sub-text">How long your local watch history is stored before being pruned.</p>
    <input
      aria-label="History retention days"
      id="ruleHistoryRetentionDays"
      type="number"
      min="1"
      max="3650"
      bind:value={settings!.ruleHistoryRetentionDays}
      onchange={() => save("ruleHistoryRetentionDays", settings?.ruleHistoryRetentionDays)}
    />
  </div>

  <div class="field">
    <label for="ruleHistoryThrottleMs">History Throttle Interval (ms)</label>
    <p class="sub-text">Minimum time between saves to prevent excessive storage writes.</p>
    <select
      aria-label="History throttle interval"
      id="ruleHistoryThrottleMs"
      bind:value={settings!.ruleHistoryThrottleMs}
      onchange={() => save("ruleHistoryThrottleMs", settings?.ruleHistoryThrottleMs)}
    >
      <option value={1000}>1 second</option>
      <option value={3000}>3 seconds</option>
      <option value={5000}>5 seconds</option>
      <option value={10000}>10 seconds</option>
    </select>
  </div>

  <div class="field">
    <label for="ruleHistoryDebounceMs">History Debounce Delay (ms)</label>
    <p class="sub-text">Delay before saving after pause or tab switch to avoid momentary pauses.</p>
    <select
      aria-label="History debounce delay"
      id="ruleHistoryDebounceMs"
      bind:value={settings!.ruleHistoryDebounceMs}
      onchange={() => save("ruleHistoryDebounceMs", settings?.ruleHistoryDebounceMs)}
    >
      <option value={500}>0.5 seconds</option>
      <option value={1000}>1 second</option>
      <option value={2000}>2 seconds</option>
      <option value={5000}>5 seconds</option>
    </select>
  </div>

  <div class="toggle-row">
    <div class="toggle-info">
      <span>Track During Playback</span>
      <span class="sub-text"
        >Periodically save position while video is playing (not just on pause).</span
      >
    </div>
    <ToggleSwitch
      checked={settings?.ruleTrackDuringPlayback ?? false}
      onchange={(val) => {
        if (settings) settings!.ruleTrackDuringPlayback = val;
        save("ruleTrackDuringPlayback", val);
      }}
    />
  </div>

  <div class="data-management-section">
    <div class="field-label">Manage Data</div>
    <p class="sub-text">Export, import, or clear your local watch history timestamps.</p>
    <div class="button-group">
      <SimpleButton secondary onclick={exportHistory}>
        <Fa icon={faFileExport} fw /> Export
      </SimpleButton>
      <SimpleButton secondary onclick={importHistory}>
        <Fa icon={faFileImport} fw /> Import
      </SimpleButton>
      <SimpleButton danger onclick={clearWatchHistory}>
        <Fa icon={faTrash} fw /> Clear
      </SimpleButton>
    </div>
  </div>
</section>

<input
  aria-label="Import history JSON file"
  id="HistoryImportInput"
  type="file"
  accept=".json"
  style="display:none"
/>
