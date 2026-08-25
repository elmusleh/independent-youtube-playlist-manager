<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faBars,
    faEarthAmericas,
    faLock,
    faLockOpen,
    faRotateRight,
    faTrash,
    faCloudArrowDown,
    faArrowUpRightFromSquare,
    faPencil,
    faCloudArrowUp,
    faHourglass,
    faHeart,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";
  import type { Playlist } from "../../types/model";

  let {
    playlist,
    selected = false,
    onToggleSelect,
    onDelete,
    onEdit,
    onRefresh,
    onOpenYoutube,
    onSaveOffline,
    onDragStart,
    onDragOver,
    onDrop,
    onDragLeave,
    isDragging = false,
    isDragOver = false,
  }: {
    playlist: any;
    selected?: boolean;
    onToggleSelect: (id: string) => void;
    onDelete: (p: any) => void;
    onEdit: (id: string) => void;
    onRefresh: (id: string) => void;
    onOpenYoutube?: (p: any) => void;
    onSaveOffline?: (id: string) => void;
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDragLeave: () => void;
    isDragging?: boolean;
    isDragOver?: boolean;
  } = $props();

  const isLocal = $derived(playlist.isLocal);
  const privacy = $derived(playlist.privacyStatus || "private");
</script>

<div
  class="list-row {selected ? 'selected' : ''} {isDragging ? 'dragging' : ''} {isDragOver
    ? 'drag-over'
    : ''}"
  draggable="true"
  ondragstart={onDragStart}
  ondragover={onDragOver}
  ondrop={onDrop}
  ondragleave={onDragLeave}
  onclick={() => onToggleSelect(playlist.id)}
  onkeydown={(e) => (e.key === "Enter" || e.key === " ") && onToggleSelect(playlist.id)}
  role="button"
  tabindex="0"
>
  <div class="row-handle">
    <Fa icon={faBars} fw />
  </div>

  <div class="row-check">
    <input
      type="checkbox"
      checked={selected}
      onclick={(e) => {
        e.stopPropagation();
        onToggleSelect(playlist.id);
      }}
      aria-label="Select playlist"
    />
  </div>

  <div class="row-thumb">
    {#if playlist.thumbnailUrl}
      <img src={playlist.thumbnailUrl} alt={playlist.title} loading="lazy" />
    {:else}
      <div class="thumb-placeholder">
        <Fa icon={faBars} size="lg" />
      </div>
    {/if}
  </div>

  <div class="row-main">
    <div class="playlist-title-row">
      <span class="row-title">{playlist.title}</span>
      {#if playlist.id === "WL" || playlist.id === (window as any)._watchLaterId}
        <span class="badge system-badge" title="Watch Later">
          <Fa icon={faHourglass} fw />
        </span>
      {:else if playlist.id === "LIKED"}
        <span class="badge liked-badge" title="Liked Videos">
          <Fa icon={faHeart} fw />
        </span>
      {:else if playlist.id === "UPLOADS"}
        <span class="badge uploads-badge" title="My Uploads">
          <Fa icon={faCloudArrowUp} fw />
        </span>
      {/if}
      {#if !isLocal}
        <div class="privacy-badge {privacy}">
          <Fa
            icon={privacy === "public"
              ? faEarthAmericas
              : privacy === "unlisted"
                ? faLockOpen
                : faLock}
            fw
          />
          <span>{privacy}</span>
        </div>
      {/if}
    </div>
    <div class="row-meta">
      <span>{playlist.videoCount || 0} videos</span>
      <span>•</span>
      <span>{isLocal ? "Local" : "YouTube Sync"}</span>
      {#if playlist.timestamp}
        <span>•</span>
        <span>{new Date(playlist.timestamp).toLocaleDateString()}</span>
      {/if}
    </div>
  </div>

  <div class="row-actions">
    <SimpleButton
      iconOnly
      secondary
      onclick={(e) => {
        e.stopPropagation();
        onEdit(playlist.id);
      }}
      title="Edit playlist"
    >
      <Fa icon={faPencil} fw />
    </SimpleButton>

    <SimpleButton
      iconOnly
      secondary
      onclick={(e) => {
        e.stopPropagation();
        onRefresh(playlist.id);
      }}
      title="Refresh metadata"
    >
      <Fa icon={faRotateRight} fw />
    </SimpleButton>

    {#if !isLocal}
      {#if onOpenYoutube}
        <SimpleButton
          iconOnly
          secondary
          onclick={(e) => {
            e.stopPropagation();
            onOpenYoutube(playlist);
          }}
          title="Open in YouTube"
        >
          <Fa icon={faArrowUpRightFromSquare} fw />
        </SimpleButton>
      {/if}
      {#if onSaveOffline}
        <SimpleButton
          iconOnly
          secondary
          onclick={(e) => {
            e.stopPropagation();
            onSaveOffline(playlist.id);
          }}
          title="Save offline copy"
        >
          <Fa icon={faCloudArrowDown} fw />
        </SimpleButton>
      {/if}
    {/if}

    <SimpleButton
      iconOnly
      danger
      onclick={(e) => {
        e.stopPropagation();
        onDelete(playlist);
      }}
      title="Delete playlist"
    >
      <Fa icon={faTrash} fw />
    </SimpleButton>
  </div>
</div>

<style>
  @import "../../css/view-layout.css";

  .list-row.dragging {
    opacity: 0.5;
    background: var(--active-bg-color);
  }

  .list-row.drag-over {
    border-top: 2px solid var(--primary-color);
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    color: var(--text-muted);
  }

  .playlist-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .privacy-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .privacy-badge.public {
    background: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }
  .privacy-badge.unlisted {
    background: rgba(158, 158, 158, 0.1);
    color: #9e9e9e;
  }
  .privacy-badge.private {
    background: rgba(255, 152, 0, 0.1);
    color: #ff9800;
  }

  .badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 10px;
  }
  .system-badge {
    background: #607d8b;
    color: #fff;
  }
  .liked-badge {
    background: #f44336;
    color: #fff;
  }
  .uploads-badge {
    background: #2196f3;
    color: #fff;
  }
</style>
