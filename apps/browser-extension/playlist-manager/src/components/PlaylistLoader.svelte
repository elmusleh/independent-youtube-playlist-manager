<script lang="ts">
  import { onDestroy } from "svelte";
  import Fa from "svelte-fa";
  import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
  import { faPencil, faXmark } from "@fortawesome/free-solid-svg-icons";
  import PlaylistEditor from "./PlaylistEditor.svelte";
  import PlaylistSkeleton from "./skeletons/PlaylistSkeleton.svelte";
  import ErrorState from "./ErrorState.svelte";
  import ViewHeader from "./ViewHeader.svelte";
  import StickyHeader from "./StickyHeader.svelte";
  import EmptyState from "./EmptyState.svelte";
  import SimpleButton from "./SimpleButton.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import type { Playlist, Settings } from "../types/model";

  const browser = (window as any).browser || (window as any).chrome;

  let {
    id = null,
    isFavorite = false,
    pageTitle = "Playlist",
    pageIcon,
  }: {
    id?: string | null;
    isFavorite?: boolean;
    pageTitle?: string;
    pageIcon: IconDefinition;
  } = $props();

  type ViewState = "loading" | "not-set" | "youtube-native" | "ready" | "error";
  let viewState: ViewState = $state("loading");
  let status = $state(new StatusManager());
  let playlist: Playlist | null = $state(null);
  let errorMessage = $state("");
  let signedIn = $state(false);
  let editingTitle = $state(false);

  async function checkAuth() {
    signedIn = await window.isSignedIn();
  }

  async function loadData() {
    viewState = "loading";
    errorMessage = "";

    try {
      let targetId = id;
      const settings: Settings = await window.getSettings();

      if (isFavorite) {
        targetId = settings.watchLaterPlaylistId;
        if (targetId === undefined) {
          viewState = "not-set";
          return;
        }
        if (targetId === null) {
          viewState = "youtube-native";
          return;
        }
      } else {
        // Handle alias
        if (targetId === "WL" && settings.watchLaterPlaylistId) {
          targetId = settings.watchLaterPlaylistId;
        }
      }

      if (!targetId) {
        errorMessage = "No playlist selected or provided.";
        viewState = "error";
        return;
      }

      const isLocal = targetId.startsWith("local-");
      if (!isLocal && !signedIn) {
        // We might be loading, but we need auth for YT playlists
        // One more check
        signedIn = await window.isSignedIn();
        if (!signedIn) {
          viewState = "ready"; // Editor will show AuthPlaceholder if needed
          // But wait, if we can't get the playlist object, we can't show the editor
          // Let's try to get it, window.getPlaylist might handle guest access if public
        }
      }

      playlist = await window.getPlaylist(targetId);

      if (playlist) {
        viewState = "ready";
      } else {
        errorMessage = "Playlist not found. It may have been deleted or you no longer have access.";
        viewState = "error";
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("PlaylistLoader failed to load:", e);
      errorMessage = "Failed to load playlist. Please check your connection.";
      viewState = "error";
    }
  }

  async function refresh() {
    await status.refresh(async () => {
      await loadData();
    });
  }

  function handleStorageChange(changes: any, area: string) {
    if (isFavorite && area === "sync" && "watchLaterPlaylistId" in changes) {
      loadData();
    }
    if (area === "local" && "yt_auth_token_cache" in changes) {
      checkAuth().then(() => {
        if (viewState === "loading" || viewState === "error") loadData();
      });
    }
  }

  // Initial load on mount (needed for Favorite page where id is null)
  checkAuth().then(loadData);

  // Skip first effect run since initial load is handled above; reload on subsequent id changes
  let firstEffectRun = true;
  $effect(() => {
    // Reference id so effect re-runs whenever it changes
    void id;
    if (firstEffectRun) {
      firstEffectRun = false;
      return;
    }
    checkAuth().then(loadData);
  });

  browser.storage.onChanged.addListener(handleStorageChange);
  onDestroy(() => {
    browser.storage.onChanged.removeListener(handleStorageChange);
  });
</script>

<main class="view-scroll-container">
  {#if viewState !== "ready"}
    <div class="view-body">
      <StickyHeader>
        {#snippet children()}
          <ViewHeader
            icon={pageIcon}
            title={playlist?.title || pageTitle}
            count={playlist?.videos?.length || 0}
            bind:editingTitle
            onTitleChange={(newTitle) => {
              if (playlist) {
                playlist.title = newTitle;
                status.markDirty();
              }
            }}
            showSaveStatus={true}
            {status}
            onSave={refresh}
          />
        {/snippet}
      </StickyHeader>

      {#if viewState === "loading"}
        <div class="loading-state">
          <PlaylistSkeleton rows={8} />
        </div>
      {:else if viewState === "not-set"}
        <EmptyState
          icon={pageIcon}
          title="No Favorite Playlist Set"
          message="You haven't picked a favorite playlist yet. Go to Settings to choose one."
          actionLabel="Go to Settings"
          actionHref="#/settings"
        />
      {:else if viewState === "youtube-native"}
        <EmptyState
          icon={pageIcon}
          title="YouTube Watch Later"
          message="Your favorite is set to YouTube's native Watch Later. Manage it directly on YouTube."
          actionLabel="Open on YouTube"
          actionHref="https://www.youtube.com/playlist?list=WL"
        />
      {:else if viewState === "error"}
        <ErrorState message={errorMessage} onRetry={loadData} showSettings={true} />
      {/if}
    </div>
  {:else if viewState === "ready" && playlist}
    <PlaylistEditor
      {playlist}
      {pageTitle}
      {pageIcon}
      {signedIn}
      isFavoritePage={isFavorite}
      bind:status
    />
  {/if}
</main>

<style>
  @import "../css/view-layout.css";

  .loading-state {
    padding-top: 20px;
  }
</style>
