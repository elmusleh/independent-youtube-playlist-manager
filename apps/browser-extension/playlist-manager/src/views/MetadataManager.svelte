<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Fa from "svelte-fa";
  import {
    faWandMagicSparkles,
    faRotateRight,
    faTrash,
    faCircleCheck,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../components/SimpleButton.svelte";
  import ViewHeader from "../components/ViewHeader.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import MetadataStatGrid from "../components/metadata/MetadataStatGrid.svelte";
  import MetadataEngineList from "../components/metadata/MetadataEngineList.svelte";
  import MetadataGapList from "../components/metadata/MetadataGapList.svelte";
  import { requestConfirm } from "../stores/confirmation.js";
  import { logger } from "../services/logger";
  import { enrichVideoMetadata } from "../services/enrichment-service.js";
  import { describeEngines } from "../services/metadata-engines";
  import type { MetadataEngineStatus } from "../services/metadata-engines";
  import type { MetadataGapSummary } from "../utils/metadata-completeness";
  import type { NormalizedVideoMeta } from "../types/model";

  let summary = $state<MetadataGapSummary | null>(null);
  let gaps = $state<NormalizedVideoMeta[]>([]);
  let scanning = $state(false);
  let refreshing = $state(false);
  let progressText = $state("");
  let retrying = $state<Record<string, boolean>>({});
  let engines = $state<MetadataEngineStatus[]>([]);
  let enginesLoaded = $state(false);

  function plural(count: number, one: string, many: string): string {
    return count === 1 ? one : many;
  }

  async function loadEngines() {
    try {
      engines = describeEngines(await window.getSettings());
    } catch (e) {
      logger.error("[DATA-MANAGER] Failed to load engine settings:", e);
    } finally {
      enginesLoaded = true;
    }
  }

  async function scan() {
    scanning = true;
    try {
      summary = await window.getMetadataGapSummary();
      gaps = await window.getMetadataGaps();
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

  async function refreshMissing() {
    if (refreshing || !gaps.length) return;
    const ids = gaps.map((g) => g.videoId);
    refreshing = true;
    progressText = `Fetching metadata (0 of ${ids.length})…`;
    try {
      const { metaMap, unavailableIds } = await enrichVideoMetadata(ids, {
        force: true,
        onProgress: (fetched, total) => {
          progressText = `Fetching metadata (${fetched} of ${total})…`;
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
        window.success(`Refreshed ${id}.`);
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

  onMount(() => {
    loadEngines();
    scan();
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
      no duration are surfaced first.
    </p>

    {#if summary}
      <MetadataStatGrid {summary} />

      <section class="panel">
        <h3>Actions</h3>
        <p class="sub-text">
          Refreshing never deletes what is already cached: a video that fails to resolve keeps its
          previous title, channel and duration.
        </p>
        <div class="action-row">
          <SimpleButton primary onclick={refreshMissing} disabled={refreshing || !gaps.length}>
            <Fa icon={faRotateRight} /> Refresh Missing Metadata
          </SimpleButton>
          <SimpleButton danger onclick={removeIncomplete} disabled={!gaps.length}>
            <Fa icon={faTrash} /> Remove Incomplete Entries
          </SimpleButton>
          <SimpleButton danger onclick={clearAll} disabled={!summary.total}>
            <Fa icon={faTrash} /> Clear All Cache
          </SimpleButton>
        </div>
        <p class="progress-text" role="status" aria-live="polite">{progressText}</p>
      </section>

      <section class="panel">
        <h3>Extraction Engines</h3>
        <p class="sub-text">
          Engines are tried in order until a video resolves. Only the Innertube, Embed and
          Piped/Invidious tiers can return a duration.
        </p>
        {#if enginesLoaded}
          <MetadataEngineList {engines} />
        {:else}
          <p class="sub-text">Loading engine status…</p>
        {/if}
      </section>

      <section class="panel">
        <h3>Incomplete Entries ({gaps.length})</h3>
        {#if gaps.length === 0}
          <p class="sub-text">
            <Fa icon={faCircleCheck} /> Nothing is missing — every cached entry is resolved.
          </p>
        {:else}
          <MetadataGapList {gaps} {retrying} onRetry={retryOne} />
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
