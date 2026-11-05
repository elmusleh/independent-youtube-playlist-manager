<script lang="ts">
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import { faClock } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import type { SyncConfig } from "../../services/sync/sync-config.js";
  import {
    decomposeIntervalMinutes,
    formatNextScheduledCheck,
    formatSyncInterval,
    SYNC_INTERVAL_PRESETS,
    toIntervalMinutes,
    type DurationUnit,
  } from "../../services/sync/sync-schedule.js";

  let {
    config,
    onPersist,
    onLog,
  }: {
    config: SyncConfig;
    onPersist: () => void | Promise<void>;
    onLog?: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  } = $props();

  let customAmount = $state(15);
  let customUnit = $state<DurationUnit>("minutes");
  let nextScheduledTime = $state<number | null>(null);
  let nowTick = $state(Date.now());

  const syncReady = $derived(!!(config.syncKey && config.backends.length > 0));
  const intervalMinutes = $derived(
    typeof config.syncIntervalMinutes === "number" ? config.syncIntervalMinutes : 5
  );
  const autoOnChange = $derived(config.autoSyncOnChange !== false);
  const autoOnStartup = $derived(config.autoSyncOnStartup !== false);
  const isCustomInterval = $derived(
    intervalMinutes > 0 && !SYNC_INTERVAL_PRESETS.some((p) => p.minutes === intervalMinutes)
  );
  const maxCustomAmount = $derived(customUnit === "hours" ? 168 : 10_080);

  const badgeText = $derived.by(() => {
    if (intervalMinutes > 0) return formatSyncInterval(intervalMinutes);
    if (!autoOnChange && !autoOnStartup) return "Manual only";
    return "On activity only";
  });

  const nextCheckLabel = $derived(formatNextScheduledCheck(nextScheduledTime, nowTick));

  $effect(() => {
    const decomposed = decomposeIntervalMinutes(intervalMinutes);
    customAmount = decomposed.amount;
    customUnit = decomposed.unit;
  });

  async function refreshAlarmStatus(requestWorkerRefresh = false) {
    nowTick = Date.now();
    const b = (globalThis as any).browser || (globalThis as any).chrome;
    try {
      if (requestWorkerRefresh && b?.runtime?.sendMessage) {
        const res = await b.runtime.sendMessage({ cmd: "sync-refresh-schedule" });
        if (res && typeof res === "object" && "scheduledTime" in res) {
          nextScheduledTime = res.scheduledTime ?? null;
          return;
        }
      }
      const alarm = await b?.alarms?.get?.("yph-sync-periodic");
      nextScheduledTime = alarm?.scheduledTime ?? null;
    } catch {
      nextScheduledTime = null;
    }
  }

  async function applyPreset(minutes: number) {
    if (minutes === 0) {
      config.syncIntervalMinutes = 0;
      config.autoSyncOnChange = false;
      config.autoSyncOnStartup = false;
      await onPersist();
      await refreshAlarmStatus(true);
      onLog?.("Sync set to Manual only — automatic checks and triggers disabled", "info");
      return;
    }
    if (config.syncIntervalMinutes === 0 && !autoOnChange && !autoOnStartup) {
      config.autoSyncOnChange = true;
      config.autoSyncOnStartup = true;
    }
    config.syncIntervalMinutes = minutes;
    await onPersist();
    await refreshAlarmStatus(true);
    onLog?.(`Automatic sync scheduled: ${formatSyncInterval(minutes).toLowerCase()}`, "info");
  }

  async function applyCustomInterval() {
    const minutes = toIntervalMinutes(Number(customAmount), customUnit);
    if (config.syncIntervalMinutes === 0 && !autoOnChange && !autoOnStartup) {
      config.autoSyncOnChange = true;
      config.autoSyncOnStartup = true;
    }
    config.syncIntervalMinutes = minutes;
    const normalized = decomposeIntervalMinutes(minutes);
    customAmount = normalized.amount;
    customUnit = normalized.unit;
    await onPersist();
    await refreshAlarmStatus(true);
    onLog?.(`Custom sync interval set: ${formatSyncInterval(minutes).toLowerCase()}`, "info");
  }

  async function toggleAutoOnChange(e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    config.autoSyncOnChange = checked;
    await onPersist();
    onLog?.(
      checked
        ? "Enabled automatic sync after local edits"
        : "Disabled automatic sync after local edits",
      "info"
    );
  }

  async function toggleAutoOnStartup(e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    config.autoSyncOnStartup = checked;
    await onPersist();
    onLog?.(
      checked
        ? "Enabled sync on browser startup & live device nudges"
        : "Disabled sync on browser startup & live device nudges",
      "info"
    );
  }

  onMount(() => {
    refreshAlarmStatus(false);
    const timer = setInterval(() => refreshAlarmStatus(false), 30_000);
    return () => clearInterval(timer);
  });
</script>

<section class="card">
  <div class="sched-head">
    <h3><Fa icon={faClock} /> Sync Frequency</h3>
    <span
      class="sync-badge {intervalMinutes > 0
        ? 'sync-badge-yes'
        : !autoOnChange && !autoOnStartup
          ? 'sync-badge-no'
          : 'sync-badge-beta'}"
    >
      {badgeText}
    </span>
  </div>

  <p class="sub-text">
    Choose how often IYPM checks for cloud updates in the background, or select
    <strong>Manual only</strong> so sync runs strictly when you click <strong>Sync now</strong>.
  </p>

  <div class="preset-grid" role="group" aria-label="Sync frequency presets">
    {#each SYNC_INTERVAL_PRESETS as preset}
      {@const isSelected =
        preset.minutes === 0
          ? intervalMinutes === 0 && !autoOnChange && !autoOnStartup
          : intervalMinutes === preset.minutes}
      <button
        type="button"
        class="preset-pill"
        class:active={isSelected}
        aria-pressed={isSelected}
        onclick={() => applyPreset(preset.minutes)}
      >
        {preset.label}
      </button>
    {/each}
    {#if isCustomInterval}
      <span class="preset-pill active" aria-current="true">
        Custom ({formatSyncInterval(intervalMinutes).replace("Every ", "")})
      </span>
    {/if}
  </div>

  <div class="field custom-row">
    <label for="sync-custom-amount">Custom check interval (1 min – 7 days):</label>
    <div class="custom-controls">
      <input
        id="sync-custom-amount"
        type="number"
        min="1"
        max={maxCustomAmount}
        step="1"
        bind:value={customAmount}
        onkeydown={(e) => e.key === "Enter" && applyCustomInterval()}
      />
      <select id="sync-custom-unit" aria-label="Custom interval unit" bind:value={customUnit}>
        <option value="minutes">Minutes</option>
        <option value="hours">Hours</option>
      </select>
      <SimpleButton secondary onclick={applyCustomInterval}>Set</SimpleButton>
    </div>
  </div>

  <div class="trigger-list">
    <label class="checkbox-label">
      <input type="checkbox" checked={autoOnChange} onchange={toggleAutoOnChange} />
      <span>Sync automatically after local edits (3s delay)</span>
    </label>
    <label class="checkbox-label">
      <input type="checkbox" checked={autoOnStartup} onchange={toggleAutoOnStartup} />
      <span>Sync on browser startup &amp; live device nudges</span>
    </label>
  </div>

  <div class="backend-detail" aria-live="polite">
    {#if !syncReady}
      <p>
        <strong>Saved schedule ({badgeText}):</strong> Enable a Sync Key and backend above to start automatic
        checks.
      </p>
    {:else if intervalMinutes > 0}
      <p>
        <strong>Active timer:</strong>
        {formatSyncInterval(intervalMinutes)}{nextCheckLabel
          ? ` · Next check ${nextCheckLabel}`
          : ""}.
      </p>
    {:else if !autoOnChange && !autoOnStartup}
      <p>
        <strong>Strict manual mode:</strong> No background timers or automatic triggers are active.
        Sync runs only when you click <strong>Sync now</strong>.
      </p>
    {:else}
      <p>
        <strong>Periodic timer off:</strong> Sync runs automatically on the triggers checked above,
        or whenever you click <strong>Sync now</strong>.
      </p>
    {/if}
  </div>
</section>

<style>
  .sched-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .sched-head h3 {
    margin: 0;
  }
  .preset-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.65rem 0;
  }
  .preset-pill {
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary, var(--color-bg-secondary));
    color: var(--text-color);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .preset-pill.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: #fff;
    font-weight: 600;
  }
  .custom-row {
    margin: 0.5rem 0;
  }
  .custom-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.35rem;
    flex-wrap: wrap;
  }
  .custom-controls input[type="number"],
  .custom-controls select {
    height: 38px;
    padding: 0 0.65rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary, var(--color-bg-secondary));
    color: var(--text-color);
    font-size: 0.85rem;
  }
  .custom-controls input[type="number"] {
    width: 5.5rem;
  }
  .trigger-list {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin: 0.65rem 0;
  }
</style>
