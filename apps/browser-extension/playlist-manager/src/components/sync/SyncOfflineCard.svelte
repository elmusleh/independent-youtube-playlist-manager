<script lang="ts">
  import Fa from "svelte-fa";
  import { faPowerOff } from "@fortawesome/free-solid-svg-icons";
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

  const isOffline = $derived(config.backends.length === 0);

  function goOffline() {
    config.backends = [];
    onPersist();
    onLog?.("All sync backends disabled — running fully offline", "warning");
  }

  function enableRelay() {
    if (!config.backends.includes("relay")) config.backends = [...config.backends, "relay"];
    onPersist();
    onLog?.("Hosted relay enabled", "info");
  }
</script>

<section class="card" class:offline={isOffline}>
  <h3><Fa icon={faPowerOff} /> Offline Mode</h3>
  <p class="sub-text">
    {isOffline
      ? "No sync backends are enabled. All data stays on this device. Nothing is uploaded."
      : "Sync is active. Disable all backends to run fully offline."}
  </p>
  {#if isOffline}
    <p class="sub-text status-ok">Offline mode is on. No network sync, polling, or alarms.</p>
  {:else}
    <button type="button" class="offline-btn" onclick={goOffline}>
      Disable all backends (go offline)
    </button>
  {/if}
</section>

<style>
  .offline {
    border-color: var(--muted, #e5e7eb);
  }
  .status-ok {
    color: var(--success, #10b981);
    font-weight: 600;
  }
  .offline-btn {
    align-self: flex-start;
    padding: 0.5rem 0.9rem;
    border-radius: 8px;
    border: 1px solid var(--border, #d1d5db);
    background: var(--card, #fff);
    color: var(--text-color, #111);
    cursor: pointer;
  }
  .offline-btn:hover {
    background: var(--hover-color, #f3f4f6);
  }
</style>
