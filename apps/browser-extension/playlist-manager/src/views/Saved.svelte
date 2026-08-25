<script lang="ts">
  import Fa from "svelte-fa";
  import { faArrowUpRightFromSquare, faListUl, faWrench } from "@fortawesome/free-solid-svg-icons";
  import { faYoutube } from "@fortawesome/free-brands-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import PlaylistCard from "../components/PlaylistCard.svelte";
  import PlaylistGrid from "../components/PlaylistGrid.svelte";
  import FilterBar from "../components/FilterBar.svelte";
  import OfflineNotice from "../components/OfflineNotice.svelte";
  import { playlistsSearch } from "../stores/playlists-filters";
  import { onDestroy } from "svelte";
  import type { Playlist, Settings } from "../types/model";
  import {
    createStorageListener,
    loadLocal,
    init as initLoader,
    ytPlaylistsLoader,
  } from "../services/playlist-data-loader";
  import {
    createCardActions,
    requestAdoptConfirm,
    adoptPlaylist,
    requestSyncConfirm,
    syncPlaylist,
  } from "../services/playlist-actions";

  let signedIn = $state(false);
  let loading = $state(true);
  const status = new StatusManager();
  let accountPlaylists: YtPlaylistInfoExtended[] = $state([]);
  let localPlaylists: Playlist[] = $state([]);
  let likedPlaylist: (YtPlaylistInfoExtended & { category: string }) | null = $state(null);
  let uploadedPlaylist: (YtPlaylistInfoExtended & { category: string }) | null = $state(null);
  let adoptingId = $state("");
  let syncingId = $state("");
  let settings: Settings | null = $state(null);
  let activeChip = $state("All");
  let activeSort = $state("Recently added");

  window
    .getSettings()
    .then((s) => (settings = s))
    .catch(async (e) => {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[SAVED-VIEW] Failed to load settings:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[SAVED-VIEW] Failed to load settings: ${errMsg}`);
    });

  const callbacks = {
    onSignedInChange: (v: boolean) => (signedIn = v),
    onLocalPlaylistsChange: (v: Playlist[]) => (localPlaylists = v),
    onAccountPlaylistsChange: (v: YtPlaylistInfoExtended[]) => (accountPlaylists = v),
    onLikedPlaylistChange: (v: (YtPlaylistInfoExtended & { category: string }) | null) =>
      (likedPlaylist = v),
    onUploadedPlaylistChange: (v: (YtPlaylistInfoExtended & { category: string }) | null) =>
      (uploadedPlaylist = v),
    onLoadingChange: (v: boolean) => (loading = v),
    onError: (msg: string) => window.error(msg),
    getSignedIn: () => signedIn,
  };

  const removeStorageListener = createStorageListener(callbacks);
  onDestroy(removeStorageListener);

  let allPlaylists = $derived.by(() => {
    const seen = new Set<string>();
    const result: Array<{
      id: string;
      title: string;
      thumbnailUrl: string | undefined;
      videoCount: number;
      isTagged: boolean;
      isLocal: boolean;
      category: string;
      timestamp?: number;
    }> = [];

    const addUnique = (p: (typeof result)[0]) => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    };

    localPlaylists.forEach((p) => {
      addUnique({
        id: p.id,
        title: p.title,
        timestamp: p.timestamp,
        videoCount: p.videos.length,
        isTagged: false,
        isLocal: true,
        thumbnailUrl: window.videoService.getVideoThumbnailUrl(p.videos[0]) || undefined,
        category: "local",
      });
    });

    if (signedIn) {
      accountPlaylists.forEach((p) => {
        if (p.id.startsWith("local-")) return;
        addUnique({
          id: p.id,
          title: p.title,
          thumbnailUrl: p.thumbnailUrl || undefined,
          videoCount: p.videoCount,
          isTagged: p.isTagged || false,
          isLocal: false,
          category: p.category || "youtube",
        });
      });

      if (likedPlaylist && !seen.has(likedPlaylist.id)) {
        addUnique({
          id: likedPlaylist.id,
          title: likedPlaylist.title,
          thumbnailUrl: likedPlaylist.thumbnailUrl || undefined,
          videoCount: likedPlaylist.videoCount,
          isTagged: likedPlaylist.isTagged || false,
          isLocal: false,
          category: "liked",
        });
      }
      if (uploadedPlaylist && !seen.has(uploadedPlaylist.id)) {
        addUnique({
          id: uploadedPlaylist.id,
          title: uploadedPlaylist.title,
          thumbnailUrl: uploadedPlaylist.thumbnailUrl || undefined,
          videoCount: uploadedPlaylist.videoCount,
          isTagged: uploadedPlaylist.isTagged || false,
          isLocal: false,
          category: "uploaded",
        });
      }
    }

    return result;
  });

  let displayedPlaylists = $derived.by(() => {
    const chip = activeChip;
    const searchQuery = $playlistsSearch;
    const sortMethod = activeSort;
    const playlists = allPlaylists;

    let result = playlists.filter((p) => {
      if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (chip === "Local") return p.isLocal === true;
      if (chip === "YouTube") return p.isLocal === false;
      return true;
    });

    if (sortMethod === "A-Z") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result = [...result].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    return result;
  });

  let playlistCount = $derived.by(() => {
    if (activeChip === "Local") {
      return allPlaylists.filter((p) => p.isLocal === true).length;
    } else if (activeChip === "YouTube") {
      return allPlaylists.filter((p) => p.isLocal === false).length;
    } else {
      return allPlaylists.length;
    }
  });

  initLoader(callbacks);

  function openInEditor(p: { id: string }) {
    const base = location.href.split("#")[0].split("?")[0];
    location.href = `${base}?id=${encodeURIComponent(p.id)}#/editor`;
  }

  function getCardActions(p: {
    id: string;
    isTagged: boolean;
    isLocal: boolean;
    category?: string;
  }) {
    return createCardActions({
      ...p,
      signedIn,
      adoptingId,
      syncingId,
      openInEditor,
      requestAdopt: (pp) => {
        requestAdoptConfirm(pp, () => {
          adoptingId = pp.id;
          adoptPlaylist(pp).finally(() => (adoptingId = ""));
        });
      },
      requestSync: (pp) => {
        requestSyncConfirm(pp, localPlaylists, async (resumeState) => {
          syncingId = pp.id;
          await syncPlaylist(pp, resumeState, localPlaylists);
          syncingId = "";
        });
      },
    });
  }

  async function refresh() {
    await status.refresh(async () => {
      if (signedIn) {
        await ytPlaylistsLoader(callbacks);
      } else {
        await loadLocal(callbacks);
      }
    });
  }
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<main class="view-scroll-container">
  <div class="view-body">
    <StickyHeader>
      {#snippet children()}
        <ViewHeader icon={faListUl} title="Playlists" count={playlistCount}>
          {#snippet rightActions()}
            <SimpleButton
              onclick={() => (location.hash = "#/manage")}
              title="Manage playlists"
              secondary
            >
              <Fa icon={faWrench} fw />
              <span>Manage</span>
            </SimpleButton>
            <SaveStatus onclick={refresh} {status} title="Refresh" />
          {/snippet}
        </ViewHeader>
      {/snippet}
      {#snippet subBar()}
        <FilterBar
          {activeChip}
          onChipChange={(c) => (activeChip = c)}
          {activeSort}
          onSortChange={(s) => (activeSort = s)}
        />
      {/snippet}
    </StickyHeader>

    <PlaylistGrid
      loading={loading && allPlaylists.length === 0}
      empty={displayedPlaylists.length === 0}
      emptyTitle="No Playlists"
      emptyMessage="No playlists found."
    >
      {#each displayedPlaylists as p (p.id)}
        <PlaylistCard
          id={p.id}
          title={p.title || "Untitled Playlist"}
          thumbnailUrl={p.thumbnailUrl || undefined}
          videoCount={p.videoCount}
          isTagged={p.isTagged}
          isLocal={p.isLocal}
          status={syncingId === p.id
            ? "syncing"
            : p.isLocal
              ? "local"
              : p.isTagged
                ? "synced"
                : "online"}
          showFavoriteBadge={!!(settings && p.id === settings.watchLaterPlaylistId)}
          onOpen={() => openInEditor(p)}
          actions={getCardActions(p)}
          category={p.category}
        />
      {/each}
    </PlaylistGrid>

    {#if !signedIn && allPlaylists.length > 0}
      <OfflineNotice />
    {/if}
  </div>
</main>

<style>
  @import "../css/view-layout.css";
</style>
