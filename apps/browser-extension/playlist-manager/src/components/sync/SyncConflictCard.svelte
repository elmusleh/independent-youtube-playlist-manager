<script lang="ts">
  import Fa from "svelte-fa";
  import { faCodeBranch, faListCheck } from "@fortawesome/free-solid-svg-icons";
  import type { ConflictStrategy, SyncConfig } from "../../services/sync/sync-config.js";

  let {
    config,
    onPersist,
    onLog,
  }: {
    config: SyncConfig;
    onPersist: () => void | Promise<void>;
    onLog?: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  } = $props();

  const currentStrategy = $derived<ConflictStrategy>(
    config.conflictStrategy === "lww" ? "lww" : "merge"
  );

  function selectStrategy(strategy: ConflictStrategy) {
    if (config.conflictStrategy === strategy) return;
    config.conflictStrategy = strategy;
    onPersist();
    onLog?.(
      strategy === "merge"
        ? "Conflict policy set to Automatic 3-way merge"
        : "Conflict policy set to Last-write-wins",
      "info"
    );
  }
</script>

<section class="card">
  <h3><Fa icon={faCodeBranch} /> Conflict Resolution</h3>
  <p class="sub-text">
    Choose how IYPM resolves changes when two devices edit the same playlist or setting before
    syncing. Every resolution is recorded in System Logs.
  </p>

  <div class="conflict-options">
    <div class="backend-option" class:selected={currentStrategy === "merge"}>
      <label>
        <input
          type="radio"
          name="sync-conflict-strategy"
          value="merge"
          checked={currentStrategy === "merge"}
          onchange={() => selectStrategy("merge")}
        />
        <span class="backend-name">Automatic 3-way merge</span>
        <span class="sync-badge sync-badge-yes">Recommended</span>
      </label>
      <span class="sub-text">
        Preserves videos and pinned playlists added on both devices while applying deletions from
        either side.
      </span>
    </div>

    <div class="backend-option" class:selected={currentStrategy === "lww"}>
      <label>
        <input
          type="radio"
          name="sync-conflict-strategy"
          value="lww"
          checked={currentStrategy === "lww"}
          onchange={() => selectStrategy("lww")}
        />
        <span class="backend-name">Last-write-wins</span>
      </label>
      <span class="sub-text">
        Keeps whichever device saved the most recent edit when the same playlist or setting changes
        concurrently.
      </span>
    </div>

    <div class="backend-option conflict-disabled" aria-disabled="true">
      <label class="disabled-label">
        <input type="radio" name="sync-conflict-strategy" value="manual" disabled />
        <span class="backend-name">Manual review queue</span>
        <span class="sync-badge sync-badge-no">Coming soon</span>
      </label>
      <span class="sub-text">
        Hold conflicting records for interactive side-by-side comparison before applying.
      </span>
    </div>
  </div>

  <a href="#/logs" class="api-link log-audit-link">
    <Fa icon={faListCheck} /> View [SYNC] activity &amp; conflict audit log
  </a>
</section>

<style>
  .conflict-options {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-top: 0.75rem;
  }
  .conflict-disabled {
    opacity: 0.65;
  }
  .disabled-label {
    cursor: not-allowed;
  }
  .log-audit-link {
    margin-top: 0.85rem;
  }
</style>
