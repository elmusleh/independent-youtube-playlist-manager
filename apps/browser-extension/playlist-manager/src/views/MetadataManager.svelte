<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Fa from "svelte-fa";
  import { faWandMagicSparkles, faRotateRight, faTrash } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../components/SimpleButton.svelte";
  import ViewHeader from "../components/ViewHeader.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import MetadataStatGrid from "../components/metadata/MetadataStatGrid.svelte";
  import MetadataEngineList from "../components/metadata/MetadataEngineList.svelte";
  import MetadataIssueQueue from "../components/metadata/MetadataIssueQueue.svelte";
  import MetadataUsageEstimate from "../components/metadata/MetadataUsageEstimate.svelte";
  import { requestConfirm } from "../stores/confirmation.js";
  import { logger } from "../services/logger";
  import { enrichVideoMetadata } from "../services/enrichment-service.js";
  import { describeEngines } from "../services/metadata-engines";
  import { readDataApiHealth } from "../services/data-api-health";
  import type { DataApiHealth } from "../services/data-api-health";
  import type { MetadataEngineStatus } from "../services/metadata-engines";
  import { isTerminalEntry, needsDurationRefresh } from "../utils/metadata-completeness.js";
  import type { MetadataGapSummary } from "../utils/metadata-completeness";
  import type { NormalizedVideoMeta } from "../types/model";

  let summary = $state<MetadataGapSummary | null>(null);
  let gaps = $state<NormalizedVideoMeta[]>([]);
  let unavailable = $state<NormalizedVideoMeta[]>([]);
  let origins = $state<Record<string, Array<{ id: string; title: string }>>>({});
  let scanning = $state(false);
  let refreshing = $state(false);
  let progressText = $state("");
  let retrying = $state<Record<string, boolean>>({});
  let bulkRetrying = $state(false);
  let engines = $state<MetadataEngineStatus[]>([]);
  let enginesLoaded = $state(false);
  let dataApiReady = $state(false);
  let dataApiState = $state("Checking…");
  let apiHealth = $state<DataApiHealth | null>(null);
  let durationGapCount = $derived(gaps.filter((gap) => needsDurationRefresh(gap)).length);

  function plural(count: number, one: string, many: string): string {
    return count === 1 ? one : many;
  }

  async function loadEngines() {
    try {
      engines = describeEngines(await window.getSettings(), dataApiReady, dataApiState);
    } catch (e) {
      logger.error("[DATA-MANAGER] Failed to load engine settings:", e);
    } finally {
      enginesLoaded = true;
    }
  }

  async function loadDataApiStatus() {
    let apiKey = false;
    let signedIn = false;
    try {
      const result = await browser.storage.local.get("custom_yt_credentials");
      apiKey = Boolean(result.custom_yt_credentials?.apiKey);
    } catch {}
    try {
      signedIn = typeof window.isSignedIn === "function" ? await window.isSignedIn() : false;
    } catch {}
    dataApiReady = apiKey || signedIn;
    dataApiState = apiKey ? "API key" : signedIn ? "Signed in" : "Not configured";
    apiHealth = await readDataApiHealth();
    if (apiHealth.blockedUntil > Date.now()) {
      if (apiHealth.state === "quota_exceeded") dataApiState = "Quota paused";
      else if (apiHealth.state === "invalid") dataApiState = "API key invalid";
      else if (apiHealth.state === "rate_limited") dataApiState = "Rate-limited";
    }
  }

  async function loadOrigins() {
    try {
      const playlists = await window.getPlaylists();
      const map: Record<string, Array<{ id: string; title: string }>> = {};
      for (const playlist of playlists || []) {
        for (const videoId of playlist.videos || []) {
          if (!videoId) continue;
          (map[videoId] ||= []).push({ id: playlist.id, title: playlist.title });
        }
      }
      origins = map;
    } catch (e) {
      logger.error("[DATA-MANAGER] Failed to load playlist origins:", e);
    }
  }

  async function scan() {
    scanning = true;
    try {
      summary = await window.getMetadataGapSummary();
      gaps = await window.getMetadataGaps();
      unavailable =
        typeof window.getUnavailableMetadata === "function"
          ? await window.getUnavailableMetadata()
          : [];
      apiHealth = await readDataApiHealth();
    } catch (e) {
      logger.error("[DATA-MANAGER] Scan failed:", e);
    } finally {
      scanning = false;
    }
  }

  /**
   * Announce a cache change exactly once. This view re-scans from the listener
   * below and the Sidebar badge updates from the same event, so callers must
   * not scan as well.
   */
  function notifyChanged() {
    window.dispatchEvent(new Event("yph-metadata-changed"));
  }

  /** Report what actually happened, not how many ids were requested. */
  function reportRefresh(resolved: number, unresolved: number) {
    if (resolved === 0) {
      window.error(
        `No metadata could be resolved for ${unresolved} ${plural(unresolved, "entry", "entries")}. Nothing was deleted — the cache is unchanged.`
      );
      return;
    }
    if (unresolved === 0) {
      window.success(`Refreshed metadata for ${resolved} ${plural(resolved, "video", "videos")}.`);
      return;
    }
    window.info(
      `Refreshed ${resolved} of ${resolved + unresolved}. ${unresolved} could not be resolved and ${plural(unresolved, "was", "were")} left unchanged.`
    );
  }

  async function refreshIds(ids: string[], label: string) {
    if (refreshing || ids.length === 0) return;
    refreshing = true;
    progressText = `${label} (0 of ${ids.length})…`;
    try {
      const { metaMap, unavailableIds } = await enrichVideoMetadata(ids, {
        force: true,
        onProgress: (fetched, total) => {
          progressText = `${label} (${fetched} of ${total})…`;
        },
      });
      reportRefresh(metaMap.size, unavailableIds.length);
      notifyChanged();
    } catch (e) {
      logger.error("[DATA-MANAGER] Refresh failed:", e);
      window.error("Metadata refresh failed. The cached entries were left untouched.");
    } finally {
      refreshing = false;
      progressText = "";
    }
  }

  function refreshMissing() {
    void refreshIds(
      gaps.map((gap) => gap.videoId),
      "Fetching metadata"
    );
  }

  function refreshDurations() {
    void refreshIds(
      gaps.filter((gap) => needsDurationRefresh(gap)).map((gap) => gap.videoId),
      "Fetching durations"
    );
  }

  async function retrySelectedUnavailable(ids: string[]) {
    if (!ids.length || bulkRetrying || refreshing) return;
    const count = ids.length;
    requestConfirm({
      title: "Retry Unavailable Videos?",
      message: `Re-check ${count} unavailable ${plural(count, "video", "videos")}? Successfully restored videos will leave the tombstone list; anything still unavailable stays cached.`,
      color: "primary",
      confirmLabel: `Retry ${count}`,
      onConfirm: async () => {
        bulkRetrying = true;
        progressText = `Re-checking unavailable videos (0 of ${count})…`;
        try {
          const { metaMap } = await enrichVideoMetadata(ids, {
            force: true,
            onProgress: (fetched, total) => {
              progressText = `Re-checking unavailable videos (${fetched} of ${total})…`;
            },
          });
          const terminal = [...metaMap.values()].filter(isTerminalEntry).length;
          const restored = metaMap.size - terminal;
          const failed = ids.length - metaMap.size;
          window.info(
            `Re-checked ${ids.length}: ${restored} restored, ${terminal} still unavailable${failed ? `, ${failed} could not be checked` : ""}.`
          );
          notifyChanged();
        } catch (e) {
          logger.error("[DATA-MANAGER] Bulk retry failed:", e);
          window.error("Bulk retry failed. The cached entries were left untouched.");
        } finally {
          bulkRetrying = false;
          progressText = "";
        }
      },
    });
  }

  function removeIncomplete() {
    if (!gaps.length) return;
    const count = gaps.length;
    requestConfirm({
      title: "Remove Incomplete Entries?",
      message: `This deletes ${count} incomplete metadata ${plural(count, "entry", "entries")} from the cache. Their titles and durations are fetched again the next time you open a playlist that contains ${plural(count, "it", "them")}.`,
      color: "danger",
      confirmLabel: "Remove Entries",
      onConfirm: async () => {
        try {
          const removed = await window.clearIncompleteMetadata();
          window.success(`Removed ${removed} incomplete ${plural(removed, "entry", "entries")}.`);
          notifyChanged();
        } catch (e) {
          logger.error("[DATA-MANAGER] Remove failed:", e);
          window.error("Could not remove the incomplete entries.");
        }
      },
    });
  }

  function clearAll() {
    const total = summary?.total ?? 0;
    if (!total) return;
    requestConfirm({
      title: "Clear All Metadata Cache?",
      message: `This permanently deletes all ${total} cached metadata ${plural(total, "entry", "entries")}. Nothing is uploaded — titles and durations are fetched again on demand.`,
      color: "danger",
      confirmLabel: "Clear Cache",
      onConfirm: async () => {
        try {
          await window.clearAllMetadataCache();
          window.success("Metadata cache cleared.");
          notifyChanged();
        } catch (e) {
          logger.error("[DATA-MANAGER] Clear failed:", e);
          window.error("Could not clear the metadata cache.");
        }
      },
    });
  }

  async function retryOne(id: string) {
    if (retrying[id]) return;
    retrying = { ...retrying, [id]: true };
    try {
      const { metaMap } = await enrichVideoMetadata([id], { force: true });
      if (metaMap.has(id)) {
        window.success(`Checked ${id}.`);
      } else {
        window.info(`${id} could not be resolved — it may be private or unavailable.`);
      }
      notifyChanged();
    } catch (e) {
      logger.error("[DATA-MANAGER] Retry failed:", e);
      window.error(`Failed to refresh ${id}. The cached entry was left untouched.`);
    } finally {
      retrying = { ...retrying, [id]: false };
    }
  }

  function forgetUnavailable(id: string) {
    requestConfirm({
      title: "Forget Unavailable Video?",
      message: `Remove ${id} from the metadata cache? It may be fetched again the next time a playlist contains it.`,
      color: "danger",
      confirmLabel: "Forget",
      onConfirm: async () => {
        try {
          await window.videoService.clearCache([id]);
          window.success(`Removed ${id} from the cache.`);
          notifyChanged();
        } catch (e) {
          logger.error("[DATA-MANAGER] Forget failed:", e);
          window.error(`Could not remove ${id} from the cache.`);
        }
      },
    });
  }

  onMount(() => {
    void (async () => {
      await loadDataApiStatus();
      await loadEngines();
      loadOrigins();
      scan();
    })();
  });

  window.addEventListener("yph-metadata-changed", scan);

  onDestroy(() => {
    window.removeEventListener("yph-metadata-changed", scan);
  });
</script>

<main class="view-scroll-container metadata-manager">
  <div class="view-body">
    <StickyHeader>
      {#snippet children()}
        <ViewHeader icon={faWandMagicSparkles} title="Data Manager">
          {#snippet rightActions()}
            <SimpleButton onclick={scan} disabled={scanning} title="Re-scan the metadata cache">
              <Fa icon={faRotateRight} />
              {scanning ? "Scanning…" : "Re-scan"}
            </SimpleButton>
          {/snippet}
        </ViewHeader>
      {/snippet}
    </StickyHeader>

    <p class="intro">
      Inspect the metadata cache, find videos whose titles or durations were lost, and re-fetch
      them. Duration is the field most often dropped, so entries that have a title and channel but
      no duration are surfaced first. Refresh uses Innertube first; if gaps remain, add a free
      <a href="#/api-setup">YouTube Data API key</a> for the most reliable duration fallback.
      Deleted or private videos are kept as tombstones so they are not fetched repeatedly; switch to
      the <strong>Unavailable</strong> tab to inspect them.
    </p>

    {#if summary}
      <MetadataStatGrid {summary} />

      <section class="panel">
        <h3>Usage Estimate</h3>
        <MetadataUsageEstimate {summary} {dataApiReady} {dataApiState} health={apiHealth} />
      </section>

      <section class="panel">
        <h3>Repair Metadata</h3>
        <p class="sub-text">
          Refreshing never deletes what is already cached: a video that fails to resolve keeps its
          previous title, channel and duration. Use the tabs to switch between incomplete and
          unavailable videos.
        </p>
        <div class="action-row">
          <SimpleButton primary onclick={refreshMissing} disabled={refreshing || !gaps.length}>
            <Fa icon={faRotateRight} /> Refresh Missing Metadata
          </SimpleButton>
          <SimpleButton
            onclick={refreshDurations}
            disabled={refreshing || durationGapCount === 0}
            title="Only re-fetch entries with a title and channel but no duration"
          >
            <Fa icon={faRotateRight} /> Refresh Durations ({durationGapCount})
          </SimpleButton>
          <SimpleButton danger onclick={removeIncomplete} disabled={!gaps.length}>
            <Fa icon={faTrash} /> Remove Incomplete Entries
          </SimpleButton>
          <SimpleButton danger onclick={clearAll} disabled={!summary.total}>
            <Fa icon={faTrash} /> Clear All Cache
          </SimpleButton>
        </div>
        <p class="progress-text" role="status" aria-live="polite">{progressText}</p>

        <MetadataIssueQueue
          {gaps}
          {unavailable}
          {retrying}
          {origins}
          onRetry={retryOne}
          onForget={forgetUnavailable}
          onRetrySelected={retrySelectedUnavailable}
          {bulkRetrying}
        />
      </section>

      <section class="panel">
        <h3>Extraction Engines</h3>
        <p class="sub-text">
          Page cache is read during capture; fallback sources are tried in order. Select a source to
          see its cost, request volume, duration support and caveats.
        </p>
        {#if enginesLoaded}
          <MetadataEngineList {engines} />
        {:else}
          <p class="sub-text">Loading engine status…</p>
        {/if}
      </section>
    {:else}
      <div class="loading-state">
        <p>{scanning ? "Scanning metadata cache…" : "Loading…"}</p>
      </div>
    {/if}
  </div>
</main>

<style>
  .intro {
    color: var(--color-text-secondary, var(--text-muted));
    font-size: var(--font-size-sm, 13px);
    line-height: 1.5;
    margin: 0 0 var(--space-5, 20px);
  }

  .panel {
    background-color: var(--color-bg-elevated, var(--background-color));
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: var(--radius-card, 10px);
    padding: var(--space-5, 20px);
    margin-bottom: var(--space-4, 16px);
  }

  .panel h3 {
    margin: 0 0 var(--space-2, 8px);
    font-size: var(--font-size-base, 14px);
  }

  .sub-text {
    color: var(--color-text-secondary, var(--text-muted));
    font-size: var(--font-size-sm, 13px);
    margin: 0 0 var(--space-3, 12px);
    line-height: 1.5;
  }

  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 8px);
  }

  .progress-text {
    margin: var(--space-3, 12px) 0 0;
    min-height: 1em;
    font-size: var(--font-size-sm, 13px);
    color: var(--color-text-secondary, var(--text-muted));
  }

  .loading-state {
    padding: var(--space-6, 24px);
    text-align: center;
    color: var(--color-text-secondary, var(--text-muted));
  }
</style>
