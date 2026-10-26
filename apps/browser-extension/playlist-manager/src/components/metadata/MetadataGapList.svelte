<script lang="ts">
  import Fa from "svelte-fa";
  import { faRotateRight, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import { getMetadataGaps } from "../../utils/metadata-completeness";
  import type { MetadataGapReason } from "../../utils/metadata-completeness";
  import type { NormalizedVideoMeta } from "../../types/model";

  let {
    gaps,
    retrying,
    onRetry,
    pageSize = 100,
  }: {
    gaps: NormalizedVideoMeta[];
    retrying: Record<string, boolean>;
    onRetry: (videoId: string) => void;
    pageSize?: number;
  } = $props();

  const REASON_LABELS: Record<MetadataGapReason, string> = {
    missing_title: "no title",
    missing_channel: "no channel",
    missing_duration: "no duration",
    empty: "empty",
  };

  let showAll = $state(false);

  // A cache can hold thousands of gaps; render a bounded window so opening the
  // view never stalls on hundreds of thumbnails.
  let visible = $derived(showAll ? gaps : gaps.slice(0, pageSize));
  let hidden = $derived(Math.max(0, gaps.length - visible.length));

  function reasonLabel(g: NormalizedVideoMeta): string {
    const reasons = getMetadataGaps(g).reasons;
    if (!reasons.length) return "incomplete";
    return reasons.map((r) => REASON_LABELS[r]).join(", ");
  }
</script>

<p class="sub-text">
  <Fa icon={faCircleInfo} /> These entries will be re-fetched on demand, but you can refresh them now
  to avoid waiting later.
</p>

<div class="gap-list">
  {#each visible as g (g.videoId)}
    <div class="gap-row">
      <img
        class="gap-thumb"
        src="https://i.ytimg.com/vi/{g.videoId}/default.jpg"
        alt=""
        loading="lazy"
      />
      <div class="gap-info">
        <div class="gap-title">{g.title || g.videoId}</div>
        <div class="gap-meta">{g.videoId} · {reasonLabel(g)}</div>
      </div>
      <SimpleButton
        onclick={() => onRetry(g.videoId)}
        disabled={retrying[g.videoId]}
        title="Re-fetch this video's metadata"
      >
        <Fa icon={faRotateRight} /> Retry
      </SimpleButton>
    </div>
  {/each}
</div>

{#if hidden > 0}
  <SimpleButton onclick={() => (showAll = true)}>
    Show {hidden} more {hidden === 1 ? "entry" : "entries"}
  </SimpleButton>
{:else if showAll && gaps.length > pageSize}
  <SimpleButton onclick={() => (showAll = false)}>Show first {pageSize}</SimpleButton>
{/if}

<style>
  .sub-text {
    color: var(--color-text-secondary, var(--text-muted));
    font-size: var(--font-size-sm, 13px);
    margin: 0 0 var(--space-3, 12px);
    line-height: 1.5;
  }

  .gap-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
    margin-bottom: var(--space-3, 12px);
  }

  .gap-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: var(--space-2, 8px);
    border: 1px solid var(--color-border-secondary, var(--border-color));
    border-radius: var(--radius-button, 8px);
  }

  .gap-thumb {
    width: 48px;
    height: 36px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
    background-color: var(--color-bg-hover, transparent);
  }

  .gap-info {
    flex: 1;
    min-width: 0;
  }

  .gap-title {
    font-size: var(--font-size-sm, 13px);
    font-weight: var(--font-weight-medium, 500);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gap-meta {
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-tertiary, var(--text-muted));
    margin-top: 2px;
  }

  @media (max-width: 768px) {
    .gap-row {
      flex-wrap: wrap;
    }
  }
</style>
