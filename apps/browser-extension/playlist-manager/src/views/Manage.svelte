<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faBoxArchive,
    faFileExport,
    faFileImport,
    faTrash,
    faCodeMerge,
    faSearch,
    faRotateRight,
    faPencil,
    faExternalLink,
    faSortAmountDown,
    faXmark,
    faArrowUpRightFromSquare,
    faCloudArrowDown,
    faLock,
    faLockOpen,
    faEarthAmericas,
    faStar,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import SkeletonCard from "../components/SkeletonCard.svelte";
  import SyncStatusIndicator from "../components/SyncStatusIndicator.svelte";
  import ListRow from "../components/common/ListRow.svelte";
  import { requestConfirm } from "../stores/confirmation";
  import { onDestroy } from "svelte";
  import type { Playlist, PlaylistExport } from "../types/model";
  import { dbGetMetadataBatch } from "../services/db-service.js";
  import { push } from "svelte-spa-router";
  import { manageSearch } from "../stores/playlists-filters";

  const browser = (window as any).browser || (window as any).chrome;

  // ─── State ────────────────────────────────────────────────────────────────

  let allPlaylists: YtPlaylistInfoExtended[] = $state([]);
  let loading = $state(true);
  let syncing = $state(false);
  let signedIn = $state(false);
  let errorMessage = $state("");
  let sortBy = $state("newest"); // newest, oldest, title_asc, title_desc, count_desc
  let deleteAfterMerge = $state(true);
  let favoritePlaylistId = $state<string | null>(null);
  const status = new StatusManager();
  let savedTimeout: ReturnType<typeof setTimeout> | null = null;

  // Local search value that syncs with the store
  let searchValue = $state("");
  $effect(() => {
    searchValue = $manageSearch;
  });

  function handleSearchInput() {
    manageSearch.set(searchValue);
  }

  let _debounce: ReturnType<typeof setTimeout> | null = null;
  function triggerRefresh() {
    if (_debounce) clearTimeout(_debounce);
    _debounce = setTimeout(async () => {
      _debounce = null;
      await loadPlaylists();
    }, 300);
  }

  async function saveSetting(key: string, value: any) {
    await status.save(async () => {
      await window.storeObject(key, value);
      if (window.logSystemEvent)
        await window.logSystemEvent("INFO", `[MANAGE-VIEW] Saved setting: ${key}`);
      if (key === "manageSortBy" || key === "deleteAfterMerge") {
        triggerRefresh();
      }
    });
  }

  (async () => {
    try {
      signedIn = await window.isSignedIn();
      const settings = await window.getSettings();
      sortBy = settings.manageSortBy || "newest";
      deleteAfterMerge = settings.deleteAfterMerge !== undefined ? settings.deleteAfterMerge : true;
      favoritePlaylistId = settings.watchLaterPlaylistId ?? null;
      if (window.logSystemEvent)
        await window.logSystemEvent("INFO", `[MANAGE-VIEW] Initialized: signedIn=${signedIn}`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("Auth check failed", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[MANAGE-VIEW] Auth check failed: ${errMsg}`);
    }
    await loadPlaylists();
  })();

  let selectedIds = $state(new Set<string>());

  // Drag state for reordering
  let draggingIndex = $state(-1);
  let dragOverIndex = $state(-1);

  function handleDragStart(event: DragEvent, index: number) {
    draggingIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", index.toString());
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = -1;
  }

  async function handleDrop(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    dragOverIndex = -1;

    if (draggingIndex === -1 || draggingIndex === targetIndex) {
      draggingIndex = -1;
      return;
    }

    // Reorder the playlists
    const newList = [...allPlaylists];
    const [removed] = newList.splice(draggingIndex, 1);
    newList.splice(targetIndex, 0, removed);
    allPlaylists = newList;

    draggingIndex = -1;

    // Trigger refresh to update UI
    triggerRefresh();
  }

  let filteredPlaylists = $derived(
    allPlaylists
      .filter((p) => {
        if (!$manageSearch) return true;
        return p.title.toLowerCase().includes($manageSearch.toLowerCase());
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return (b.timestamp || 0) - (a.timestamp || 0);
          case "oldest":
            return (a.timestamp || 0) - (b.timestamp || 0);
          case "title_asc":
            return a.title.localeCompare(b.title);
          case "title_desc":
            return b.title.localeCompare(a.title);
          case "count_desc":
            return (b.videoCount || 0) - (a.videoCount || 0);
          default:
            return 0;
        }
      })
  );

  let allSelected = $derived(
    filteredPlaylists.length > 0 && filteredPlaylists.every((p) => selectedIds.has(p.id))
  );

  let someSelected = $derived(selectedIds.size > 0 && !allSelected);

  const selectedPlaylists = $derived(allPlaylists.filter((p) => selectedIds.has(p.id)));

  // Only allow privacy change for YouTube (non-local) playlists
  const canChangePrivacy = $derived(
    selectedPlaylists.length > 0 && selectedPlaylists.some((p) => !p.isLocal)
  );
  const selectedYoutubeCount = $derived(selectedPlaylists.filter((p) => !p.isLocal).length);

  // Disable dropdown when mixed YouTube + offline playlists selected
  const isPrivacyMixed = $derived(
    selectedPlaylists.length > 0 &&
      selectedPlaylists.some((p) => !p.isLocal) &&
      selectedPlaylists.some((p) => p.isLocal)
  );

  // Privacy change state
  let newPrivacyStatus: "private" | "unlisted" | "public" | "" = $state("");

  async function executeChangePrivacy() {
    if (!newPrivacyStatus || selectedYoutubeCount === 0) return;
    const targets = selectedPlaylists.filter((p) => !p.isLocal);
    if (targets.length === 0) return;

    const statusToSet = newPrivacyStatus;
    newPrivacyStatus = "";

    prog = {
      active: true,
      title: `Changing privacy…`,
      phase: "loading",
      message: "",
      current: 0,
      total: targets.length,
      startTime: Date.now(),
      done: false,
      error: null,
    };
    startTick();

    try {
      for (let i = 0; i < targets.length; i++) {
        prog = {
          ...prog,
          message: `Setting ${targets[i].title} to ${statusToSet}… (${i + 1}/${targets.length})`,
          current: i,
        };
        await window.ytUpdatePlaylistPrivacy(targets[i].id, statusToSet);
        prog = { ...prog, current: i + 1 };
      }

      window.invalidateCacheAndNotify();
      await loadPlaylists();
      prog.active = false;
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[MANAGE-VIEW] Changed privacy to ${statusToSet} for ${targets.length} playlists`
        );
      window.success(
        `Privacy changed to ${statusToSet} for ${targets.length} playlist${targets.length !== 1 ? "s" : ""}.`
      );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[MANAGE-VIEW] Change privacy failed: ${errMsg}`);
      prog = {
        ...prog,
        done: true,
        phase: "done",
        error: "Change privacy failed: " + errMsg,
      };
    }
    stopTick();
  }

  const isMergeTypeCompatible = $derived(
    selectedPlaylists.length < 2 ||
      selectedPlaylists.every((p) => p.isLocal === selectedPlaylists[0].isLocal)
  );

  let canMerge = $derived(selectedPlaylists.length >= 2);

  // Favorite playlist that is NOT already in the selection — can be used as an additional merge target
  const favMergeTarget = $derived.by(() => {
    if (!favoritePlaylistId) return null;
    // Check if the fav is already a selected merge target
    if (selectedIds.has(favoritePlaylistId)) return null;
    // Find the fav playlist in allPlaylists
    return allPlaylists.find((p) => p.id === favoritePlaylistId) ?? null;
  });

  // Merge is also allowed when merging 1+ playlists INTO the favorite (1 or more selected + fav as target)
  const canMergeIntoFav = $derived(!!favMergeTarget && selectedPlaylists.length >= 1);

  const isFavMergeTypeCompatible = $derived.by(() => {
    if (!favMergeTarget) return true;
    return selectedPlaylists.every((p) => p.isLocal === favMergeTarget.isLocal);
  });

  const favMergeTitle = $derived.by(() => {
    if (!favMergeTarget) return "Merge selected into Favorite playlist";
    if (isFavMergeTypeCompatible) {
      return `Merge selected into Favorite playlist: ${favMergeTarget.title || "Untitled Playlist"}`;
    }
    return favMergeTarget.isLocal
      ? "Cannot merge YouTube playlists into an offline favorite"
      : "Cannot merge offline playlists into a YouTube favorite";
  });

  // Merge dialog
  let showMerge = $state(false);
  let mergeTitle = $state("");
  let mergeTargetId = $state("new");

  let mergeRawTotal = $derived(selectedPlaylists.reduce((s, p) => s + (p.videoCount || 0), 0));

  // ─── Save Offline dialog ───────────────────────────────────────────────────
  let showSaveOffline = $state(false);
  let offlinePlaylists = $state<{ yt: YtPlaylistInfoExtended; local: Playlist | null }[]>([]);
  let offlineSaveMode = $state<Record<string, "sync" | "new" | "skip">>({});
  let offlineTitles = $state<Record<string, string>>({});
  let savingOffline = $state(false);

  let canSaveOffline = $derived(selectedPlaylists.filter((p) => !p.isLocal).length > 0);

  function openSaveOffline() {
    const targets = selectedPlaylists.filter((p) => !p.isLocal);
    if (targets.length === 0) return;

    offlinePlaylists = [];
    offlineSaveMode = {};
    offlineTitles = {};

    // Check for existing local copies
    (async () => {
      const localPlaylists = await window
        .getPlaylists()
        .then((pls) => pls.filter((p) => p.isLocal));
      for (const yt of targets) {
        const existingLocal = localPlaylists.find(
          (p) => p.title.toLowerCase() === yt.title.toLowerCase()
        );
        offlinePlaylists = [...offlinePlaylists, { yt, local: existingLocal || null }];
        if (existingLocal) {
          offlineSaveMode[yt.id] = "sync";
        } else {
          offlineSaveMode[yt.id] = "new";
        }
        offlineTitles[yt.id] = yt.title;
      }
      showSaveOffline = true;
    })();
  }

  async function executeSaveOffline() {
    showSaveOffline = false;
    const targets = offlinePlaylists.filter((p) => offlineSaveMode[p.yt.id] !== "skip");
    if (targets.length === 0) return;

    prog = {
      active: true,
      title: "Saving offline…",
      phase: "loading",
      message: "",
      current: 0,
      total: targets.length,
      startTime: Date.now(),
      done: false,
      error: null,
    };
    startTick();

    try {
      for (let i = 0; i < targets.length; i++) {
        const { yt, local } = targets[i];
        const mode = offlineSaveMode[yt.id];
        const title = offlineTitles[yt.id];

        prog = {
          ...prog,
          message: `Loading "${yt.title}"… (${i + 1}/${targets.length})`,
          current: i,
        };

        const full = await window.getPlaylist(yt.id);
        if (!full) {
          console.warn("Failed to load playlist:", yt.id);
          continue;
        }

        if (mode === "new") {
          // Create new local playlist
          const localPlaylist: Playlist = {
            id: "",
            title: title,
            videos: full.videos,
            timestamp: Date.now(),
            saved: false,
            isLocal: true,
          };
          await window.savePlaylist(localPlaylist, { syncToYoutube: false });
        } else if (mode === "sync" && local) {
          // Sync: match local videos to cloud
          const cloudSet = new Set(full.videos);
          const localSet = new Set(local.videos);

          // Add missing videos
          for (const vid of full.videos) {
            if (!localSet.has(vid)) {
              local.videos.push(vid);
            }
          }
          // Remove deleted videos (videos in local but not in cloud)
          local.videos = local.videos.filter((vid) => cloudSet.has(vid));
          local.title = title;
          local.timestamp = Date.now();
          await window.savePlaylist(local, { syncToYoutube: false });
        }

        prog = { ...prog, current: i + 1 };
      }

      window.invalidateCacheAndNotify();
      await loadPlaylists();
      prog.active = false;
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[MANAGE-VIEW] Saved offline: ${targets.length} playlists`
        );
      window.success(`${targets.length} playlist${targets.length !== 1 ? "s" : ""} saved offline.`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[MANAGE-VIEW] Save offline failed: ${errMsg}`);
      prog = {
        ...prog,
        done: true,
        phase: "done",
        error: "Save offline failed: " + errMsg,
      };
    }
    stopTick();
  }

  function generateUniqueTitle(baseTitle: string, usedTitles: string[]): string {
    let counter = 1;
    let newTitle = baseTitle;
    while (usedTitles.includes(newTitle)) {
      newTitle = `${baseTitle} (${counter})`;
      counter++;
    }
    return newTitle;
  }

  function handleModeChange(ytId: string, mode: "sync" | "new" | "skip") {
    offlineSaveMode[ytId] = mode;
    if (mode === "new") {
      const usedTitles = Object.keys(offlineTitles).map((id) => offlineTitles[id]);
      offlineTitles[ytId] = generateUniqueTitle(
        offlinePlaylists.find((p) => p.yt.id === ytId)?.yt.title || "",
        usedTitles
      );
    }
  }

  // Progress dialog
  type Phase = "idle" | "loading" | "creating" | "adding" | "deleting" | "done";
  let prog: {
    active: boolean;
    title: string;
    phase: Phase;
    message: string;
    current: number;
    total: number;
    startTime: number;
    done: boolean;
    error: string | null;
  } = $state({
    active: false,
    title: "",
    phase: "idle" as Phase,
    message: "",
    current: 0,
    total: 1,
    startTime: 0,
    done: false,
    error: null as string | null,
  });

  let progressPct = $derived(
    prog.total > 0 ? Math.min(100, Math.round((prog.current / prog.total) * 100)) : 0
  );

  let elapsedDisplay = $state("0:00");
  let etaDisplay = $state("—");
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  function startTick() {
    elapsedDisplay = "0:00";
    etaDisplay = "—";
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      const ms = Date.now() - prog.startTime;
      const secs = Math.floor(ms / 1000);
      elapsedDisplay = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
      if (prog.current > 0) {
        const rem = (ms / prog.current) * (prog.total - prog.current);
        if (rem < 2000) {
          etaDisplay = "< 1s";
        } else {
          const rs = Math.round(rem / 1000);
          etaDisplay = rs < 60 ? `~${rs}s` : `~${Math.floor(rs / 60)}m ${rs % 60}s`;
        }
      }
    }, 1000);
  }

  function stopTick() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  // ─── Data ─────────────────────────────────────────────────────────────────

  async function loadPlaylists() {
    if (allPlaylists.length === 0) loading = true;
    syncing = true;
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", "[MANAGE-VIEW] Loading managed playlists");
    try {
      const all = await window.getAccountPlaylists();
      allPlaylists = all.filter(
        (p) => !["WL", "LIKED", "UPLOADS"].includes(p.id) || p.id === favoritePlaylistId
      );
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[MANAGE-VIEW] Loaded ${allPlaylists.length} managed playlists`
        );
    } catch {
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", "[MANAGE-VIEW] Failed to load playlists");
      window.error("Failed to load playlists");
    } finally {
      loading = false;
      syncing = false;
    }
  }

  async function refresh() {
    await status.refresh(async () => {
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          "[MANAGE-VIEW] Refreshing playlists (cache invalidated)"
        );
      window.invalidatePlaylistCache();
      await loadPlaylists();
    });
  }

  function handleStorage(changes: Record<string, { newValue?: any }>, area: string) {
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
        loadPlaylists();
      }
      // Keep favoritePlaylistId in sync with setting changes from other pages
      if ("watchLaterPlaylistId" in changes) {
        favoritePlaylistId = changes["watchLaterPlaylistId"].newValue ?? null;
        loadPlaylists();
      }
    }

    if (area !== "local") return;

    const relevantKeys = ["yt_playlist_cache_v1", "saved_playlists"];
    const hasPlaylistChanges = Object.keys(changes).some(
      (key) => relevantKeys.includes(key) || key.startsWith("playlist_")
    );

    if (hasPlaylistChanges) {
      triggerRefresh();
    }
  }
  browser.storage.onChanged.addListener(handleStorage);
  onDestroy(() => {
    browser.storage.onChanged.removeListener(handleStorage);
    if (_debounce) clearTimeout(_debounce);
    stopTick();
  });

  // ─── Selection ────────────────────────────────────────────────────────────

  let selectAllEl: HTMLInputElement | undefined = $state();
  $effect(() => {
    if (selectAllEl) selectAllEl.indeterminate = someSelected;
  });

  function toggleAll() {
    if (allSelected) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(filteredPlaylists.map((p) => p.id));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    selectedIds = next;
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  function importPlaylists() {
    const fi = document.getElementById("ManageImportInput") as HTMLInputElement;
    fi.onchange = () => {
      const file = fi.files?.[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const data: PlaylistExport[] = JSON.parse(fr.result as string);
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "INFO",
              `[MANAGE-VIEW] Importing ${data.length} playlists from file`
            );
          await window.importPlaylists(data);
          await loadPlaylists();
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "INFO",
              `[MANAGE-VIEW] Import successful: ${data.length} playlists`
            );
          window.success("Playlists imported successfully");
        } catch {
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "ERROR",
              "[MANAGE-VIEW] Import failed: file incorrectly formatted"
            );
          window.error("File is incorrectly formatted");
        }
        fi.value = "";
      };
      fr.readAsText(file);
    };
    fi.click();
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async function exportAll() {
    if (selectedIds.size > 0) {
      await runExport([...selectedPlaylists]);
    } else {
      await runExport(allPlaylists);
    }
  }
  async function exportSelected() {
    await runExport([...selectedPlaylists]);
  }

  async function runExport(targets: YtPlaylistInfoExtended[]) {
    prog = {
      active: true,
      title: "Exporting…",
      phase: "loading",
      message: "",
      current: 0,
      total: targets.length,
      startTime: Date.now(),
      done: false,
      error: null,
    };
    startTick();
    try {
      const result: PlaylistExport[] = [];
      for (let i = 0; i < targets.length; i++) {
        prog = {
          ...prog,
          message: `Loading "${targets[i].title}"… (${i + 1}/${targets.length})`,
          current: i,
        };
        const full = await window.getPlaylist(targets[i].id);
        if (full) {
          const exportEntry: PlaylistExport = {
            title: full.title,
            videos: full.videos,
            timestamp: full.timestamp,
          };
          // Attach metadata for this playlist's videos from IndexedDB
          const playlistMeta: Record<string, any> = {};
          if (full.videos && full.videos.length > 0) {
            const metaBatch = await dbGetMetadataBatch(full.videos);
            for (const vid of full.videos) {
              const entry = metaBatch[vid];
              if (entry && entry.title) {
                const { lastFetchAttempt, lastCachedAt, ...rest } = entry;
                playlistMeta[vid] = rest;
              }
            }
          }
          if (Object.keys(playlistMeta).length > 0) {
            exportEntry.metadata = playlistMeta;
          }
          result.push(exportEntry);
        }
        prog = { ...prog, current: i + 1 };
      }
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "playlists-export.json";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      prog.active = false;
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[MANAGE-VIEW] Export successful: ${result.length} playlists`
        );
      window.success(`${result.length} playlist${result.length !== 1 ? "s" : ""} exported.`);
    } catch (e) {
      prog.active = false;
      const errMsg = e instanceof Error ? e.message : String(e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[MANAGE-VIEW] Export failed: ${errMsg}`);
      window.error("Export failed: " + (e as Error).message);
    }
    stopTick();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  function requestDelete() {
    const n = selectedIds.size;
    requestConfirm({
      title: `Delete ${n} playlist${n !== 1 ? "s" : ""}?`,
      message: `This will permanently delete ${n} playlist${n !== 1 ? "s" : ""} and cannot be undone.`,
      color: "danger",
      onConfirm: executeDelete,
    });
  }

  async function executeDelete() {
    const targets = [...selectedPlaylists];
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", `[MANAGE-VIEW] Deleting ${targets.length} playlists`);
    prog = {
      active: true,
      title: `Deleting ${targets.length} playlist${targets.length !== 1 ? "s" : ""}…`,
      phase: "deleting",
      message: "",
      current: 0,
      total: targets.length,
      startTime: Date.now(),
      done: false,
      error: null,
    };
    startTick();
    try {
      const fullPlaylists = await Promise.all(
        targets.map((p: YtPlaylistInfoExtended) => window.getPlaylist(p.id))
      );
      await window.removePlaylists(fullPlaylists.filter((p: any) => p !== null));
      await loadPlaylists();

      selectedIds = new Set();
      prog.active = false;
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[MANAGE-VIEW] Deleted ${targets.length} playlists successfully`
        );
      window.success(`${targets.length} playlist${targets.length !== 1 ? "s" : ""} deleted.`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[MANAGE-VIEW] Delete failed: ${errMsg}`);
      prog = {
        ...prog,
        done: true,
        phase: "done",
        error: "Delete failed: " + (e as Error).message,
      };
    }
    stopTick();
  }

  async function executeSingleDelete(p: YtPlaylistInfoExtended) {
    requestConfirm({
      title: `Delete "${p.title}"?`,
      message: "This will permanently delete the playlist.",
      color: "danger",
      onConfirm: async () => {
        try {
          const full = await window.getPlaylist(p.id);
          if (full) await window.removePlaylist(full);
          await loadPlaylists();
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "INFO",
              `[MANAGE-VIEW] Deleted playlist: ${p.title} (${p.id})`
            );
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error("Failed to delete playlist:", e);
          if (window.logSystemEvent)
            await window.logSystemEvent(
              "ERROR",
              `[MANAGE-VIEW] Single delete failed for ${p.id}: ${errMsg}`
            );
          window.error("Failed to delete playlist");
        }
      },
    });
  }

  // ─── Merge ────────────────────────────────────────────────────────────────

  function openMerge(targetId?: string) {
    mergeTargetId = targetId ?? "new";
    mergeTitle = selectedPlaylists.map((p) => p.title).join(" + ");
    showMerge = true;
  }

  async function executeMerge() {
    showMerge = false;
    const isNew = mergeTargetId === "new";
    const targets = [...selectedPlaylists];
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        `[MANAGE-VIEW] Merging ${targets.length} playlists (target=${isNew ? "new" : mergeTargetId})`
      );

    // Determine title for progress
    const destTitle = isNew
      ? mergeTitle
      : allPlaylists.find((p) => p.id === mergeTargetId)?.title ||
        favMergeTarget?.title ||
        "Existing Playlist";

    const initialTotal = targets.length + (isNew ? 1 : 0) + (deleteAfterMerge ? targets.length : 0);
    prog = {
      active: true,
      title: isNew ? `Merging ${targets.length} playlists…` : `Merging into "${destTitle}"…`,
      phase: "loading",
      message: "",
      current: 0,
      total: initialTotal,
      startTime: Date.now(),
      done: false,
      error: null,
    };
    startTick();
    try {
      // Phase 1: Gather unique video IDs
      const seen = new Set<string>();
      const videoIds: string[] = [];
      const fullPlaylists: Playlist[] = [];

      // If merging to existing, load its videos first to skip duplicates
      if (!isNew) {
        prog = { ...prog, message: `Loading destination "${destTitle}"…` };
        const destFull = await window.getPlaylist(mergeTargetId);
        if (destFull) {
          for (const vid of destFull.videos) {
            seen.add(vid);
          }
        }
      }

      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        // If this target is our destination, we skip loading/deleting it
        if (!isNew && t.id === mergeTargetId) continue;

        prog = {
          ...prog,
          message: `Loading "${t.title}"… (${i + 1}/${targets.length})`,
          current: i,
        };
        const full = await window.getPlaylist(t.id);
        if (full) {
          fullPlaylists.push(full);
          for (const vid of full.videos) {
            if (!seen.has(vid)) {
              seen.add(vid);
              videoIds.push(vid);
            }
          }
        }
        prog = { ...prog, current: i + 1 };
      }

      const totalSourceVideos = targets
        .filter((t) => isNew || t.id !== mergeTargetId)
        .reduce((s, p) => s + (p.videoCount || 0), 0);
      const dupes = totalSourceVideos - videoIds.length;

      const totalSteps =
        targets.length +
        (isNew ? 1 : 0) +
        videoIds.length +
        (deleteAfterMerge ? fullPlaylists.length : 0);
      prog = { ...prog, total: totalSteps };

      // Phase 2: Create (Skip if merging to existing)
      let targetId = mergeTargetId;
      if (isNew) {
        prog = {
          ...prog,
          phase: "creating",
          message: `Creating "${mergeTitle}"…`,
        };
        if (signedIn) {
          const settings = await window.getSettings();
          targetId = await window.ytCreatePlaylist(mergeTitle, settings.defaultPrivacy);
        } else {
          targetId = await window.generatePlaylistId();
        }
        prog = { ...prog, current: targets.length + 1 };
      }

      // Phase 3: Add videos
      const isLocalTarget = targetId.startsWith("local-");
      if (signedIn && !isLocalTarget) {
        for (let i = 0; i < videoIds.length; i++) {
          prog = {
            ...prog,
            phase: "adding",
            message: `Adding video ${i + 1} of ${videoIds.length}${dupes > 0 ? ` · ${dupes} duplicate${dupes !== 1 ? "s" : ""} removed` : ""}…`,
            current: targets.length + (isNew ? 1 : 0) + i,
          };
          await window.ytAddVideo(targetId, videoIds[i]);
        }
      } else {
        prog = {
          ...prog,
          phase: "adding",
          message: isNew
            ? `Saving ${videoIds.length} videos locally…`
            : `Adding ${videoIds.length} videos to "${destTitle}"…`,
        };
        if (isNew) {
          const lp: Playlist = {
            id: targetId,
            title: mergeTitle,
            videos: videoIds,
            timestamp: Date.now(),
            saved: false,
            isLocal: true,
          };
          await window.savePlaylist(lp, { syncToYoutube: false });
        } else {
          // Local merge to existing
          const destFull = await window.getPlaylist(targetId);
          if (destFull) {
            destFull.videos = [...destFull.videos, ...videoIds];
            destFull.timestamp = Date.now();
            await window.savePlaylist(destFull, { syncToYoutube: false });
          }
        }
      }
      prog = {
        ...prog,
        current: targets.length + (isNew ? 1 : 0) + videoIds.length,
      };

      // Phase 4: Delete sources
      if (deleteAfterMerge && fullPlaylists.length > 0) {
        prog = {
          ...prog,
          phase: "deleting",
          message: `Removing ${fullPlaylists.length} source playlist${fullPlaylists.length !== 1 ? "s" : ""}…`,
        };
        await window.removePlaylists(fullPlaylists);
      }

      selectedIds = new Set();
      window.invalidateCacheAndNotify();
      await loadPlaylists();
      prog.active = false;
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[MANAGE-VIEW] Merge complete: ${videoIds.length} unique videos, ${dupes} duplicates removed`
        );
      window.success(
        `Done! ${videoIds.length} unique video${videoIds.length !== 1 ? "s" : ""} merged${dupes > 0 ? `, ${dupes} duplicate${dupes !== 1 ? "s" : ""} removed` : ""}.`
      );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[MANAGE-VIEW] Merge failed: ${errMsg}`);
      prog = {
        ...prog,
        done: true,
        phase: "done",
        error: "Merge failed: " + (e as Error).message,
      };
    }
    stopTick();
  }

  function editPlaylist(id: string) {
    window.location.hash = `#/playlist?id=${id}`;
  }

  function openOnYoutube(id: string) {
    if (id.startsWith("local-")) return;
    window.open(`https://www.youtube.com/playlist?list=${id}`, "_blank");
  }

  function saveOfflineSingle(id: string) {
    selectedIds = new Set([id]);
    openSaveOffline();
  }
</script>

<!-- ─── Progress dialog ──────────────────────────────────────────────────── -->
{#if prog.active}
  <div class="overlay">
    <div
      class="dialog prog-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prog-dialog-title"
    >
      <h2 class="dialog-title" id="prog-dialog-title">{prog.title}</h2>
      <div class="prog-container">
        <p class="dialog-msg">{prog.message}</p>
        <div class="prog-track">
          <div class="prog-fill" style="transform: scaleX({progressPct / 100})"></div>
        </div>
        <div class="prog-meta">
          <span>{prog.current} / {prog.total} steps ({progressPct}%)</span>
          {#if !prog.done}
            <span>Elapsed: {elapsedDisplay} · ETA: {etaDisplay}</span>
          {/if}
        </div>
      </div>
      {#if prog.error}<p class="dialog-error">{prog.error}</p>{/if}
      {#if prog.done}
        <div class="dialog-actions">
          <SimpleButton onclick={() => (prog = { ...prog, active: false })} primary
            >Close</SimpleButton
          >
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ─── Merge dialog ─────────────────────────────────────────────────────── -->
{#if showMerge}
  <div class="overlay">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="merge-dialog-title">
      <h2 class="dialog-title" id="merge-dialog-title">
        Merge {selectedIds.size} Playlists
      </h2>
      <p class="dialog-info">
        ~{mergeRawTotal} videos total · duplicates will be removed automatically
      </p>

      <div class="field-group">
        <label class="field-label" for="mergeTarget">Merge destination</label>
        <select id="mergeTarget" bind:value={mergeTargetId} class="text-input">
          <option value="new">✚ Create New Playlist</option>
          {#each selectedPlaylists as p}
            <option value={p.id}>{p.title} {p.isLocal ? "(Offline)" : "(YouTube)"}</option>
          {/each}
          {#if favMergeTarget}
            <option value={favMergeTarget.id}
              >⭐ {favMergeTarget.title} (Favorite {favMergeTarget.isLocal
                ? "· Offline"
                : "· YouTube"})</option
            >
          {/if}
        </select>
      </div>

      {#if mergeTargetId === "new"}
        <div class="field-group">
          <label class="field-label" for="mergeTitle">New playlist name</label>
          <input
            aria-label="New playlist name"
            id="mergeTitle"
            class="text-input"
            bind:value={mergeTitle}
            placeholder="Enter playlist name…"
          />
        </div>
      {/if}

      <label class="check-label">
        <input
          aria-label="Delete source playlists after merge"
          type="checkbox"
          bind:checked={deleteAfterMerge}
          onchange={() => saveSetting("deleteAfterMerge", deleteAfterMerge)}
        />
        Delete source playlists after merge
      </label>
      <div class="dialog-actions">
        <SimpleButton onclick={() => (showMerge = false)} secondary>Cancel</SimpleButton>
        <SimpleButton
          onclick={executeMerge}
          primary
          disabled={mergeTargetId === "new" && !mergeTitle.trim()}
        >
          <Fa icon={faCodeMerge} fw />
          Merge Playlists
        </SimpleButton>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Save Offline dialog ─────────────────────────────────────────────── -->
{#if showSaveOffline}
  <div class="overlay">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="offline-dialog-title">
      <h2 class="dialog-title" id="offline-dialog-title">Save Offline</h2>
      <p class="dialog-info">
        {offlinePlaylists.length} playlist{offlinePlaylists.length !== 1 ? "s" : ""} selected
      </p>

      <div class="offline-playlist-list">
        {#each offlinePlaylists as item (item.yt.id)}
          <div class="offline-playlist-item">
            <div class="offline-playlist-info">
              <span class="offline-playlist-title">{item.yt.title}</span>
              <span class="offline-playlist-meta">
                {item.yt.videoCount} videos
                {#if item.local}
                  <span class="badge local">Existing copy</span>
                {/if}
              </span>
            </div>
            <div class="offline-playlist-options">
              {#if item.local}
                <label class="radio-label">
                  <input
                    type="radio"
                    name="mode-{item.yt.id}"
                    checked={offlineSaveMode[item.yt.id] === "sync"}
                    onchange={() => handleModeChange(item.yt.id, "sync")}
                  />
                  Sync existing
                </label>
              {/if}
              <label class="radio-label">
                <input
                  type="radio"
                  name="mode-{item.yt.id}"
                  checked={offlineSaveMode[item.yt.id] === "new"}
                  onchange={() => handleModeChange(item.yt.id, "new")}
                />
                {item.local ? "Create new copy" : "Save"}
              </label>
              {#if offlineSaveMode[item.yt.id] === "new" && item.local}
                <input
                  type="text"
                  class="text-input offline-title-input"
                  bind:value={offlineTitles[item.yt.id]}
                  placeholder="Playlist name"
                />
              {/if}
              <label class="radio-label">
                <input
                  type="radio"
                  name="mode-{item.yt.id}"
                  checked={offlineSaveMode[item.yt.id] === "skip"}
                  onchange={() => handleModeChange(item.yt.id, "skip")}
                />
                Skip
              </label>
            </div>
          </div>
        {/each}
      </div>

      <div class="dialog-actions">
        <SimpleButton onclick={() => (showSaveOffline = false)} secondary>Cancel</SimpleButton>
        <SimpleButton
          onclick={executeSaveOffline}
          primary
          disabled={offlinePlaylists.every((p) => offlineSaveMode[p.yt.id] === "skip")}
        >
          <Fa icon={faCloudArrowDown} fw />
          Save Offline
        </SimpleButton>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Main ─────────────────────────────────────────────────────────────── -->
<main>
  <ViewHeader
    icon={faBoxArchive}
    title="Manage"
    count={allPlaylists.length}
    showSaveStatus={true}
    {status}
    onSave={refresh}
  >
    <div class="header-actions-inline">
      <SimpleButton onclick={exportAll} secondary disabled={allPlaylists.length === 0}>
        <Fa icon={faFileExport} fw /><span
          >{selectedIds.size > 0 ? "Export Selected" : "Export All"}</span
        >
      </SimpleButton>

      <SimpleButton onclick={importPlaylists} secondary>
        <Fa icon={faFileImport} fw /><span>Import</span>
      </SimpleButton>
    </div>
  </ViewHeader>

  <div class="view-body">
    {#if loading}
      <div class="skeleton-grid">
        {#each Array(6) as _}
          <SkeletonCard />
        {/each}
      </div>
    {:else if filteredPlaylists.length === 0}
      <div class="empty-state">
        <Fa icon={faBoxArchive} size="3x" />
        <p>
          {$manageSearch ? "No playlists match your search." : "No managed playlists found."}
        </p>
        {#if !$manageSearch}
          <SimpleButton onclick={() => push("/new")} primary>Create New Playlist</SimpleButton>
        {/if}
      </div>
    {:else}
      <div class="list-container">
        <div class="list-header" class:selection-active={selectedIds.size > 0}>
          <div class="header-left">
            <label class="check-cell">
              <input
                aria-label="Select all playlists"
                type="checkbox"
                bind:this={selectAllEl}
                checked={allSelected}
                onchange={toggleAll}
                title={allSelected ? "Deselect all" : "Select all"}
              />
            </label>
            <span class="select-label">
              {#if selectedIds.size > 0}
                {selectedIds.size} of {filteredPlaylists.length} selected
              {:else}
                {filteredPlaylists.length} playlist{filteredPlaylists.length !== 1 ? "s" : ""}
              {/if}
            </span>
            {#if selectedIds.size > 0}
              <SimpleButton onclick={() => (selectedIds = new Set())} secondary>
                <Fa icon={faXmark} fw /><span>Clear</span>
              </SimpleButton>
            {/if}
          </div>

          {#if selectedIds.size > 0}
            <div class="bulk-actions">
              <SimpleButton onclick={exportSelected} secondary>
                <Fa icon={faFileExport} fw /><span>Export</span>
              </SimpleButton>
              {#if canSaveOffline}
                <SimpleButton onclick={openSaveOffline} secondary>
                  <Fa icon={faCloudArrowDown} fw /><span>Save Offline</span>
                </SimpleButton>
              {/if}
              {#if canMerge}
                <SimpleButton
                  onclick={() => openMerge()}
                  secondary
                  disabled={!isMergeTypeCompatible}
                  title={isMergeTypeCompatible
                    ? "Merge selected playlists"
                    : "Cannot merge offline and synced playlists"}
                >
                  <Fa icon={faCodeMerge} fw /><span>Merge</span>
                </SimpleButton>
              {/if}
              {#if canMergeIntoFav}
                <SimpleButton
                  onclick={() => openMerge(favoritePlaylistId!)}
                  secondary
                  disabled={!isFavMergeTypeCompatible}
                  title={favMergeTitle}
                >
                  <Fa icon={faStar} fw /><span
                    >{favMergeTarget
                      ? `Merge into "${favMergeTarget.title.length > 20 ? favMergeTarget.title.slice(0, 18) + "…" : favMergeTarget.title}"`
                      : "Merge into Favorite"}</span
                  >
                </SimpleButton>
              {/if}
              <SimpleButton onclick={requestDelete} danger>
                <Fa icon={faTrash} fw /><span>Delete</span>
              </SimpleButton>
              {#if canChangePrivacy}
                <div class="privacy-dropdown">
                  <select
                    aria-label="Change privacy"
                    bind:value={newPrivacyStatus}
                    class="text-input privacy-select"
                    disabled={isPrivacyMixed}
                    title={isPrivacyMixed
                      ? "Cannot change privacy for mixed offline and YouTube playlists"
                      : ""}
                  >
                    <option value="" disabled>Change Privacy</option>
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                  <SimpleButton
                    onclick={executeChangePrivacy}
                    secondary
                    disabled={!newPrivacyStatus || isPrivacyMixed}
                    title={isPrivacyMixed
                      ? "Cannot change privacy for mixed offline and YouTube playlists"
                      : newPrivacyStatus
                        ? `Change ${selectedYoutubeCount} playlist${selectedYoutubeCount !== 1 ? "s" : ""} to ${newPrivacyStatus}`
                        : "Select privacy"}
                  >
                    <Fa
                      icon={newPrivacyStatus === "private"
                        ? faLock
                        : newPrivacyStatus === "unlisted"
                          ? faLockOpen
                          : faEarthAmericas}
                      fw
                    />
                    <span>Set</span>
                  </SimpleButton>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="playlist-list">
          {#each filteredPlaylists as p, index (p.id)}
            {#snippet contentSnippet()}
              <div
                class="thumb-container"
                role="button"
                tabindex="-1"
                onclick={() => editPlaylist(p.id)}
                onkeydown={(e) => (e.key === "Enter" || e.key === " ") && editPlaylist(p.id)}
              >
                {#if p.thumbnailUrl}
                  <img class="thumb" src={p.thumbnailUrl} alt="" loading="lazy" />
                {:else}
                  <div class="thumb thumb-empty">
                    <Fa icon={faBoxArchive} />
                  </div>
                {/if}
                <div class="thumb-overlay">
                  <Fa icon={faPencil} />
                </div>
              </div>
              <div
                class="row-content"
                class:fav-row={p.id === favoritePlaylistId}
                role="button"
                tabindex="-1"
                onclick={() => editPlaylist(p.id)}
                onkeydown={(e) => (e.key === "Enter" || e.key === " ") && editPlaylist(p.id)}
              >
                <div class="row-title-line">
                  <span class="row-title">{p.title || "Untitled Playlist"}</span>
                  {#if p.id === favoritePlaylistId}
                    <span
                      class="fav-badge"
                      title="Favorite Playlist"
                      aria-label="Favorite Playlist"
                    >
                      <Fa icon={faStar} fw />
                    </span>
                  {/if}
                </div>
                <div class="row-meta">
                  <span class="row-count">{p.videoCount} video{p.videoCount !== 1 ? "s" : ""}</span>
                  <SyncStatusIndicator
                    status={p.isLocal ? "local" : p.isTagged ? "synced" : "online"}
                    size="sm"
                  />
                  {#if !p.isLocal && p.privacyStatus}
                    <span class="badge privacy-{p.privacyStatus}">
                      {p.privacyStatus === "private"
                        ? "Private"
                        : p.privacyStatus === "unlisted"
                          ? "Unlisted"
                          : "Public"}
                    </span>
                  {/if}
                  {#if p.timestamp}
                    <span class="row-date">{new Date(p.timestamp).toLocaleDateString()}</span>
                  {/if}
                </div>
              </div>
            {/snippet}

            {#snippet actionsSnippet()}
              <a
                href="#/playlist?id={p.id}"
                class="action-btn"
                title="Edit"
                onclick={(e) => e.stopPropagation()}
              >
                <Fa icon={faPencil} />
              </a>
              {#if !p.isLocal}
                <button
                  class="action-btn"
                  title="Open on YouTube"
                  onclick={(e) => {
                    e.stopPropagation();
                    openOnYoutube(p.id);
                  }}
                >
                  <Fa icon={faArrowUpRightFromSquare} />
                </button>
                <button
                  class="action-btn"
                  title="Save offline"
                  onclick={(e) => {
                    e.stopPropagation();
                    saveOfflineSingle(p.id);
                  }}
                >
                  <Fa icon={faCloudArrowDown} />
                </button>
              {/if}
              <button
                class="action-btn delete"
                title="Delete"
                onclick={(e) => {
                  e.stopPropagation();
                  executeSingleDelete(p);
                }}
              >
                <Fa icon={faTrash} />
              </button>
            {/snippet}

            <ListRow
              selected={selectedIds.has(p.id)}
              dragging={draggingIndex === index}
              dragOver={dragOverIndex === index}
              draggable={true}
              selectable={true}
              {index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onclick={() => toggleOne(p.id)}
              onSelect={() => toggleOne(p.id)}
              content={contentSnippet}
              actions={actionsSnippet}
            />
          {/each}
        </div>
      </div>
    {/if}
  </div>
</main>

<input
  aria-label="Import playlists JSON file"
  id="ManageImportInput"
  type="file"
  accept=".json"
  style="display:none"
/>

<style>
  .search-sort-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 280px;
  }

  :global(.search-icon) {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  /* .search-box input removed (unused) */
  /* .search-box input:focus removed (unused) */

  .clear-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .clear-btn:hover {
    background: var(--hover-color);
    color: var(--text-color);
  }

  .sort-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-secondary);
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    height: 42px;
  }

  /* .sort-box select removed (unused) */

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    text-align: center;
    color: var(--text-muted);
    gap: 16px;
    background: var(--hover-color);
    border-radius: 16px;
    border: 2px dashed var(--border-color);
  }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  .list-container {
    border: 1px solid var(--border-color);
    border-radius: 16px;
    overflow: hidden;
    background: var(--background-color);
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    background: var(--hover-color);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 90;
    transition: background 0.2s;
  }

  .list-header.selection-active {
    background: var(--active-bg-color);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .select-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }

  .bulk-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .playlist-list {
    display: flex;
    flex-direction: column;
  }

  .thumb-container {
    position: relative;
    width: 100px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a1a;
  }

  .thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--border-color);
    color: var(--text-muted);
  }

  .thumb-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .thumb-container:hover .thumb-overlay {
    opacity: 1;
  }

  .row-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .row-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-title-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .fav-row {
    box-shadow: -3px 0 0 #ffc107;
    padding-left: 6px;
  }

  .fav-badge {
    display: inline-flex;
    align-items: center;
    color: #ffc107;
    font-size: 14px;
    flex-shrink: 0;
    pointer-events: none;
  }

  .row-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .row-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    padding: 8px;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--border-color);
    color: var(--text-color);
  }

  .action-btn.delete:hover {
    background: rgba(244, 67, 54, 0.1);
    color: #f44336;
  }

  /* Dialogs */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    backdrop-filter: blur(8px);
  }

  .dialog {
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 32px;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .prog-dialog {
    background: rgba(var(--background-color-rgb), 0.8);
  }

  .dialog-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-color);
  }

  .dialog-msg {
    margin: 0;
    font-size: 15px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .dialog-info {
    font-size: 14px;
    color: var(--primary-color);
    background: rgba(62, 166, 255, 0.1);
    padding: 12px 16px;
    border-radius: 10px;
    font-weight: 500;
  }

  .dialog-error {
    margin: 0;
    font-size: 14px;
    color: #f44336;
    padding: 12px;
    background: rgba(244, 67, 54, 0.1);
    border-radius: 10px;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }

  .prog-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .prog-track {
    height: 10px;
    border-radius: 5px;
    background: var(--border-color);
    overflow: hidden;
  }

  .prog-fill {
    height: 100%;
    width: 100%;
    background: var(--primary-color);
    transform-origin: left;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .prog-meta {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }

  .text-input {
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--hover-color);
    color: var(--text-color);
    font-size: 15px;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }

  .text-input:focus,
  .text-input:focus-visible {
    outline: none;
    border-color: var(--primary-color);
    background: var(--background-color);
  }

  .check-label {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    cursor: pointer;
    color: var(--text-color);
    user-select: none;
  }

  @media (max-width: 768px) {
    .list-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .bulk-actions {
      width: 100%;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .row-actions {
      opacity: 1;
    }

    .thumb-container {
      width: 80px;
      height: 45px;
    }
  }

  /* Save Offline Dialog */
  .offline-playlist-list {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 16px 0;
  }

  .offline-playlist-item {
    background: var(--hover-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
  }

  .offline-playlist-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .offline-playlist-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color);
  }

  .offline-playlist-meta {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .offline-playlist-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--text-color);
    cursor: pointer;
  }

  .radio-label input[type="radio"] {
    accent-color: var(--primary-color);
  }

  .offline-title-input {
    margin-left: 24px;
    margin-top: 4px;
  }

  .dialog-info:has(+ .offline-playlist-list) {
    margin-bottom: 0;
  }

  /* Privacy badges */
  .badge.privacy-private {
    background: rgba(255, 152, 0, 0.15);
    color: #ff9800;
  }

  .badge.privacy-unlisted {
    background: rgba(158, 158, 158, 0.15);
    color: #9e9e9e;
  }

  .badge.privacy-public {
    background: rgba(76, 175, 80, 0.15);
    color: #4caf50;
  }

  /* Privacy dropdown in bulk actions */
  .privacy-dropdown {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .privacy-select {
    width: auto;
    min-width: 120px;
    padding: 8px 12px;
    font-size: 14px;
  }
</style>
