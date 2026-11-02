<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { push } from "svelte-spa-router";
  import Modal from "../components/Modal.svelte";
  import SearchInput from "../components/common/SearchInput.svelte";
  import DestinationOptions from "../components/DestinationOptions.svelte";
  import CaptureOptions from "../components/CaptureOptions.svelte";
  import { toast } from "../stores/toast";
  import { logger } from "../services/logger";
  const browser = window.browser || window.chrome;
  // Job data from background
  interface CaptureJob {
    jobId: string;
    state: string;
    videoIds?: string[];
    duplicateCount?: number;
    chooserReason?: string;
    isPageImport?: boolean;
    retryable?: boolean;
    error?: string;
  }
  let job = $state<CaptureJob | null>(null);
  let playlists = $state<import("../types/model").Playlist[]>([]);
  let filteredPlaylists = $state<import("../types/model").Playlist[]>([]);
  let searchQuery = $state("");
  let loading = $state(true);
  let error = $state("");
  let selectedDestination = $state<{ type: string; playlistId: string | null } | null>(null);
  let insertPosition = $state("bottom");
  let closeTabs = $state(false);
  let showAdvanced = $state(false);
  let modalOpen = $state(false);
  async function loadJob() {
    try {
      const result = await browser.storage.local.get("yph_pending_job_id");
      if (!result.yph_pending_job_id) {
        error = "No pending capture job found";
        loading = false;
        return;
      }
      const response = await browser.runtime.sendMessage({ cmd: "context-menu-get-pending-job" });
      if (response.job) {
        job = response.job;
      } else {
        error = "Job not found or expired";
        loading = false;
        return;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load job";
      logger.error("ChooseDestination: loadJob failed", e);
    } finally {
      loading = false;
    }
  }

  async function loadPlaylists() {
    try {
      if (window.getPlaylists) {
        const lists = await window.getPlaylists();
        playlists = lists.filter((p) => p.id && p.title);
        filterPlaylists();
      }
    } catch (e) {
      logger.warn("ChooseDestination: Failed to load playlists", e);
    }
  }

  function filterPlaylists() {
    if (!searchQuery.trim()) {
      filteredPlaylists = playlists;
    } else {
      const q = searchQuery.toLowerCase();
      filteredPlaylists = playlists.filter((p) => p.title.toLowerCase().includes(q));
    }
  }

  function handleSearch(e: InputEvent) {
    const target = e.target as HTMLInputElement;
    searchQuery = target.value;
    filterPlaylists();
  }

  function selectDestination(type: string, playlistId: string | null = null) {
    selectedDestination = { type, playlistId };
  }

  async function confirmDestination() {
    if (!selectedDestination || !job) return;

    try {
      modalOpen = true;

      const response = await browser.runtime.sendMessage({
        cmd: "context-menu-choose-destination",
        jobId: job.jobId,
        destinationType: selectedDestination.type,
        destinationId: selectedDestination.playlistId,
        insertPosition,
        closeTabs,
      });

      if (response.success) {
        toast.show(
          response.addedCount !== undefined
            ? `Added ${response.addedCount} video(s) to ${response.destinationType}`
            : "Done!",
          "success"
        );
        push("/saved");
      } else if (response.requiresChooser) {
        toast.show("Please select a destination", "warning");
      } else {
        toast.show(response.error || "Failed to add videos", "error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to confirm destination";
      toast.show(msg, "error");
      logger.error("ChooseDestination: confirm failed", e);
    } finally {
      modalOpen = false;
    }
  }

  function cancel() {
    browser.runtime.sendMessage({ cmd: "context-menu-clear-pending-job" }).catch(() => {});
    push("/saved");
  }

  async function retryJob() {
    if (!job) return;

    try {
      modalOpen = true;
      const response = await browser.runtime.sendMessage({
        cmd: "context-menu-retry-job",
        jobId: job.jobId,
        overrides: {
          destinationType: selectedDestination?.type,
          destinationId: selectedDestination?.playlistId,
        },
      });

      if (response.success) {
        toast.show("Retry succeeded", "success");
        push("/saved");
      } else if (response.requiresChooser) {
        await loadJob();
        await loadPlaylists();
      } else {
        toast.show(response.error || "Retry failed", "error");
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Retry failed", "error");
    } finally {
      modalOpen = false;
    }
  }

  onMount(async () => {
    await Promise.all([loadJob(), loadPlaylists()]);
  });

  onDestroy(() => {
    if (job) {
      browser.runtime.sendMessage({ cmd: "context-menu-clear-pending-job" }).catch(() => {});
    }
  });
</script>

<main class="view-scroll-container view-body">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading capture job…</p>
    </div>
  {:else if error}
    <div class="error-state">
      <h2>Cannot Load Job</h2>
      <p>{error}</p>
      <button class="btn btn-primary" onclick={cancel}>Go Back</button>
    </div>
  {:else if job}
    <div class="choose-destination">
      <header class="view-header">
        <h1>Choose Destination</h1>
        <p class="subtitle">
          {job.videoIds?.length || 0} video{job.videoIds?.length !== 1 ? "s" : ""} ready to add
          {#if job && (job.duplicateCount ?? 0) > 0}
            ({job.duplicateCount} duplicate{job.duplicateCount !== 1 ? "s" : ""} will be skipped)
          {/if}
          {#if job.chooserReason}
            <br /><span class="reason">{job.chooserReason}</span>
          {/if}
        </p>
      </header>

      <DestinationOptions
        {job}
        {playlists}
        {filteredPlaylists}
        {searchQuery}
        {selectedDestination}
        {selectDestination}
        {handleSearch}
      />

      <CaptureOptions {job} {insertPosition} {closeTabs} {showAdvanced} />

      <Modal bind:display={modalOpen} title="Processing…" dismissible={false} size="small">
        <div class="modal-processing">
          <div class="spinner"></div>
          <p>{job.state === "saving" ? "Saving to playlist…" : "Processing…"}</p>
        </div>
      </Modal>

      <footer class="view-footer">
        <button class="btn btn-secondary" onclick={cancel}>Cancel</button>
        <button
          class="btn btn-primary"
          onclick={confirmDestination}
          disabled={!selectedDestination || modalOpen}
        >
          {modalOpen ? "Processing…" : "Add Videos"}
        </button>
      </footer>

      {#if job.state === "failed" && job.retryable}
        <div class="retry-banner">
          <p>Previous attempt failed: {job.error}</p>
          <button class="btn btn-outline" onclick={retryJob}>Retry with Current Selection</button>
        </div>
      {/if}
    </div>
  {/if}
</main>

<style>
  .choose-destination {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
    max-width: 640px;
    margin: 0 auto;
  }

  .view-header {
    text-align: center;
  }

  .view-header h1 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-color);
  }

  .subtitle {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .subtitle .reason {
    color: var(--warning-color, #e67e22);
    font-size: 13px;
  }

  .view-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
    margin-top: 8px;
  }

  .retry-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: var(--warning-color, #e67e22) 15;
    border: 1px solid var(--warning-color, #e67e22);
    border-radius: 8px;
    color: var(--warning-color, #e67e22);
    font-size: 13px;
  }

  .retry-banner p {
    margin: 0;
    flex: 1;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    gap: 16px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .modal-processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 20px;
  }

  @media (max-width: 480px) {
    .choose-destination {
      padding: 16px;
    }

    .view-footer {
      flex-direction: column-reverse;
    }

    .view-footer .btn {
      width: 100%;
    }

    .retry-banner {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
