<script lang="ts">
  import { onDestroy } from "svelte";
  import { flip } from "svelte/animate";
  import { expoOut } from "svelte/easing";
  import ViewHeader from "../components/ViewHeader.svelte";
  import StickyHeader from "./StickyHeader.svelte";
  import SyncStatusIndicator from "./SyncStatusIndicator.svelte";
  import LoadingModal from "./LoadingModal.svelte";
  import PlaylistVideo from "./PlaylistVideo.svelte";
  import SaveStatus from "./SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import { paginate } from "svelte-paginate";
  import Fa from "svelte-fa";
  import {
    faPenToSquare,
    faPencil,
    faXmark,
    faUndo,
    faCloudArrowUp,
    faLink,
    faLock,
    faLockOpen,
    faCheck,
    faPlay,
    faPlus,
    faTrash,
    faBroom,
    faChevronDown,
  } from "@fortawesome/free-solid-svg-icons";
  import { faYoutube } from "@fortawesome/free-brands-svg-icons";
  import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
  import type { Playlist, SortField, SortRule, Video } from "../types/model.js";
  import PaginationNav from "./PaginationNav.svelte";
  import AuthPlaceholder from "./AuthPlaceholder.svelte";
  import { requestConfirm } from "../stores/confirmation.js";
  import { editorSearch } from "../stores/playlists-filters";

  // Sub-components
  import EditorToolbar from "./editor/EditorToolbar.svelte";
  import BulkActionsBar from "./editor/BulkActionsBar.svelte";
  import PlaylistModals from "./editor/PlaylistModals.svelte";
  import MultiSortModal from "./editor/MultiSortModal.svelte";
  import RangeSelectModal from "./RangeSelectModal.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";

  // Utils
  import * as utils from "../utils/playlist-utils";
  import { dbGetMetadataBatch, dbPutMetadataBatch } from "../services/db-service.js";
  import { enrichVideoMetadata } from "../services/enrichment-service.js";
  import { PAGE_SIZES } from "../services/settings-utils.js";

  const browser = (window as any).browser || (window as any).chrome;

  let {
    playlist = $bindable(undefined),
    isLoading = $bindable(false),
    error = "",
    authRequired = false,
    signedIn = false,
    pageTitle = "Edit Playlist",
    pageIcon = faPenToSquare,
    isNew = false,
    isPlaylistBuilder = false,
    isFavoritePage = false,
    status = $bindable(new StatusManager()),
    editingTitle = $bindable(false),
  }: {
    playlist?: Playlist;
    isLoading?: boolean;
    error?: string;
    authRequired?: boolean;
    signedIn?: boolean;
    pageTitle?: string;
    pageIcon?: IconDefinition;
    isNew?: boolean;
    isPlaylistBuilder?: boolean;
    /** When true, the star in the header is a read-only indicator (Favorite Playlist page) */
    isFavoritePage?: boolean;
    status?: StatusManager;
    editingTitle?: boolean;
  } = $props();

  function handleNavigate(path: string) {
    location.hash = path;
  }

  let dataLoaded = $state(false);
  let videos = $state([] as Video[]);
  let adopting = $state(false);
  let autoSaveEditor = $state(false);
  let autoSaveInterval = $state(2);
  let autoFetchMetadata = $state(false);
  let initialHash = $state("");
  let forceUpdate = $state(0);
  let isDirty = $state(false);
  let isDiscarding = $state(false);
  let _isLoadingPage = false;
  let _isLoadingMetadata = false;
  let activeSortRules = $state<SortRule[]>([]);
  let showMultiSort = $state(false);

  function calculateStateHash(): string {
    const videoIds = videos.map((v) => v.videoId).join(",");
    const title = playlist?.title || "";
    return `${title}:${videoIds}`;
  }

  function updateDirtyState() {
    if (isDiscarding) {
      console.log("updateDirtyState: skipping during discard");
      return;
    }
    const currentHash = calculateStateHash();
    console.log("updateDirtyState: currentHash =", currentHash, "initialHash =", initialHash);
    if (currentHash !== initialHash) {
      isDirty = true;
      status.markDirty();
      console.log("updateDirtyState: set isDirty = true");
    } else {
      isDirty = false;
      status.isDirty = false;
      console.log("updateDirtyState: set isDirty = false");
    }
  }

  // Load editor settings
  window
    .getSettings()
    .then((s) => {
      autoSaveEditor = s.autoSaveEditor ?? false;
      autoSaveInterval = s.autoSaveInterval ?? 2;
      autoFetchMetadata = s.autoFetchMetadata ?? false;
    })
    .catch(() => {});

  const handleSettingsChange = () => {
    window
      .getSettings()
      .then((s) => {
        autoSaveEditor = s.autoSaveEditor ?? false;
        autoSaveInterval = s.autoSaveInterval ?? 2;
        autoFetchMetadata = s.autoFetchMetadata ?? false;
      })
      .catch(() => {});
  };
  window.addEventListener("settings-changed", handleSettingsChange);
  onDestroy(() => window.removeEventListener("settings-changed", handleSettingsChange));

  // Auto-save logic
  let saveTimeout: any;
  $effect(() => {
    if (isDirty && status.lastChange > 0 && dataLoaded && autoSaveEditor) {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => savePlaylist({ silent: true }), autoSaveInterval * 1000);
    }
  });

  // Reactive properties
  let isLocal = $derived(!playlist?.id || playlist.id.startsWith("local-"));
  let isUnmanagedYT = $derived(!isLocal && playlist?.id !== "WL" && !playlist?.isTagged);

  // Pagination
  let currentPage = $state(1);
  let pageSize = $state(100);

  window
    .getSettings()
    .then((s) => {
      pageSize = s.defaultPageSize || 100;
    })
    .catch(() => {});

  async function loadPageVideos(page: number) {
    if (_isLoadingPage) return;
    _isLoadingPage = true;

    try {
      let indicesToLoad = [];
      const start = (page - 1) * pageSize;
      const end = Math.min(page * pageSize, videos.length);

      for (let i = start; i < end; i++) {
        if (videos[i].title === "") indicesToLoad.push(i);
      }

      if (indicesToLoad.length > 0) {
        if (autoFetchMetadata) {
          // Silent background fetch for missing metadata on this page
          const pageVideos = indicesToLoad.map((i) => videos[i]);
          ensureMetadataLoaded(pageVideos, true);
        } else {
          window.info(
            `${indicesToLoad.length} video(s) on this page are missing metadata. Enable "Auto-fetch metadata" in Settings or use Clean → Refetch Metadata.`
          );
        }
      }
    } finally {
      _isLoadingPage = false;
    }
  }

  let loadedPlaylistKey = $state<string>("");

  $effect(() => {
    const currentKey = playlist
      ? `${playlist.id || "new"}:${(playlist.videos || []).join(",")}`
      : "";
    if (playlist && playlist.videos && (!dataLoaded || currentKey !== loadedPlaylistKey)) {
      loadedPlaylistKey = currentKey;
      initializeVideos();
    }
  });

  async function initializeVideos() {
    if (!playlist || !playlist.videos) {
      dataLoaded = true;
      return;
    }
    loadFavoriteStatus();

    const metaBatch = await dbGetMetadataBatch(playlist.videos);
    videos = playlist.videos.map((id) => {
      const cached = metaBatch[id];
      if (
        cached &&
        (cached.title || cached.channel || cached.durationISO || cached.durationSeconds)
      ) {
        return {
          id: window.videoIdCount++,
          videoId: id,
          url: (window.videoService?.YOUTUBE_URL_PREFIX || "https://www.youtube.com/watch?v=") + id,
          title: cached.title,
          channel: cached.channel,
          duration: cached.durationISO,
          durationISO: cached.durationISO,
          durationSeconds: cached.durationSeconds || window.isoToSecs(cached.durationISO),
          viewCount: cached.viewCount,
          publishedAt: cached.publishedAt,
          isPrivate: cached.isPrivate,
          isDeleted: cached.isDeleted,
          isBroken: cached.isBroken,
          isLive: cached.isLive,
          thumbnailUrl:
            window.videoService?.getVideoThumbnailUrl(id) ||
            `https://i.ytimg.com/vi/${id}/default.jpg`,
        };
      }
      return {
        id: window.videoIdCount++,
        videoId: id,
        url: (window.videoService?.YOUTUBE_URL_PREFIX || "https://www.youtube.com/watch?v=") + id,
        title: "",
        channel: "",
        thumbnailUrl:
          window.videoService?.getVideoThumbnailUrl(id) ||
          `https://i.ytimg.com/vi/${id}/default.jpg`,
      };
    });

    if (window.logSystemEvent) {
      const foundCount = videos.filter((v) => v.title).length;
      await window.logSystemEvent("INFO", `[EDITOR] Cache Load Complete`, {
        total: videos.length,
        foundInCache: foundCount,
        missing: videos.length - foundCount,
      });
    }

    dataLoaded = true;
    initialHash = calculateStateHash();

    // Restore the active sort indicator from the playlist's persisted sort
    // rules. We intentionally do NOT re-sort the array here — if the sort was
    // already applied, the video order in storage reflects it already.
    activeSortRules = playlist?.sortRules?.length ? playlist.sortRules.map((r) => ({ ...r })) : [];

    // Silent background enrichment: videos missing essential metadata (title,
    // channel, or duration) are fetched in the background without blocking the
    // UI. Videos with fresh/valid cached data (or a recent failed attempt) are
    // skipped via shouldSkipFetch to avoid pointless refetch loops.
    if (autoFetchMetadata) {
      const missing = videos.filter(isVideoMissingMetadata);
      const toEnrich: Video[] = [];
      for (const v of missing) {
        if (window.videoService) {
          const skip = await window.videoService.shouldSkipFetch(v.videoId);
          if (skip) continue;
        }
        toEnrich.push(v);
      }
      if (toEnrich.length > 0) {
        const enrichIds = new Set(toEnrich.map((v) => v.videoId));
        videos = videos.map((v) => (enrichIds.has(v.videoId) ? { ...v, isEnriching: true } : v));
        ensureMetadataLoaded(toEnrich, true).catch(() => {});
      }
    }
  }

  // Filtering & Pagination Derived
  let filteredVideos = $derived(
    videos.filter((v) => {
      if (!$editorSearch) return true;
      const q = $editorSearch.toLowerCase();
      return (
        (v.title || "").toLowerCase().includes(q) || (v.channel || "").toLowerCase().includes(q)
      );
    })
  );

  let paginatedVideos = $derived(
    paginate({ items: filteredVideos, pageSize, currentPage }) as Video[]
  );

  function updatePaginationPage(e: any) {
    currentPage = e.detail.page;
    loadPageVideos(currentPage);
  }

  // Inline page-size control (persists globally as the `defaultPageSize` setting)
  function applyPageSize(nextSize: number) {
    const size = Math.min(500, Math.max(10, nextSize));
    if (size === pageSize) return;
    // Anchor to the current first-visible video so the user keeps their place.
    const total = filteredVideos.length;
    const firstVisible = Math.min((currentPage - 1) * pageSize, Math.max(total - 1, 0));
    const totalPages = Math.max(1, Math.ceil(total / size));
    currentPage = Math.min(totalPages, Math.floor(firstVisible / size) + 1);
    pageSize = size;
    loadPageVideos(currentPage);
  }

  function onPageSizeChange(e: Event) {
    const size = Number((e.target as HTMLSelectElement).value);
    if (!Number.isFinite(size)) return;
    applyPageSize(size);
    // Persist globally so all playlists (and the Settings page) inherit this value.
    window.storeObject("defaultPageSize", size).catch(() => {});
  }

  // Keep the editor's page size in sync when defaultPageSize changes elsewhere
  // (e.g. the Settings page or another editor instance).
  function handlePageSizeStorageChange(changes: Record<string, { newValue?: any }>, area: string) {
    if (area !== "sync" && area !== "local") return;
    if (!changes.defaultPageSize) return;
    const size = Number(changes.defaultPageSize.newValue);
    if (!Number.isFinite(size)) return;
    applyPageSize(size);
  }
  browser.storage.onChanged.addListener(handlePageSizeStorageChange);
  onDestroy(() => browser.storage.onChanged.removeListener(handlePageSizeStorageChange));

  // Intercept Navigation
  function handleBeforeUnload(e: any) {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  }
  window.addEventListener("beforeunload", handleBeforeUnload);

  function handleNavClick(e: MouseEvent) {
    if (!isDirty) return;
    const anchor = (e.target as HTMLElement).closest("a[href^='#']");
    if (!anchor) return;
    const targetHash = (anchor as HTMLAnchorElement).getAttribute("href");
    if (!targetHash || targetHash === location.hash) return;
    e.preventDefault();
    requestConfirm({
      title: "Unsaved changes",
      message: "You have unsaved changes. Do you want to leave?",
      color: "default",
      onConfirm: () => {
        location.hash = targetHash;
      },
    });
  }
  document.addEventListener("click", handleNavClick, true);

  onDestroy(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    document.removeEventListener("click", handleNavClick, true);
  });

  // Keyboard Shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (isDirty) savePlaylist();
      else window.info("No changes to save");
    }
  }
  window.addEventListener("keydown", handleKeyDown);
  onDestroy(() => window.removeEventListener("keydown", handleKeyDown));

  // Selection Logic
  let isSelectMode = $state(false);
  let selectedVideoIds = $state(new Set<string | number>());
  function toggleSelect(video: Video) {
    const next = new Set(selectedVideoIds);
    if (next.has(video.id)) next.delete(video.id);
    else next.add(video.id);
    selectedVideoIds = next;
  }
  function toggleSelectAll() {
    if (selectedVideoIds.size === videos.length) selectedVideoIds = new Set();
    else selectedVideoIds = new Set(videos.map((v) => v.id));
  }

  // Count-based range selection (via BulkActionsBar dropdown)
  let rangeSelectModalOpen = $state(false);
  let rangeSelectDirection = $state<"above" | "below">("above");

  // Modal State
  let displayModal = $state(false);
  let modalType = $state<string | null>(null);
  let importText = $state("");
  let exportText = $state("");
  let htmlText = $state("");
  let importAtTop = $state(false);

  // Copy/Move Logic
  let copyMoveAction = $state<"copy" | "move">("copy");
  let copyMoveCreateNew = $state(false);
  let copyMoveTargetPlaylistId = $state<string | null>(null);
  let copyMoveNewPlaylistTitle = $state("");
  let copyMovePosition = $state<"top" | "bottom">("bottom");
  let copyMoveTargetPlaylists = $state<Playlist[]>([]);
  let copyMoveLoading = $state(false);

  // Progress Modal State
  let showProgressModal = $state(false);
  let progressTitle = $state("");
  let progressText = $state("");
  let progressPercent = $state(0);
  let progressCurrent = $state(0);
  let progressTotal = $state(0);
  let progressCancelRequested = $state(false);

  // Favorite state
  let isFavoritePlaylist = $state(false);

  async function loadFavoriteStatus() {
    if (!playlist || !playlist.id || playlist.id === "new") return;
    const settings = await window.getSettings();
    isFavoritePlaylist = settings.watchLaterPlaylistId === playlist.id;
  }

  async function toggleFavorite() {
    if (!playlist) return;
    // Guard: cannot set an unsaved/new playlist as favorite — it has no real ID yet.
    // A valid ID is either a "local-..." string (offline) or a YouTube ID (>10 chars, no "new").
    const isValidId =
      playlist.id &&
      playlist.id !== "new" &&
      (playlist.id.startsWith("local-") || playlist.id.length > 10);
    if (!isValidId) {
      window.info("Please save this playlist first before marking it as a favorite.");
      return;
    }
    if (isFavoritePlaylist) {
      window.info("This is already your favorite playlist. Change it from Settings.");
      return;
    }
    await window.storeObject("watchLaterPlaylistId", playlist.id);
    isFavoritePlaylist = true;
    window.success("Set playlist as favorite ⭐️");
    window.invalidateCacheAndNotify();
  }

  // Keep isFavoritePlaylist in sync if watchLaterPlaylistId is changed from another page (e.g. Settings)
  function handleFavoriteStorageChange(changes: Record<string, { newValue?: any }>, area: string) {
    if (area !== "sync" && area !== "local") return;
    if ("watchLaterPlaylistId" in changes) {
      if (!playlist?.id) return;
      isFavoritePlaylist = changes["watchLaterPlaylistId"].newValue === playlist.id;
    }
  }
  browser.storage.onChanged.addListener(handleFavoriteStorageChange);
  onDestroy(() => browser.storage.onChanged.removeListener(handleFavoriteStorageChange));

  async function openCopyMove() {
    copyMoveLoading = true;
    try {
      const all = await window.getPlaylists();
      copyMoveTargetPlaylists = all.filter((p) => p.id !== playlist?.id && p.id !== "WL");
      modalType = "CopyMove";
      displayModal = true;
    } finally {
      copyMoveLoading = false;
    }
  }

  async function executeCopyMove() {
    if (selectedVideoIds.size === 0) return;
    copyMoveLoading = true;
    try {
      const selectedApiIds = videos.filter((v) => selectedVideoIds.has(v.id)).map((v) => v.videoId);
      let target: Playlist;
      if (copyMoveCreateNew) {
        target = window.videoService
          ? await window.videoService.generatePlaylist(
              selectedApiIds,
              copyMoveNewPlaylistTitle.trim()
            )
          : {
              id: "local-" + Date.now(),
              title: copyMoveNewPlaylistTitle.trim() || "New Playlist",
              videos: selectedApiIds,
              timestamp: Date.now(),
            };
      } else {
        target = await window.getPlaylist(copyMoveTargetPlaylistId as string);
        const existing = new Set(target.videos.map((v: any) => v.videoId || v));
        const newV = selectedApiIds.filter((id) => !existing.has(id));
        if (newV.length === 0) {
          window.info("Videos already exist in target.");
          return;
        }
        const currentV = target.videos.map((v: any) => v.videoId || v);
        target.videos =
          copyMovePosition === "top" ? [...newV, ...currentV] : [...currentV, ...newV];
      }

      await window.savePlaylist(target, { syncToYoutube: false });
      if (copyMoveAction === "move") {
        videos = videos.filter((v) => !selectedVideoIds.has(v.id));
        updateDirtyState();
        selectedVideoIds = new Set();
        isSelectMode = false;
      }
      window.success(`${copyMoveAction === "copy" ? "Copied" : "Moved"} to ${target.title}`);
      displayModal = false;
    } catch (e) {
      window.error("Operation failed");
    } finally {
      copyMoveLoading = false;
    }
  }

  // Core Actions
  async function savePlaylist(options: { forceSync?: boolean; silent?: boolean } = {}) {
    if (status.saving) return;
    const videoIds = videos.map((v) => v.videoId.toString());
    const data = { ...playlist, videos: videoIds } as Playlist;
    const sync = options.forceSync || !isLocal;

    if (videoIds.length === 0 && playlist && playlist.id !== "new") {
      const settings = await window.getSettings();
      if (settings.autoDeleteEmptyPlaylists) {
        if (!options.silent) {
          window.info("Playlist is empty. Auto-removing playlist...");
        }
        await window.removePlaylist(playlist);
        window.location.hash = "#/saved";
        return;
      }
    }

    if (options.forceSync) {
      requestConfirm({
        title: "Sync to YouTube?",
        message: "This will create a new linked playlist on YouTube.",
        color: "primary",
        onConfirm: () => performSave(data, true, options.silent),
      });
    } else {
      await performSave(data, sync, options.silent);
    }
  }

  async function performSave(data: Playlist, sync: boolean, silent = false) {
    await status.save(
      async () => {
        // Guarantee all video metadata in memory is atomically written to IndexedDB
        const metaBatch: Record<string, any> = {};
        for (const v of videos) {
          if (v && v.videoId && (v.title || v.channel || v.durationISO || v.durationSeconds)) {
            metaBatch[v.videoId] = {
              videoId: v.videoId,
              title: v.title,
              channel: v.channel,
              durationISO: v.durationISO || v.duration,
              durationSeconds: v.durationSeconds,
              viewCount: v.viewCount,
              publishedAt: v.publishedAt,
              isPrivate: v.isPrivate,
              isDeleted: v.isDeleted,
              isBroken: v.isBroken,
              isLive: v.isLive,
            };
          }
        }
        if (Object.keys(metaBatch).length > 0) {
          await dbPutMetadataBatch(metaBatch);
        }

        const id = await window.savePlaylist(data, { syncToYoutube: sync });
        const wasLocal = data.isLocal;
        playlist = {
          ...data,
          id,
          ...(wasLocal && sync ? { isLocal: false, isTagged: true, saved: true } : {}),
        };
        loadedPlaylistKey = `${playlist.id}:${(playlist.videos || []).join(",")}`;
        if (isPlaylistBuilder) await browser.runtime.sendMessage({ cmd: "clear-playlist-builder" });
        initialHash = calculateStateHash();
        isDirty = false;
        if (!silent) {
          window.success(sync ? "Synced & Saved" : "Saved");
          if (isNew || isPlaylistBuilder) handleNavigate("#/saved");
        }
      },
      { silent }
    );
  }

  async function importVideos() {
    try {
      const rawIds = [
        ...new Set(
          window.videoService
            ? window.videoService.parseYoutubeIds(importText)
            : [
                ...importText.matchAll(
                  /(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/g
                ),
              ].map((m) => m[1])
        ),
      ];

      if (rawIds.length === 0) {
        window.info("No valid YouTube video IDs found in the input.");
        return;
      }

      let newIds = rawIds;
      const settings = await window.getSettings();
      if (settings.autoRemoveDuplicates) {
        const existing = new Set(videos.map((v) => v.videoId));
        newIds = rawIds.filter((id) => !existing.has(id));
      }

      if (newIds.length === 0) {
        window.info("All videos already exist in this playlist.");
        displayModal = false;
        importText = "";
        return;
      }

      // Append placeholder stubs immediately — metadata is enriched in the
      // background so the user can keep interacting with the playlist.
      let imported: Video[] = newIds.map((id) => ({
        id: window.videoIdCount++,
        videoId: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title: "",
        channel: "",
        thumbnailUrl:
          window.videoService?.getVideoThumbnailUrl(id) ||
          `https://i.ytimg.com/vi/${id}/default.jpg`,
        isEnriching: autoFetchMetadata,
      }));

      // Populate stubs whose metadata is already cached in IndexedDB instantly.
      imported = await hydrateImportedFromCache(imported);

      videos = importAtTop ? [...imported, ...videos] : [...videos, ...imported];
      updateDirtyState();
      displayModal = false;
      importText = "";
      if (playlist && playlist.id && !isPlaylistBuilder) {
        savePlaylist({ silent: true }).catch(() => {});
      }
      window.success(`Imported ${imported.length} videos`);

      // Non-blocking background enrichment for any still-missing metadata.
      const stillMissing = imported.filter((v) => v.isEnriching);
      if (autoFetchMetadata && stillMissing.length > 0) {
        ensureMetadataLoaded(stillMissing, true).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to import videos:", e);
      window.error("Import failed. Check console for details.");
    }
  }

  async function scrapeHtml() {
    modalType = "ScrapeHtml";
    displayModal = true;
  }

  async function handleScrapeHtml() {
    try {
      // Extract YouTube links from HTML
      const youtubeRegex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
      const matches = [...htmlText.matchAll(youtubeRegex)];
      const videoIds = [...new Set(matches.map((m) => m[1]))];

      if (videoIds.length === 0) {
        window.info("No YouTube links found in the HTML");
        return;
      }

      let newIds = videoIds;
      const settings = await window.getSettings();
      if (settings.autoRemoveDuplicates) {
        const existing = new Set(videos.map((v) => v.videoId));
        newIds = videoIds.filter((id) => !existing.has(id));
      }

      // Append placeholder stubs immediately — metadata is enriched in the
      // background so the user can keep interacting with the playlist.
      let imported: Video[] = newIds.map((id) => ({
        id: window.videoIdCount++,
        videoId: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title: "",
        channel: "",
        thumbnailUrl:
          window.videoService?.getVideoThumbnailUrl(id) ||
          `https://i.ytimg.com/vi/${id}/default.jpg`,
        isEnriching: autoFetchMetadata,
      }));

      // Populate stubs whose metadata is already cached in IndexedDB instantly.
      imported = await hydrateImportedFromCache(imported);

      videos = [...videos, ...imported];
      updateDirtyState();
      displayModal = false;
      htmlText = "";
      if (playlist && playlist.id && !isPlaylistBuilder) {
        savePlaylist({ silent: true }).catch(() => {});
      }
      window.success(`Scraped ${imported.length} videos from HTML`);

      // Non-blocking background enrichment for any still-missing metadata.
      const stillMissing = imported.filter((v) => v.isEnriching);
      if (autoFetchMetadata && stillMissing.length > 0) {
        ensureMetadataLoaded(stillMissing, true).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to scrape HTML:", e);
      window.error("HTML scrape failed. Check console for details.");
    }
  }

  /** Returns true when a video is missing the metadata needed to sort on `field`. */
  function videoMissingMetadata(v: Video, field: SortField): boolean {
    switch (field) {
      case "viewCount":
        return v.viewCount === undefined;
      case "publishedAt":
        return v.publishedAt === undefined;
      case "duration":
        return v.durationSeconds === undefined && v.durationISO === undefined;
      case "channel":
        return !v.channel || v.channel === "undefined";
      case "title":
        return !v.title || v.title === "undefined";
    }
  }

  /** A video is missing essential metadata if it lacks title, channel, or duration. */
  function isVideoMissingMetadata(v: Video): boolean {
    const title = (v.title || "").trim();
    const channel = (v.channel || "").trim();
    const hasTitle = title && title !== "undefined";
    const hasChannel = channel && channel !== "undefined";
    const hasDuration = v.durationISO || v.isLive || v.isPrivate || v.isDeleted || v.isBroken;
    return !hasTitle || !hasChannel || !hasDuration;
  }

  /** Fill placeholder stubs with metadata already cached in IndexedDB (instant, no network). */
  async function hydrateImportedFromCache(stubs: Video[]): Promise<Video[]> {
    try {
      const cached = await dbGetMetadataBatch(stubs.map((s) => s.videoId));
      return stubs.map((s) => {
        const c = cached[s.videoId];
        if (!c || !(c.title || c.channel || c.durationISO)) return s;
        return {
          ...s,
          title: c.title,
          channel: c.channel,
          duration: c.durationISO,
          durationISO: c.durationISO,
          durationSeconds: c.durationSeconds || window.isoToSecs(c.durationISO),
          viewCount: c.viewCount,
          publishedAt: c.publishedAt,
          isPrivate: c.isPrivate,
          isDeleted: c.isDeleted,
          isBroken: c.isBroken,
          isLive: c.isLive,
          isEnriching: false,
        };
      });
    } catch (e) {
      return stubs;
    }
  }

  /** Backward-compatible mapping for the legacy single-field sort strings. */
  const LEGACY_SORT_RULES: Record<string, SortRule[]> = {
    title: [{ field: "title", direction: "asc" }],
    channel: [{ field: "channel", direction: "asc" }],
    duration: [{ field: "duration", direction: "asc" }],
    views: [{ field: "viewCount", direction: "desc" }],
    date: [{ field: "publishedAt", direction: "desc" }],
  };

  /**
   * Persists the current video order + sort rules to storage. Skipped for
   * brand-new (never-saved) playlists — those are saved by the normal
   * save/autosave flow so we never auto-create/sync them from a sort action.
   */
  async function persistAfterSort() {
    if (!dataLoaded || !playlist?.saved) return;
    await savePlaylist({ silent: true }).catch(() => {});
  }

  async function handleSort(type: string, rules?: SortRule[]) {
    // "reverse" is an imperative flip of the current order; it clears any rule chain.
    if (type === "reverse") {
      videos = utils.reversePlaylist(videos);
      activeSortRules = [];
      if (playlist) {
        playlist = { ...playlist, sortRules: [] };
      }
      updateDirtyState();
      await loadPageVideos(currentPage);
      await persistAfterSort();
      window.success("Reversed");
      return;
    }

    // "custom" opens the multi-sort modal instead of sorting immediately.
    if (type === "custom") {
      showMultiSort = true;
      return;
    }

    const effectiveRules = rules || LEGACY_SORT_RULES[type] || [];
    if (effectiveRules.length === 0) return;

    // 1. Identify videos missing critical metadata for the fields used
    const missing = videos.filter((v) =>
      effectiveRules.some((r) => videoMissingMetadata(v, r.field))
    );

    // 2. Aggressively fetch missing data if needed
    if (missing.length > 0) {
      if (
        !signedIn &&
        effectiveRules.some((r) => r.field === "viewCount" || r.field === "publishedAt")
      ) {
        window.info("Sign in to fetch more accurate video statistics for all videos.");
      }

      const success = await ensureMetadataLoaded(missing);
      if (!success) {
        window.info("Sort operation cancelled because metadata loading was stopped.");
        return;
      }
    }

    // 3. Log the operation
    if (window.logSystemEvent) {
      await window.logSystemEvent(
        "INFO",
        `[EDITOR] Performing Sort: ${utils.describeSortRules(effectiveRules) || type}`,
        { total: videos.length }
      );
    }

    // 4. Actually perform the sort
    videos = utils.sortByRules(videos, effectiveRules);
    activeSortRules = effectiveRules;

    // 5. Persist the active sort rules on the playlist object so the badge
    //    survives reloads (the reordered array itself is saved below).
    if (playlist) {
      playlist = { ...playlist, sortRules: effectiveRules };
    }

    updateDirtyState();
    await loadPageVideos(currentPage);

    // 6. Persist the new order + sort rules to storage immediately.
    await persistAfterSort();
    window.success("Sorted");
  }

  /** Callback invoked by the MultiSortModal when the user clicks "Apply & Save". */
  async function handleMultiSortApply(ruleSet: SortRule[]) {
    await handleSort("preset", ruleSet);
  }

  async function handleClean(type: string) {
    const original = videos.length;

    // 1. For metadata-dependent cleans (broken, duplicates, live), fetch missing metadata first
    if (type === "broken" || type === "duplicates" || type === "live") {
      const missing = videos.filter((v) => {
        const title = (v.title || "").trim();
        const channel = (v.channel || "").trim();

        const hasTitle = title && title !== "undefined";
        const hasChannel = channel && channel !== "undefined";
        const hasDuration = v.durationISO || v.isLive || v.isPrivate || v.isDeleted || v.isBroken;

        return !hasTitle || !hasChannel || !hasDuration;
      });

      if (missing.length > 0) {
        const success = await ensureMetadataLoaded(missing);
        if (!success) {
          window.info("Clean operation cancelled because metadata loading was stopped.");
          return;
        }
      }
    }

    if (type === "broken") {
      videos = videos.filter((v) => {
        const titleLower = (v.title || "").toLowerCase();
        const channelLower = (v.channel || "").toLowerCase();

        const isBroken =
          titleLower === "undefined" ||
          channelLower === "undefined" ||
          titleLower.includes("deleted video") ||
          titleLower.includes("private video") ||
          v.isPrivate === true ||
          v.isDeleted === true ||
          v.isBroken === true ||
          !v.title;

        return !isBroken;
      });
    } else if (type === "live") {
      videos = videos.filter((v) => !v.isLive && v.durationISO !== "LIVE" && v.duration !== "LIVE");
    } else if (type === "refetch") {
      // Find videos that are missing metadata (title, channel, durationISO)
      const missingMetadataVideos = videos.filter((v) => {
        const title = (v.title || "").trim();
        const channel = (v.channel || "").trim();

        const hasTitle = title && title !== "undefined";
        const hasChannel = channel && channel !== "undefined";
        const hasDuration = v.durationISO || v.isLive || v.isPrivate || v.isDeleted || v.isBroken;

        return !hasTitle || !hasChannel || !hasDuration;
      });

      if (missingMetadataVideos.length === 0) {
        requestConfirm({
          title: "Refetch Video Metadata",
          message: `All videos in this playlist already have metadata.\n\nDo you want to force-refetch metadata for all ${videos.length} videos from source?`,
          color: "primary",
          confirmLabel: "Force Refetch",
          cancelLabel: "Cancel",
          onConfirm: () => startRefetchProcess(videos, true),
        });
      } else {
        requestConfirm({
          title: "Refetch Missing Metadata",
          message: `Found ${missingMetadataVideos.length} video(s) with missing metadata (title, channel, or duration) out of ${videos.length} total videos.\n\nDo you want to fetch metadata for these ${missingMetadataVideos.length} video(s)?`,
          color: "primary",
          confirmLabel: "Fetch Missing",
          cancelLabel: "Cancel",
          onConfirm: () => startRefetchProcess(missingMetadataVideos, false),
        });
      }
    } else {
      const seen = new Set();
      videos = videos.filter((v) => {
        const id = v.videoId?.trim();
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }
    if (videos.length < original) {
      updateDirtyState();
      loadPageVideos(1);
      window.success(`Removed ${original - videos.length} videos`);
    } else {
      window.info("No items found to clean.");
    }
  }

  async function ensureMetadataLoaded(
    targetVideos: Video[],
    silent = false,
    force = false
  ): Promise<boolean> {
    if (targetVideos.length === 0) return true;

    // Only the modal (non-silent) path is guarded — silent background runs may
    // overlap; the engine's in-flight dedup prevents duplicate API calls.
    if (!silent) {
      if (_isLoadingMetadata) return false;
      _isLoadingMetadata = true;
    }

    const videoIds = targetVideos.map((v) => v.videoId);

    if (!silent) {
      showProgressModal = true;
      progressTitle = "Loading Video Metadata";
      progressText = "Preparing to fetch missing metadata...";
      progressPercent = 0;
      progressCurrent = 0;
      progressTotal = videoIds.length;
      progressCancelRequested = false;
      window.info(`Starting metadata fetch for ${videoIds.length} video(s)...`);
    }

    try {
      const { metaMap } = await enrichVideoMetadata(videoIds, {
        force,
        shouldCancel: () => !silent && progressCancelRequested,
        onProgress: (fetched, total) => {
          if (!silent) {
            progressCurrent = fetched;
            progressPercent = Math.round((fetched / total) * 100);
            progressText = `Loading metadata (${fetched} of ${total})...`;
          }
        },
      });

      // Apply resolved metadata back onto the video rows (reactive update).
      if (metaMap.size > 0) {
        videos = videos.map((v) => {
          const meta = metaMap.get(v.videoId);
          if (!meta) return v;
          return {
            ...v,
            isEnriching: false,
            title:
              meta.title ||
              v.title ||
              (meta.isPrivate
                ? "Private video"
                : meta.isDeleted
                  ? "Deleted video"
                  : "[Unavailable Video]"),
            channel:
              meta.channel ||
              v.channel ||
              (meta.isPrivate
                ? "Private channel"
                : meta.isDeleted
                  ? "Deleted channel"
                  : "[Unavailable]"),
            duration: meta.duration || v.duration,
            durationISO: meta.duration || v.durationISO,
            durationSeconds: meta.duration ? window.isoToSecs(meta.duration) : v.durationSeconds,
            viewCount: meta.viewCount !== undefined ? meta.viewCount : v.viewCount,
            publishedAt: meta.publishedAt || v.publishedAt,
            isPrivate: meta.isPrivate,
            isDeleted: meta.isDeleted,
            isBroken: meta.isBroken,
            isLive: meta.isLive,
            isUnavailable: meta.isUnavailable === true,
          };
        });
      }

      // Tag IDs that still have no metadata as unavailable (in-memory only — not
      // persisted, so transient failures retry on the next playlist load instead
      // of leaving a permanent false "unavailable" tag).
      const targetedIds = new Set(videoIds);
      videos = videos.map((v) => {
        if (targetedIds.has(v.videoId) && !metaMap.has(v.videoId)) {
          return {
            ...v,
            isEnriching: false,
            title: "[Unavailable Video]",
            channel: "[Unavailable]",
            isUnavailable: true,
          };
        }
        return v;
      });

      const unavailableIds = videoIds.filter((id) => !metaMap.has(id));
      const foundCount = videoIds.length - unavailableIds.length;

      if (!silent) {
        if (unavailableIds.length > 0) {
          console.warn("[EDITOR] Unavailable videos after metadata fetch:", unavailableIds);
          window.success(
            `Updated ${foundCount}/${videoIds.length} videos. ${unavailableIds.length} unavailable (see console).`
          );
        } else {
          window.success(
            `Metadata fetch complete: ${foundCount}/${videoIds.length} videos updated.`
          );
        }
      }

      // Keep state + storage in sync after enrichment. For local playlists a
      // silent save is a cheap storage.local write; for YouTube-synced playlists
      // the video ID list is unchanged and metadata already lives in IndexedDB,
      // so we avoid unnecessary YouTube API sync churn.
      updateDirtyState();
      if (silent && playlist && playlist.id && !isPlaylistBuilder && isLocal) {
        savePlaylist({ silent: true }).catch(() => {});
      }

      return !(!silent && progressCancelRequested);
    } catch (e) {
      console.error("Failed to load metadata:", e);
      if (!silent) window.error("Metadata fetch failed. Check console for details.");
      return false;
    } finally {
      if (!silent) {
        showProgressModal = false;
        _isLoadingMetadata = false;
      }
    }
  }

  async function startRefetchProcess(targetVideos: Video[], force = false) {
    const success = await ensureMetadataLoaded(targetVideos, false, force);
    updateDirtyState();
    if (playlist && playlist.id && !isPlaylistBuilder) {
      savePlaylist({ silent: true }).catch(() => {});
    }
    if (success) {
      window.success(`Successfully updated metadata for ${targetVideos.length} videos!`);
    } else {
      window.info("Refetch stopped. Saved current progress.");
    }
  }

  async function handleBulkAction(action: string) {
    const selected = videos.filter((v) => selectedVideoIds.has(v.id));
    const remaining = videos.filter((v) => !selectedVideoIds.has(v.id));

    if (action === "top") videos = [...selected, ...remaining];
    else if (action === "bottom") videos = [...remaining, ...selected];
    else if (action === "delete") {
      videos = remaining;
    }

    updateDirtyState();
    loadPageVideos(1);

    // Clear selection and exit select mode after any completed bulk action
    selectedVideoIds = new Set();
    isSelectMode = false;

    window.success("Action complete");
  }

  function handleBatchSelect(type: string) {
    const indices = videos
      .map((v, i) => (selectedVideoIds.has(v.id) ? i : -1))
      .filter((i) => i !== -1);
    if (indices.length === 0) return;

    const next = new Set(selectedVideoIds);
    if (type === "above") {
      const max = Math.max(...indices);
      for (let i = 0; i <= max; i++) next.add(videos[i].id);
    } else {
      const min = Math.min(...indices);
      for (let i = min; i < videos.length; i++) next.add(videos[i].id);
    }
    selectedVideoIds = next;
  }

  function selectFirst50() {
    const next = new Set<string | number>();
    const limit = Math.min(50, videos.length);
    for (let i = 0; i < limit; i++) {
      next.add(videos[i].id);
    }
    selectedVideoIds = next;
  }

  function openRangeSelect(direction: "above" | "below") {
    rangeSelectDirection = direction;
    rangeSelectModalOpen = true;
  }

  function handleRangeSelect(count: number) {
    const indices = videos
      .map((v, i) => (selectedVideoIds.has(v.id) ? i : -1))
      .filter((i) => i !== -1);
    if (indices.length === 0) return;

    const next = new Set(selectedVideoIds);
    if (rangeSelectDirection === "above") {
      // Anchor = top-most (minimum) selected index. Select the N items above it.
      const anchor = Math.min(...indices);
      const start = Math.max(0, anchor - count);
      for (let i = start; i < anchor; i++) next.add(videos[i].id);
    } else {
      // Anchor = bottom-most (maximum) selected index. Select the N items below it.
      const anchor = Math.max(...indices);
      const end = Math.min(videos.length - 1, anchor + count);
      for (let i = anchor + 1; i <= end; i++) next.add(videos[i].id);
    }
    selectedVideoIds = next;
  }

  async function handleManualSave() {
    if (isDirty) {
      await savePlaylist({ silent: false });
    } else {
      await refresh();
    }
  }

  // Misc
  async function refresh(options: { skipSave?: boolean } = {}) {
    await status.refresh(async () => {
      if (!options.skipSave && isDirty && dataLoaded) await savePlaylist({ silent: true });
      window.invalidatePlaylistCache();
      loadPageVideos(currentPage);
    });
  }

  async function discardChanges() {
    requestConfirm({
      title: "Discard Changes?",
      message:
        "This will revert the playlist to its last saved state. All unsaved changes will be lost.",
      color: "danger",
      onConfirm: async () => {
        if (playlist?.id) {
          isDiscarding = true;
          console.log("Starting discard, initialHash before:", initialHash);
          const loadedPlaylist = await window.getPlaylist(playlist.id);
          if (loadedPlaylist) {
            playlist = loadedPlaylist;
            await initializeVideos();
            initialHash = calculateStateHash();
            console.log("After initializeVideos, initialHash after:", initialHash);
            // Force reactivity by resetting status and local isDirty
            isDirty = false;
            status.isDirty = false;
            status.lastChange = 0;
            status.error = null;
            forceUpdate++;
            console.log(
              "Discard changes completed, isDirty:",
              isDirty,
              "initialHash:",
              initialHash
            );
          }
          isDiscarding = false;
          console.log("isDiscarding set to false");
        }
      },
    });
  }

  async function handleAdopt() {
    if (!playlist?.id || adopting) return;
    adopting = true;
    try {
      await window.adoptPlaylist(playlist.id);
      playlist = { ...playlist, isTagged: true };
      window.success("Playlist adopted");
    } finally {
      adopting = false;
    }
  }

  async function play() {
    isLoading = true;
    try {
      if (window.videoService) {
        await window.videoService.openPlaylist(
          videos.map((v) => v.videoId),
          playlist?.id
        );
      }
    } finally {
      isLoading = false;
    }
  }

  async function playFromHere(video: Video) {
    isLoading = true;
    try {
      const index = videos.findIndex((v) => v.id === video.id);
      if (index !== -1 && window.videoService) {
        const videosFromHere = videos.slice(index).map((v) => v.videoId);
        await window.videoService.openPlaylist(videosFromHere, playlist?.id);
      }
    } finally {
      isLoading = false;
    }
  }

  // Drag & Drop
  let hovering = $state(-1);
  const dragstart = (event: any, i: number) => {
    event.dataTransfer.setData("text/plain", (currentPage - 1) * pageSize + i);
  };
  const drop = async (event: any, targetIdx: number) => {
    const start = parseInt(event.dataTransfer.getData("text/plain"));
    const target = (currentPage - 1) * pageSize + targetIdx;
    const updated = [...videos];
    const item = updated.splice(start, 1)[0];
    updated.splice(target, 0, item);
    videos = updated;
    updateDirtyState();
    hovering = -1;
  };

  const customFlip: typeof flip = (node, animation, _) => {
    return flip(node, animation, { duration: 800, easing: expoOut });
  };
</script>

<div class="view-body">
  <StickyHeader>
    {#snippet children()}
      <ViewHeader
        icon={pageIcon}
        title={playlist?.title || pageTitle}
        count={videos.length}
        bind:editingTitle
        onTitleChange={(newTitle: string) => {
          if (playlist) {
            playlist.title = newTitle;
            updateDirtyState();
          }
        }}
        showFavoriteButton={true}
        isFavorite={isFavoritePlaylist}
        favoriteReadOnly={isFavoritePage || isFavoritePlaylist}
        onToggleFavorite={toggleFavorite}
        showSyncStatus={true}
        syncStatus={isLocal ? "local" : playlist?.isTagged ? "synced" : "online"}
        showLockButton={true}
        isLocked={playlist?.isPermanent === true}
        onToggleLock={async () => {
          if (playlist) {
            playlist.isPermanent = !playlist.isPermanent;
            await savePlaylist({ silent: true });
          }
        }}
        showSyncButton={signedIn &&
          isLocal &&
          playlist?.id !== "WL" &&
          videos.length > 0 &&
          !status.saving}
        onSync={() => savePlaylist({ forceSync: true })}
        showYoutubeButton={signedIn && !isLocal && !!playlist?.id}
        playlistId={playlist?.id}
        showAdoptButton={signedIn && isUnmanagedYT && videos.length > 0}
        isAdopting={adopting === true}
        onAdopt={handleAdopt}
        showDiscardButton={isDirty}
        onDiscard={discardChanges}
        showSaveStatus={true}
        {status}
        {isDirty}
        onSave={handleManualSave}
      />
    {/snippet}
    {#snippet subBar()}
      {#if playlist?.isPermanent}
        <div class="permanent-notice">
          <Fa icon={faLock} fw />
          <span>This playlist is permanent. Videos won't be automatically deleted.</span>
        </div>
      {/if}
      {#if playlist && (dataLoaded || !isLoading) && !authRequired && !error}
        {#if isSelectMode}
          <BulkActionsBar
            selectedCount={selectedVideoIds.size}
            isAllSelected={selectedVideoIds.size === videos.length}
            onToggleSelectAll={toggleSelectAll}
            onSelectAbove={() => handleBatchSelect("above")}
            onSelectBelow={() => handleBatchSelect("below")}
            onSelectFirst50={selectFirst50}
            onOpenRangeSelectAbove={() => openRangeSelect("above")}
            onOpenRangeSelectBelow={() => openRangeSelect("below")}
            onOpenCopyMove={openCopyMove}
            onMoveToTop={() => handleBulkAction("top")}
            onMoveToBottom={() => handleBulkAction("bottom")}
            onDelete={() =>
              requestConfirm({
                title: "Delete?",
                message: "Delete selected videos?",
                color: "danger",
                onConfirm: async () => {
                  await handleBulkAction("delete");
                },
              })}
            onCancel={() => {
              isSelectMode = false;
              selectedVideoIds = new Set();
            }}
          />
        {:else}
          <EditorToolbar
            hasVideos={videos.length > 0}
            bind:isSelectMode
            {activeSortRules}
            onPlay={play}
            onImport={() => {
              modalType = "Import";
              displayModal = true;
            }}
            onScrapeHtml={scrapeHtml}
            onClean={(type) => {
              if (type === "broken") {
                handleClean("broken");
              } else if (type === "duplicates") {
                handleClean("duplicates");
              } else if (type === "live") {
                handleClean("live");
              } else if (type === "refetch") {
                handleClean("refetch");
              }
            }}
            onSort={(type, rules) => {
              handleSort(type, rules);
            }}
          />
        {/if}
      {/if}
    {/snippet}
  </StickyHeader>

  {#if authRequired}
    <AuthPlaceholder message="Sign in to view Watch Later." />
  {:else if error}
    <div class="error-container">
      <p>{error}</p>
    </div>
  {:else if playlist}
    {#if dataLoaded || !isLoading}
      <div class="list">
        {#each paginatedVideos as video, index (video.id)}
          <div
            role="listitem"
            tabindex="-1"
            animate:customFlip
            draggable={!isSelectMode}
            ondragstart={(e) => dragstart(e, index)}
            ondragenter={() => (hovering = index)}
            ondragover={(e) => e.preventDefault()}
            ondrop={(e) => drop(e, index)}
          >
            <PlaylistVideo
              ondelete={(v) => {
                videos = videos.filter((x) => x.id !== v.id);
                updateDirtyState();
              }}
              ontoggleSelect={toggleSelect}
              onplayfromhere={playFromHere}
              {video}
              playlistId={playlist?.id}
              active={hovering === index}
              selectable={isSelectMode}
              selected={selectedVideoIds.has(video.id)}
            />
          </div>
        {:else}
          <p class="empty-msg">The playlist is empty</p>
        {/each}
      </div>

      {#if videos.length > 0}
        <div class="pagination-bar">
          <div class="page-size-control">
            <label class="page-size-label" for="editor-page-size">Per page</label>
            <select id="editor-page-size" value={pageSize} onchange={onPageSizeChange}>
              {#if !PAGE_SIZES.includes(pageSize)}
                <option value={pageSize}>{pageSize}</option>
              {/if}
              {#each PAGE_SIZES as size}
                <option value={size}>{size}</option>
              {/each}
            </select>
          </div>
          {#if videos.length > pageSize}
            <PaginationNav
              totalItems={videos.length}
              {pageSize}
              {currentPage}
              onsetpage={updatePaginationPage}
            />
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<PlaylistModals
  bind:display={displayModal}
  bind:modalType
  bind:importText
  bind:exportText
  bind:htmlText
  bind:importAtTop
  selectedCount={selectedVideoIds.size}
  bind:copyMoveAction
  bind:copyMoveCreateNew
  bind:copyMoveTargetPlaylistId
  bind:copyMoveNewPlaylistTitle
  bind:copyMovePosition
  {copyMoveTargetPlaylists}
  {copyMoveLoading}
  onImport={importVideos}
  onExport={() => {}}
  onScrapeHtml={handleScrapeHtml}
  onExecuteCopyMove={executeCopyMove}
/>

<RangeSelectModal
  bind:display={rangeSelectModalOpen}
  title={rangeSelectDirection === "above" ? "Select Videos (Above)" : "Select Videos (Below)"}
  maxValue={videos.length}
  onConfirm={handleRangeSelect}
/>

<MultiSortModal
  bind:display={showMultiSort}
  initialRules={activeSortRules}
  onApply={handleMultiSortApply}
/>

{#if isLoading}
  <LoadingModal />
{/if}

{#if showProgressModal}
  <div class="progress-modal-overlay">
    <div class="progress-modal-content">
      <h4>{progressTitle}</h4>
      <p class="progress-status-text">{progressText}</p>

      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: {progressPercent}%"></div>
      </div>

      <div class="progress-stats">
        <span>{progressCurrent} / {progressTotal} videos</span>
        <span>{progressPercent}%</span>
      </div>

      <div class="progress-actions">
        <SimpleButton
          onclick={() => {
            progressCancelRequested = true;
            progressText = "Stopping... saving current progress.";
          }}
          danger
          disabled={progressCancelRequested}
        >
          <span>{progressCancelRequested ? "Stopping..." : "Cancel"}</span>
        </SimpleButton>
      </div>
    </div>
  </div>
{/if}

<style>
  @import "../css/view-layout.css";

  .list {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
    background: var(--background-color);
  }

  .list > div:not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }

  .empty-msg {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }

  .pagination-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: wrap;
  }

  .page-size-control {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .page-size-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .page-size-control select {
    height: 36px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    color: var(--text-color);
    font-size: 13px;
    font-weight: 500;
    outline: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .page-size-control select:hover {
    background-color: var(--hover-color);
    border-color: var(--primary-color);
  }

  .page-size-control select:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(62, 166, 255, 0.1);
  }

  /* Premium Branded Buttons */
  :global(.btn-youtube),
  :global(.btn-sync) {
    transition:
      transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275),
      background-color 0.2s !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  :global(.btn-youtube:hover),
  :global(.btn-sync:hover) {
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  :global(.btn-youtube:active),
  :global(.btn-sync:active) {
    transform: translateY(0) scale(0.98);
  }

  :global(.btn-youtube) {
    background-color: #f00 !important; /* YouTube Red */
    border-color: #f00 !important;
    color: #fff !important;
  }

  :global(.btn-youtube:hover) {
    background-color: #ff3333 !important;
  }

  :global(.btn-sync) {
    background-color: var(--primary-color) !important;
    border-color: var(--primary-color) !important;
    color: #fff !important;
  }

  :global([data-theme="light"] .btn-sync) {
    color: #fff !important;
  }

  :global(.edit-toggle-btn.icon-only) {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
  }

  .permanent-notice {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 24px;
    background: var(--hover-color);
    border-bottom: 1px solid var(--border-color);
    color: var(--text-color);
    font-size: 14px;
    font-weight: 500;
  }

  .permanent-notice span {
    flex: 1;
  }

  :global(.edit-toggle-btn.icon-only:hover) {
    background-color: var(--active-bg-color) !important;
    color: var(--primary-color) !important;
    transform: scale(1.15);
  }

  :global(.edit-toggle-btn.icon-only.primary) {
    color: var(--primary-color) !important;
    background-color: var(--active-bg-color) !important;
  }

  .progress-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .progress-modal-content {
    background: var(--background-color, #0f0f0f);
    border: 1px solid var(--border-color, #272727);
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 450px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .progress-modal-content h4 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color, #fff);
  }

  .progress-status-text {
    margin: 0;
    font-size: 14px;
    color: var(--text-muted, #aaa);
    line-height: 1.4;
  }

  .progress-bar-container {
    width: 100%;
    height: 8px;
    background: var(--hover-color, #272727);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--primary-color, #3ea6ff);
    transition: width 0.3s ease-out;
  }

  .progress-stats {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text-muted, #aaa);
  }

  .progress-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
    border-top: 1px solid var(--border-color, #272727);
    padding-top: 16px;
  }
</style>
