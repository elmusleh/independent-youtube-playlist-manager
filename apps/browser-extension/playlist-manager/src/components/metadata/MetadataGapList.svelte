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
  }: {
    gaps: NormalizedVideoMeta[];
    retrying: Record<string, boolean>;
    onRetry: (videoId: string) => void;
  } = $props();

  const REASON_LABELS: Record<MetadataGapReason, string> = {
    missing_title: "no title",
    missing_channel: "no channel",
    missing_duration: "no duration",
    empty: "empty",
  };

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
  {#each gaps as g (g.videoId)}
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
    border-radius: var(--radius-card, 10px);
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
