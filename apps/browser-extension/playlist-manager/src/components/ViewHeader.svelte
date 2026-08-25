<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faCloudArrowUp,
    faLink,
    faUndo,
    faXmark,
    faPencil,
    faLock,
    faLockOpen,
    faStar as faStarSolid,
  } from "@fortawesome/free-solid-svg-icons";
  import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
  import { faYoutube } from "@fortawesome/free-brands-svg-icons";
  import { requestConfirm } from "../stores/confirmation";
  import SimpleButton from "./SimpleButton.svelte";
  import SaveStatus from "./SaveStatus.svelte";
  import SyncStatusIndicator from "./SyncStatusIndicator.svelte";
  import type { StatusManager } from "../services/status-manager.svelte";

  let {
    icon,
    title = $bindable(""),
    count = undefined,
    editingTitle = $bindable(false),
    onTitleChange = undefined,
    children,
    // Header actions
    showSyncStatus = false,
    syncStatus = "local",
    showLockButton = false,
    isLocked = false,
    onToggleLock = undefined,
    showSyncButton = false,
    showYoutubeButton = false,
    playlistId = undefined,
    onSync = undefined,
    showAdoptButton = false,
    isAdopting = false,
    onAdopt = undefined,
    showDiscardButton = false,
    onDiscard = undefined,
    showSaveStatus = false,
    status = undefined,
    isDirty = false,
    onSave = undefined,
    rightActions = undefined,
    showFavoriteButton = false,
    isFavorite = false,
    favoriteReadOnly = false,
    onToggleFavorite = undefined,
  }: {
    icon: any;
    title: string;
    count?: number;
    editingTitle?: boolean;
    onTitleChange?: (newTitle: string) => void;
    children?: import("svelte").Snippet;
    // Header actions
    showSyncStatus?: boolean;
    syncStatus?: "local" | "synced" | "online" | "syncing";
    showLockButton?: boolean;
    isLocked?: boolean;
    onToggleLock?: () => void | Promise<void>;
    showSyncButton?: boolean;
    showYoutubeButton?: boolean;
    playlistId?: string;
    onSync?: () => void | Promise<void>;
    showAdoptButton?: boolean;
    isAdopting?: boolean;
    onAdopt?: () => void | Promise<void>;
    showDiscardButton?: boolean;
    onDiscard?: () => void;
    showSaveStatus?: boolean;
    status?: StatusManager;
    isDirty?: boolean;
    onSave?: () => void;
    rightActions?: import("svelte").Snippet;
    showFavoriteButton?: boolean;
    isFavorite?: boolean;
    /** When true, the star is a non-interactive indicator (used on the Favorite Playlist page) */
    favoriteReadOnly?: boolean;
    onToggleFavorite?: () => void | Promise<void>;
  } = $props();

  let originalTitle = $state("");

  $effect(() => {
    if (editingTitle && originalTitle === "") {
      originalTitle = title;
    } else if (!editingTitle && originalTitle !== "") {
      title = originalTitle;
      originalTitle = "";
    }
  });

  function handleSave() {
    editingTitle = false;
    if (title !== originalTitle && title !== undefined) {
      onTitleChange?.(title);
    }
    originalTitle = "";
  }

  export function handleCancel() {
    if (title === originalTitle) {
      editingTitle = false;
      originalTitle = "";
    } else {
      requestConfirm({
        title: "Discard changes?",
        message: "This will reset the title to its original value.",
        color: "default",
        onConfirm: () => {
          title = originalTitle;
          editingTitle = false;
          originalTitle = "";
        },
      });
    }
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  // Force reactivity for discard button visibility
  const shouldShowDiscard = $derived(showDiscardButton === true);

  // Force reactivity for SaveStatus
  const reactiveIsDirty = $derived(isDirty === true);
</script>

<div class="view-header">
  <div class="top-left">
    <h1>
      <Fa {icon} fw />
      {#if !editingTitle}
        {title}
        {#if onTitleChange}
          <button
            type="button"
            class="edit-title-btn"
            onclick={() => (editingTitle = true)}
            title="Edit title"
            aria-label="Edit title"
          >
            <Fa icon={faPencil} />
          </button>
        {/if}
        {#if showFavoriteButton}
          {#if favoriteReadOnly || isFavorite}
            <span
              class="favorite-star-indicator"
              title="This is your Favorite Playlist"
              role="img"
              aria-label="Favorite Playlist"
            >
              <Fa icon={faStarSolid} />
            </span>
          {:else}
            <button
              type="button"
              class="favorite-star-btn"
              class:active={isFavorite}
              onclick={onToggleFavorite}
              title={isFavorite ? "Remove from Favorites" : "Mark as Favorite"}
              aria-label={isFavorite ? "Remove from Favorites" : "Mark as Favorite"}
            >
              <Fa icon={isFavorite ? faStarSolid : faStarRegular} />
            </button>
          {/if}
        {/if}
        {@render children?.()}
      {:else}
        <input
          aria-label="Playlist title"
          class="edit-input"
          type="text"
          bind:value={title}
          onkeydown={(e: KeyboardEvent) => e.key === "Enter" && handleSave()}
          onblur={() =>
            setTimeout(() => {
              if (editingTitle) handleSave();
            }, 200)}
          use:focusOnMount
        />
      {/if}
      {#if count !== undefined && !editingTitle}
        <span class="count-badge">{count}</span>
      {/if}
    </h1>
  </div>

  <div class="btn-group right-align">
    {#if showSyncStatus}
      <div class="header-status">
        <SyncStatusIndicator status={syncStatus} size="md" showText={true} />
      </div>
    {/if}

    {#if showLockButton}
      <SimpleButton
        secondary={isLocked}
        primary={!isLocked}
        onclick={onToggleLock}
        title={isLocked ? "Unlock: Allow auto-delete" : "Lock: Prevent auto-delete"}
      >
        <Fa icon={isLocked ? faLock : faLockOpen} fw />
      </SimpleButton>
    {/if}

    {#if showSyncButton}
      <SimpleButton
        primary
        className="btn-sync"
        onclick={onSync}
        title="Sync this offline playlist to YouTube"
      >
        <Fa icon={faCloudArrowUp} fw />
        <span>Sync to YouTube</span>
      </SimpleButton>
    {/if}

    {#if showYoutubeButton && playlistId}
      <SimpleButton
        primary
        className="btn-youtube"
        onclick={() => window.open(`https://www.youtube.com/playlist?list=${playlistId}`, "_blank")}
        title="Open this playlist on YouTube"
      >
        <Fa icon={faYoutube} fw />
        <span>Open in YouTube</span>
      </SimpleButton>
    {/if}

    {#if showAdoptButton}
      <SimpleButton
        secondary
        onclick={onAdopt}
        disabled={isAdopting}
        title="Add [YPH] tag to description"
      >
        <Fa icon={faLink} fw />
        <span>{isAdopting ? "Adopting..." : "Adopt"}</span>
      </SimpleButton>
    {/if}

    {#if shouldShowDiscard}
      <SimpleButton secondary onclick={onDiscard} title="Discard changes">
        <Fa icon={faUndo} fw />
        <span>Discard</span>
      </SimpleButton>
    {/if}

    {#if showSaveStatus}
      <SaveStatus onclick={onSave} {status} isDirty={reactiveIsDirty} />
    {/if}

    {@render rightActions?.()}
  </div>
</div>

<style>
  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background-color: var(--background-color);
    flex-shrink: 0;
    gap: 16px;
    min-height: 72px;
  }

  .top-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-group.right-align {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h1 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-color);
  }

  :global(h1 svg) {
    width: 24px;
    height: 24px;
    color: var(--primary-color);
    opacity: 0.9;
  }

  .count-badge {
    background: var(--active-bg-color);
    color: var(--primary-color);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--border-color);
    margin-left: 4px;
  }

  .edit-input {
    flex: 1;
    max-width: 500px;
    margin: 0;
    padding: 6px 12px;
    font-size: 24px;
    font-weight: 700;
    border-radius: 8px;
    border: 1px solid var(--primary-color);
    background: var(--hover-color);
    color: var(--text-color);
    box-sizing: border-box;
  }

  .header-status {
    display: flex;
    align-items: center;
    margin-right: 4px;
  }

  .favorite-star-btn {
    background: none;
    border: none;
    padding: 0;
    margin-left: 8px;
    cursor: pointer;
    font-size: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #888);
    transition:
      transform 0.2s,
      color 0.2s;
  }

  .favorite-star-btn:hover {
    transform: scale(1.2);
    color: #ffc107;
  }

  .edit-title-btn {
    background: none;
    border: none;
    padding: 0;
    margin-left: 8px;
    cursor: pointer;
    font-size: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #888);
    transition:
      transform 0.2s,
      color 0.2s;
  }

  .edit-title-btn:hover {
    transform: scale(1.2);
    color: var(--primary-color);
  }

  .favorite-star-btn.active {
    color: #ffc107;
  }

  /* Read-only star shown on the Favorite Playlist page — not a button */
  .favorite-star-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    font-size: 20px;
    color: #ffc107;
    pointer-events: none;
    user-select: none;
  }

  @media (max-width: 768px) {
    .view-header {
      flex-direction: column;
      align-items: flex-start;
      padding: 12px 16px;
      gap: 12px;
      min-height: auto;
    }

    .btn-group.right-align {
      width: 100%;
      flex-wrap: wrap;
    }

    h1 {
      font-size: 20px;
      gap: 8px;
    }

    :global(h1 svg) {
      width: 20px;
      height: 20px;
    }

    .edit-input {
      font-size: 18px;
      max-width: 100%;
    }

    .count-badge {
      font-size: 12px;
      padding: 3px 10px;
    }
  }
</style>
