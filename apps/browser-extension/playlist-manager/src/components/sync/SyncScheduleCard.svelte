<script lang="ts">
  import Fa from "svelte-fa";
  import { faClock } from "@fortawesome/free-solid-svg-icons";
  import type { SyncConfig } from "../../services/sync/sync-config.js";

  let {
    config,
    onPersist,
    onLog,
  }: {
    config: SyncConfig;
    onPersist: () => void | Promise<void>;
    onLog?: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  } = $props();

  const OPTIONS = [0, 15, 30, 60, 360, 1440];
  const LABELS = ["Manual only", "15 min", "30 min", "1 hour", "6 hours", "24 hours"];

  const currentIndex = $derived.by(() => {
    const idx = OPTIONS.indexOf(config.syncIntervalMinutes);
    return idx >= 0 ? idx : 0;
  });

  function handleChange(e: Event) {
    const idx = Number((e.currentTarget as HTMLInputElement).value);
    const value = OPTIONS[idx] ?? 0;
    config.syncIntervalMinutes = value;
    onPersist();
    onLog?.(
      value === 0 ? "Sync set to manual only" : `Sync frequency set to ${LABELS[idx]}`,
      "info"
    );
  }
</script>

<section class="card">
  <h3><Fa icon={faClock} /> Sync Frequency</h3>
  <p class="sub-text">
    How often the extension checks for changes automatically. Set to "Manual only" to disable
    periodic sync. Changes take effect immediately.
  </p>
  <div class="field">
    <label for="sync-freq">Frequency: <strong>{LABELS[currentIndex]}</strong></label>
    <input
      id="sync-freq"
      type="range"
      min="0"
      max={OPTIONS.length - 1}
      step="1"
      value={currentIndex}
      oninput={handleChange}
    />
    <div class="freq-labels">
      {#each LABELS as label, i}
        <span class:active={i === currentIndex}>{label}</span>
      {/each}
    </div>
  </div>
</section>

<style>
  .freq-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--muted-foreground, #9ca3af);
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .freq-labels span.active {
    color: var(--accent, #3b82f6);
    font-weight: 600;
  }
  input[type="range"] {
    width: 100%;
  }
</style>
