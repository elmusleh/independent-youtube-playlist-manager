<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faArrowUpRightFromSquare,
    faListUl,
    faWrench,
    faChevronDown,
    faCloud,
    faCloudArrowUp,
    faFile,
    faHeart,
    faUpload,
  } from "@fortawesome/free-solid-svg-icons";
  import { faYoutube } from "@fortawesome/free-brands-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import PlaylistCard from "../components/PlaylistCard.svelte";
  import PlaylistGrid from "../components/PlaylistGrid.svelte";
  import { requestConfirm } from "../stores/confirmation";
  import { playlistsSearch } from "../stores/playlists-filters";
  import { onDestroy } from "svelte";
  import { push } from "svelte-spa-router";
  import type { Playlist, Settings } from "../types/model";

  const browser = (window as any).browser || (window as any).chrome;

  let signedIn = $state(false);
  let loading = $state(true);
  const status = new StatusManager();
  let accountPlaylists: YtPlaylistInfoExtended[] = $state([]);
  let localPlaylists: Playlist[] = $state([]);
  let likedPlaylist: (YtPlaylistInfoExtended & { category: string }) | null =
    $state(null);
  let uploadedPlaylist: (YtPlaylistInfoExtended & { category: string }) | null =
    $state(null);
  let adoptingId = $state("");
  let syncingId = $state("");
  let settings: Settings | null = $state(null);

  window
    .getSettings()
    .then((s) => (settings = s))
    .catch(async (e) => {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[SAVED-VIEW] Failed to load settings:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[SAVED-VIEW] Failed to load settings: ${errMsg}`,
        );
    });

  const filterChips = ["All", "Local", "YouTube"];
  let activeChip = $state("All");

  const sortOptions = ["Recently added", "A-Z"];
  let activeSort = $state("Recently added");
  let sortOpen = $state(false);

  function closeSortDropdown() {
    sortOpen = false;
  }

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

    // Helper to add unique playlists (local entries take precedence)
    const addUnique = (p: typeof result[0]) => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    };

    // Add local playlists first (they take precedence over duplicates)
    localPlaylists.forEach((p) => {
      addUnique({
        id: p.id,
        title: p.title,
        timestamp: p.timestamp,
        videoCount: p.videos.length,
        isTagged: false,
        isLocal: true,
        thumbnailUrl:
          window.videoService.getVideoThumbnailUrl(p.videos[0]) || undefined,
        category: "local",
      });
    });

    // Add account playlists if signed in (skip local playlists and duplicates)
    if (signedIn) {
      accountPlaylists.forEach((p) => {
        // Skip local playlists - they are already added above
        if (p.id.startsWith("local-")) return;
        addUnique({
          id: p.id,
          title: p.title,
          thumbnailUrl: p.thumbnailUrl || undefined,
          videoCount: p.videoCount,
          isTagged: p.isTagged || false,
          isLocal: false,  // Force false for YouTube playlists
          category: (p as any).category || "youtube",
        });
      });

      // Add Liked and Uploaded playlists if they exist (avoid duplicates)
      if (likedPlaylist && !seen.has((likedPlaylist as any).id)) {
        addUnique({
          id: (likedPlaylist as any).id,
          title: (likedPlaylist as any).title,
          thumbnailUrl: (likedPlaylist as any).thumbnailUrl || undefined,
          videoCount: (likedPlaylist as any).videoCount,
          isTagged: (likedPlaylist as any).isTagged || false,
          isLocal: false,  // YouTube playlists are never local
          category: "liked",
        });
      }
      if (uploadedPlaylist && !seen.has((uploadedPlaylist as any).id)) {
        addUnique({
          id: (uploadedPlaylist as any).id,
          title: (uploadedPlaylist as any).title,
          thumbnailUrl: (uploadedPlaylist as any).thumbnailUrl || undefined,
          videoCount: (uploadedPlaylist as any).videoCount,
          isTagged: (uploadedPlaylist as any).isTagged || false,
          isLocal: false,  // YouTube playlists are never local
          category: "uploaded",
        });
      }
    }

    return result;
  });

  let displayedPlaylists = $derived.by(() => {
    // Read all reactive dependencies at top level to ensure proper tracking
    const chip = activeChip;
    const searchQuery = $playlistsSearch;
    const sortMethod = activeSort;
    const playlists = allPlaylists;

    let result = playlists.filter((p) => {
      if (
        searchQuery &&
        !p.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (chip === "Local") return p.isLocal === true;
      if (chip === "YouTube") return p.isLocal === false;
      return true;
    });

    if (sortMethod === "A-Z") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result = [...result].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
      );
    }
    return result;
  });

  // Dynamic count based on active filter chip
  let playlistCount = $derived.by(() => {
    if (activeChip === "Local") {
      return allPlaylists.filter(p => p.isLocal === true).length;
    } else if (activeChip === "YouTube") {
      return allPlaylists.filter(p => p.isLocal === false).length;
    } else {
      return allPlaylists.length;
    }
  });

  async function checkAuth() {
    try {
      const status = await window.isSignedIn();
      if (status !== signedIn) {
        signedIn = status;
        if (signedIn) {
          ytPlaylistsLoader();
        }
      }
    } catch (e) {
      console.error("Auth check failed", e);
    }
  }

  async function loadLocal() {
    try {
      // Use getLocalPlaylists() to get ONLY local playlists, not merged with YouTube
      localPlaylists = await window.getLocalPlaylists();
    } catch (e) {
      console.error("Failed to load local playlists", e);
    }
  }

  async function init() {
    await loadLocal();
    await checkAuth();
    settings = await window.getSettings();
    if (signedIn) {
      await ytPlaylistsLoader();
    } else {
      loading = false;
    }
  }

  init();

  let _debounce: ReturnType<typeof setTimeout> | null = null;
  let _isLoadingPlaylists = false;

  function handleStorageChange(
    changes: Record<string, { oldValue?: any; newValue?: any }>,
    area: string,
  ) {
    if (area === "sync") {
      const featureKeys = [
        "enableLikedVideos",
        "enableUploadedVideos",
        "enableSubscriptions",
        "enableActivities",
        "enableSearch",
        "enableComments",
        "enableAccountPlaylists",
        "enableWatchLater",
      ];
      if (featureKeys.some((key) => key in changes)) {
        window.invalidatePlaylistCache();
        ytPlaylistsLoader();
      }
    }

    if (area !== "local") return;

    if ("yt_auth_token_cache" in changes) {
      const wasSignedIn = signedIn;
      signedIn = changes["yt_auth_token_cache"].newValue != null;
      if (signedIn && !wasSignedIn) ytPlaylistsLoader();
      else if (!signedIn && wasSignedIn) {
        accountPlaylists = [];
        loadLocal();
      }
      return;
    }

    if ("yt_playlist_cache_v1" in changes) {
      if (changes["yt_playlist_cache_v1"].newValue !== undefined) return;
      if (_debounce) clearTimeout(_debounce);
      _debounce = setTimeout(() => {
        _debounce = null;
        if (signedIn) ytPlaylistsLoader();
        else loadLocal();
      }, 2000);
    }
  }

  browser.storage.onChanged.addListener(handleStorageChange);
  onDestroy(() => {
    browser.storage.onChanged.removeListener(handleStorageChange);
    if (_debounce) clearTimeout(_debounce);
  });

  function requestAdopt(p: { id: string }) {
    requestConfirm({
      title: "Adopt Playlist?",
      message: "This will add this YouTube playlist to your local management.",
      color: "primary",
      onConfirm: () => adopt(p),
    });
  }

  async function adopt(p: { id: string }) {
    adoptingId = p.id;
    try {
      await window.adoptPlaylist(p.id);
    } catch (e) {
      console.error("Failed to adopt playlist", e);
      window.error("Failed to adopt playlist");
    } finally {
      adoptingId = "";
    }
  }

  async function requestSync(p: YtPlaylistInfoExtended) {
    const localP = localPlaylists.find((lp) => lp.id === p.id);
    if (!localP) return;

    // Check for existing sync state
    const existingSync = await window.getSyncState(p.id);
    
    if (existingSync?.remotePlaylistId) {
      // Check if remote playlist still exists
      try {
        const remoteExists = await window.ytGetPlaylist(existingSync.remotePlaylistId);
        if (remoteExists) {
          const synced = existingSync.syncedVideoIds.length;
          const total = existingSync.totalVideos;
          const remaining = existingSync.remainingVideoIds.length;
          const isAutoRetry = await window.isAutoRetryScheduled(p.id);
          
          // Show resume dialog
          requestConfirm({
            title: "Resume Existing Sync?",
            message: 
              `Found partially synced playlist "${localP.title}" with ${synced}/${total} videos (${remaining} remaining).\n\n` +
              `Auto-retry scheduled: ${isAutoRetry ? "Yes (24h)" : "No"}\n\n` +
              `Do you want to resume syncing, or start fresh with a new playlist?`,
            color: "primary",
            confirmLabel: "Resume Sync",
            cancelLabel: "Start Fresh",
            onConfirm: () => syncPlaylist(p, existingSync),
            onCancel: async () => {
              // Re-fetch current state to avoid stale closure
              const stillScheduled = await window.isAutoRetryScheduled(p.id);
              if (stillScheduled) {
                await window.cancelAutoRetry(p.id);
              }
              await window.clearSyncState(p.id);
              await syncPlaylist(p, null);
            },
          });
          return;
        }
      } catch (e) {
        // Remote playlist doesn't exist, clear stale state and proceed with new sync
        console.log("Remote playlist no longer exists, clearing stale sync state");
        await window.clearSyncState(p.id);
      }
    }
    
    // No existing sync state, show standard confirmation
    requestConfirm({
      title: "Sync to YouTube?",
      message:
        `This will create a new playlist on your YouTube account with ${localP.videos.length} videos.\n\n` +
        `Note: Large playlists may take multiple days to sync due to API quota limits (~200 videos/day).`,
      color: "primary",
      onConfirm: () => syncPlaylist(p, null),
    });
  }

  async function syncPlaylist(p: { id: string }, resumeState: import("../services/sync-state-service").SyncState | null) {
    const localP = localPlaylists.find((lp) => lp.id === p.id);
    if (!localP) return;

    syncingId = p.id;
    try {
      await window.savePlaylist(localP, { 
        syncToYoutube: true,
        resumeFromState: resumeState || undefined
      });
      
      // Check if sync is complete or partial
      const isComplete = await window.isSyncComplete(p.id);
      if (isComplete) {
        window.success("Playlist synced to YouTube successfully!");
      } else {
        // Partial sync - show progress info
        const syncState = await window.getSyncState(p.id);
        if (syncState) {
          const synced = syncState.syncedVideoIds.length;
          const total = syncState.totalVideos;
          const isAutoRetry = await window.isAutoRetryScheduled(p.id);
          
          window.info(
            `Partial sync: ${synced}/${total} videos uploaded. ` +
            `${isAutoRetry ? "Will auto-resume in 24h." : "Click Sync to continue."}`
          );
        }
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to sync playlist:", e);
      
      // Check for quota error to show enhanced message
      if (errorMsg.toLowerCase().includes("quota") || 
          errorMsg.toLowerCase().includes("ratelimitexceeded")) {
        // Get current progress for display
        const syncState = await window.getSyncState(p.id);
        if (syncState) {
          // Defensive checks for potentially undefined values
          const synced = syncState?.syncedVideoIds?.length ?? 0;
          const total = syncState?.totalVideos ?? localP?.videos?.length ?? 0;
          const remaining = syncState?.remainingVideoIds?.length ?? 0;
          const daysNeeded = total > 0 ? Math.ceil(remaining / 200) : 0; // ~200 videos/day max based on 10,000 quota units
          const isAutoRetry = await window.isAutoRetryScheduled(p.id);
          
          window.error(
            `API quota exceeded!\n\n` +
            `Progress: ${synced}/${total} videos synced\n` +
            `Remaining: ${remaining} videos\n` +
            `Estimated completion: ${daysNeeded} day${daysNeeded > 1 ? 's' : ''}\n\n` +
            `${isAutoRetry ? "✓ Auto-retry scheduled in 24h" : "Click Sync to resume tomorrow"}`
          );
        } else {
          window.error("API quota exceeded. Please try again tomorrow.");
        }
      } else {
        window.error("Failed to sync playlist: " + errorMsg);
      }
    } finally {
      syncingId = "";
    }
  }

  async function ytPlaylistsLoader() {
    if (_isLoadingPlaylists) return;
    _isLoadingPlaylists = true;

    const dismiss = window.info("Refreshing playlists...");
    loading = true;
    try {
      // Fetch account playlists (includes local + YouTube via getAccountPlaylists)
      const allPlaylistsResult = await window.getAccountPlaylists();

      // Extract YouTube account playlists (non-local, non-virtual)
      const youtubeTaggedPlaylists = allPlaylistsResult.filter(
        (p) => !p.isLocal && !p.id.startsWith("local-") && p.id !== "LIKED" && p.id !== "UPLOADS" && p.id !== "WL",
      );

      // Get all account playlists (the non-tagged ones)
      const allAccountPlaylists = youtubeTaggedPlaylists;

      // Fetch Liked and Uploaded playlists separately for special handling
      try {
        const likedInfo = await window.ytGetPlaylist("LIKED");
        if (likedInfo) {
          const likedItems = await window.ytGetPlaylistItems("LIKED");
          likedPlaylist = {
            ...likedInfo,
            videoCount: likedItems.length,
            isTagged: false,
            isLocal: false,
            category: "liked",
          } as YtPlaylistInfoExtended & { category: string };
        }
      } catch (e) {
        console.error("Failed to load Liked Videos:", e);
      }

      try {
        const uploadedInfo = await window.ytGetPlaylist("UPLOADS");
        console.log("[SAVED-VIEW] Uploaded info:", uploadedInfo);
        if (uploadedInfo) {
          const uploadedItems = await window.ytGetPlaylistItems("UPLOADS");
          console.log(
            "[SAVED-VIEW] Uploaded items count:",
            uploadedItems.length,
          );
          uploadedPlaylist = {
            ...uploadedInfo,
            videoCount: uploadedItems.length,
            isTagged: false,
            isLocal: false,
            category: "uploaded",
          } as YtPlaylistInfoExtended & { category: string };
          console.log("[SAVED-VIEW] Uploaded playlist set:", uploadedPlaylist);
        }
      } catch (e) {
        console.error("Failed to load Uploaded Videos:", e);
      }

      // Merge tagged playlists with all account playlists, deduplicating by ID
      const taggedIds = new Set(youtubeTaggedPlaylists.map((p) => p.id));
      accountPlaylists = [
        ...youtubeTaggedPlaylists.map((p) => ({ ...p, category: "youtube" })),
        ...allAccountPlaylists
          .filter((p) => !taggedIds.has(p.id))
          .map((p) => ({ ...p, category: "account", isLocal: false })),
      ] as (YtPlaylistInfoExtended & { category: string })[];
    } catch (e) {
      console.error("Failed to load playlists:", e);
      if (signedIn) {
        window.error("Failed to sync with YouTube - showing cached playlists");
      }
    } finally {
      loading = false;
      _isLoadingPlaylists = false;
      if (dismiss) dismiss();
    }
  }

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
    const actions: Array<{
      label: string;
      icon?: any;
      onClick: () => void;
      disabled?: boolean;
      loading?: boolean;
    }> = [
      {
        label: "Open",
        icon: faArrowUpRightFromSquare,
        onClick: () => openInEditor(p),
      },
    ];

    // Add "Open in YouTube" button for Liked and Uploaded playlists
    if (p.category === "liked" || p.category === "uploaded") {
      actions.push({
        label: "Open in YouTube",
        icon: faYoutube,
        onClick: () => {
          const listId = p.id === "UPLOADS" ? "UU" : p.id;
          window.open(
            `https://www.youtube.com/playlist?list=${listId}`,
            "_blank",
          );
        },
      });
    }

    // Add Adopt button for untagged account playlists (not Liked/Uploaded)
    if (
      !p.isTagged &&
      !p.isLocal &&
      signedIn &&
      !["LIKED", "UPLOADS"].includes(p.id) &&
      !(p.category === "liked" || p.category === "uploaded")
    ) {
      actions.push({
        label: adoptingId === p.id ? "Adopting…" : "Adopt",
        onClick: () => requestAdopt(p),
        disabled: adoptingId === p.id,
      });
    }

    if (p.isLocal && signedIn) {
      actions.push({
        label: syncingId === p.id ? "Syncing…" : "Sync",
        icon: faCloudArrowUp,
        onClick: () => requestSync(p as any),
        disabled: syncingId === p.id,
      });
    }

    return actions;
  }

  async function refresh() {
    await status.refresh(async () => {
      if (signedIn) {
        await ytPlaylistsLoader();
      } else {
        await loadLocal();
      }
    });
  }

  async function triggerSignIn() {
    try {
      await window.signIn();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const code = (e as any)?.code;
      if (code === "credentials_missing") {
        if (window.info) window.info("Please fill in your API credentials first.");
        push("/api-setup");
      } else {
        console.error("Sign in failed", e);
        if (window.logSystemEvent) await window.logSystemEvent("ERROR", `[SAVED] Sign-in failed: ${errMsg}`);
        if (window.error) window.error("Sign-in failed. Please try again.");
      }
    }
  }
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<svelte:window onclick={closeSortDropdown} />

<main>
  <div class="view-header">
    <div class="top-left">
      <ViewHeader
        icon={faListUl}
        title="Playlists"
        count={playlistCount}
      />
    </div>
    <div class="btn-group right-align">
      <SimpleButton
        onclick={() => (location.hash = "#/manage")}
        title="Manage playlists"
        secondary
      >
        <Fa icon={faWrench} fw />
        <span>Manage</span>
      </SimpleButton>
      <SaveStatus onclick={refresh} {status} title="Refresh" />
    </div>
  </div>

  <div class="view-body">
    <div class="chip-bar">
      <div class="sort-wrapper">
        <button
          class="chip"
          class:sort-open={sortOpen}
          onclick={(e) => {
            e.stopPropagation();
            sortOpen = !sortOpen;
          }}
        >
          {activeSort}
          <Fa icon={faChevronDown} fw />
        </button>
        {#if sortOpen}
          <div class="sort-dropdown">
            {#each sortOptions as option}
              <button
                class:selected={activeSort === option}
                class="sort-option"
                onclick={(e) => {
                  e.stopPropagation();
                  activeSort = option;
                  sortOpen = false;
                }}
              >
                {option}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#each filterChips as chip}
        <button
          class:active={activeChip === chip}
          class="chip"
          onclick={() => (activeChip = chip)}
        >
          {chip}
        </button>
      {/each}
    </div>

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
          showFavoriteBadge={!!(
            settings && p.id === settings.watchLaterPlaylistId
          )}
          onOpen={() => openInEditor(p)}
          actions={getCardActions(p)}
          category={p.category}
        />
      {/each}
    </PlaylistGrid>

    {#if !signedIn && allPlaylists.length > 0}
      <div class="offline-notice">
        <div class="notice-content">
          <Fa icon={faCloud} fw />
          <p>
            Showing locally saved playlists.
            <button class="signin-link" onclick={triggerSignIn}>Sign in</button>
            to sync with your YouTube account.
          </p>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .chip-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    position: sticky;
    top: 56px;
    z-index: 99;
    background: var(--background-color);
    margin: 0 -24px;
    padding: 12px 24px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.07);
    color: var(--text-color);
    transition:
      background 0.15s,
      color 0.15s;
  }

  :global([data-theme="dark"]) .chip {
    background: rgba(255, 255, 255, 0.1);
  }

  .chip.active {
    background: var(--text-color);
    color: var(--background-color);
  }

  .sort-wrapper {
    position: relative;
  }

  .sort-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 2000;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    min-width: 170px;
    overflow: hidden;
  }

  .sort-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: none;
    color: var(--text-color);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
  }

  .sort-option:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  .sort-option.selected {
    font-weight: 700;
    color: #3ea6ff;
  }

  .offline-notice {
    margin-top: 3rem;
    padding: 16px;
    background: rgba(54, 166, 255, 0.08);
    border: 1px dashed #3ea6ff;
    border-radius: 12px;
  }

  .notice-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .signin-link {
    background: none;
    border: none;
    color: #3ea6ff;
    padding: 0;
    font-size: inherit;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .view-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
    }

    .btn-group.right-align {
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .chip-bar {
      top: 52px;
      margin: 0 -16px;
      padding: 12px 16px;
    }

    .chip {
      font-size: 13px;
      padding: 5px 12px;
    }

    .offline-notice {
      margin-top: 2rem;
      padding: 12px;
    }

    .notice-content {
      flex-direction: column;
      text-align: center;
      gap: 8px;
    }
  }
</style>
