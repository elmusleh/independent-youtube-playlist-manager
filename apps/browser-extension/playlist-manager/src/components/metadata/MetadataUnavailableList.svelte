<script lang="ts">
  import Fa from "svelte-fa";
  import { faRotateRight, faTrash, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import type { NormalizedVideoMeta } from "../../types/model";

  type Origin = { id: string; title: string };

  let {
    items,
    retrying,
    origins,
    onRetry,
    onForget,
    selected,
    onToggleSelect,
  }: {
    items: NormalizedVideoMeta[];
    retrying: Record<string, boolean>;
    origins: Record<string, Origin[]>;
    onRetry: (videoId: string) => void;
    onForget: (videoId: string) => void;
    selected: ReadonlySet<string>;
    onToggleSelect: (videoId: string) => void;
  } = $props();

  function displayTitle(meta: NormalizedVideoMeta): string {
    const title = (meta.title || "").trim();
    if (!title || /^\[?(unavailable|private|deleted)/i.test(title)) return "[Unavailable Video]";
    return title;
  }

  function reason(meta: NormalizedVideoMeta): string {
    if (meta.isDeleted) return "Deleted";
    if (meta.isPrivate) return "Private";
    if (meta.isBroken) return "Unplayable";
    if (meta.isUnavailable) return "Deleted or unavailable";
    return "Unavailable";
  }

  function originEntries(videoId: string): Origin[] {
    return (origins[videoId] || []).slice(0, 3);
  }

  function extraOriginCount(videoId: string): number {
    return Math.max(0, (origins[videoId] || []).length - 3);
  }

  function checkedLabel(meta: NormalizedVideoMeta): string {
    const timestamp = meta.lastFetchAttempt;
    if (!timestamp) return "not checked yet";
    const diff = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
</script>

<p class="sub-text">
  <Fa icon={faCircleInfo} /> These videos are kept as tombstones so they are not fetched on every playlist
  load. Retry checks again; Forget removes the cached entry.
</p>

<div class="gap-list">
  {#each items as item (item.videoId)}
    <div class="gap-row">
      <label class="select-box" title="Select this video for a bulk retry">
        <input
          type="checkbox"
          checked={selected.has(item.videoId)}
          onchange={() => onToggleSelect(item.videoId)}
          aria-label={`Select ${displayTitle(item)}`}
        />
      </label>
      <img
        class="gap-thumb"
        src="https://i.ytimg.com/vi/{item.videoId}/default.jpg"
        alt=""
        loading="lazy"
        onerror={(event) => {
          const image = event.currentTarget as HTMLImageElement;
          image.style.visibility = "hidden";
        }}
      />
      <div class="gap-info">
        <div class="gap-title">{displayTitle(item)}</div>
        <div class="gap-meta">
          {item.videoId} · {reason(item)} · Checked {checkedLabel(item)} · Origin:
          {#if originEntries(item.videoId).length}
            {#each originEntries(item.videoId) as origin, index (origin.id)}
              <a href={`#/playlist?id=${encodeURIComponent(origin.id)}`}>{origin.title}</a
              >{#if index < originEntries(item.videoId).length - 1},
              {/if}
            {/each}
            {#if extraOriginCount(item.videoId) > 0}
              +{extraOriginCount(item.videoId)}
            {/if}
          {:else}
            unknown
          {/if}
        </div>
      </div>
      <div class="gap-actions">
        <SimpleButton
          onclick={() => onRetry(item.videoId)}
          disabled={retrying[item.videoId]}
          title="Check this video again"
        >
          <Fa icon={faRotateRight} /> Retry
        </SimpleButton>
        <SimpleButton
          danger
          onclick={() => onForget(item.videoId)}
          title="Remove this tombstone from the cache"
        >
          <Fa icon={faTrash} /> Forget
        </SimpleButton>
      </div>
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

  .select-box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 36px;
    flex-shrink: 0;
    cursor: pointer;
  }

  .select-box input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--color-brand-primary, var(--primary-color));
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
    overflow-wrap: anywhere;
  }

  .gap-meta a {
    color: var(--color-brand-primary, var(--primary-color));
  }

  .gap-actions {
    display: flex;
    gap: var(--space-2, 8px);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .gap-row {
      flex-wrap: wrap;
    }

    .gap-actions {
      width: 100%;
    }
  }
</style>
