import { logger } from "./logger";
import type { Playlist } from "../types/model";

const browser = window.browser || window.chrome;

export interface PlaylistDataCallbacks {
  onSignedInChange: (signedIn: boolean) => void;
  onLocalPlaylistsChange: (playlists: Playlist[]) => void;
  onAccountPlaylistsChange: (playlists: (YtPlaylistInfoExtended & { category: string })[]) => void;
  onLikedPlaylistChange: (playlist: (YtPlaylistInfoExtended & { category: string }) | null) => void;
  onUploadedPlaylistChange: (
    playlist: (YtPlaylistInfoExtended & { category: string }) | null
  ) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
  getSignedIn: () => boolean;
}

let _debounce: ReturnType<typeof setTimeout> | null = null;
let _isLoadingPlaylists = false;

export function createStorageListener(callbacks: PlaylistDataCallbacks) {
  function handleStorageChange(
    changes: Record<string, { oldValue?: any; newValue?: any }>,
    area: string
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
        ytPlaylistsLoader(callbacks);
      }
    }

    if (area !== "local") return;

    if ("yt_auth_token_cache" in changes) {
      const wasSignedIn = callbacks.getSignedIn();
      const signedIn = changes["yt_auth_token_cache"].newValue != null;
      callbacks.onSignedInChange(signedIn);
      if (signedIn && !wasSignedIn) ytPlaylistsLoader(callbacks);
      else if (!signedIn && wasSignedIn) {
        callbacks.onAccountPlaylistsChange([]);
        loadLocal(callbacks);
      }
      return;
    }

    if ("yt_playlist_cache_v1" in changes) {
      if (changes["yt_playlist_cache_v1"].newValue !== undefined) return;
      if (_debounce) clearTimeout(_debounce);
      _debounce = setTimeout(() => {
        _debounce = null;
        if (callbacks.getSignedIn()) ytPlaylistsLoader(callbacks);
        else loadLocal(callbacks);
      }, 2000);
    }
  }

  browser.storage.onChanged.addListener(handleStorageChange);
  return () => {
    browser.storage.onChanged.removeListener(handleStorageChange);
    if (_debounce) {
      clearTimeout(_debounce);
      _debounce = null;
    }
  };
}

export async function loadLocal(callbacks: PlaylistDataCallbacks) {
  try {
    const localPlaylists = await window.getLocalPlaylists();
    callbacks.onLocalPlaylistsChange(localPlaylists);
  } catch (e) {
    logger.error("Failed to load local playlists", e);
  }
}

export async function checkAuth(callbacks: PlaylistDataCallbacks) {
  try {
    const status = await window.isSignedIn();
    if (status !== callbacks.getSignedIn()) {
      callbacks.onSignedInChange(status);
      if (status) {
        await ytPlaylistsLoader(callbacks);
      }
    }
  } catch (e) {
    logger.error("Auth check failed", e);
  }
}

export async function init(callbacks: PlaylistDataCallbacks) {
  await loadLocal(callbacks);
  await checkAuth(callbacks);
  if (callbacks.getSignedIn()) {
    await ytPlaylistsLoader(callbacks);
  } else {
    callbacks.onLoadingChange(false);
  }
}

export async function ytPlaylistsLoader(callbacks: PlaylistDataCallbacks) {
  if (_isLoadingPlaylists) return;
  _isLoadingPlaylists = true;

  const dismiss = window.info("Refreshing playlists...");
  callbacks.onLoadingChange(true);
  try {
    const allPlaylistsResult = await window.getAccountPlaylists();

    const youtubeTaggedPlaylists = allPlaylistsResult.filter(
      (p: YtPlaylistInfoExtended) =>
        !p.isLocal &&
        !p.id.startsWith("local-") &&
        p.id !== "LIKED" &&
        p.id !== "UPLOADS" &&
        p.id !== "WL"
    );

    const allAccountPlaylists = youtubeTaggedPlaylists;

    let likedPlaylist = null;
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
        };
        callbacks.onLikedPlaylistChange(likedPlaylist);
      }
    } catch (e) {
      logger.error("Failed to load Liked Videos:", e);
    }

    let uploadedPlaylist = null;
    try {
      const uploadedInfo = await window.ytGetPlaylist("UPLOADS");
      if (uploadedInfo) {
        const uploadedItems = await window.ytGetPlaylistItems("UPLOADS");
        uploadedPlaylist = {
          ...uploadedInfo,
          videoCount: uploadedItems.length,
          isTagged: false,
          isLocal: false,
          category: "uploaded",
        };
        callbacks.onUploadedPlaylistChange(uploadedPlaylist);
      }
    } catch (e) {
      logger.error("Failed to load Uploaded Videos:", e);
    }

    const taggedIds = new Set(youtubeTaggedPlaylists.map((p) => p.id));
    const accountPlaylists = [
      ...youtubeTaggedPlaylists.map((p) => ({ ...p, category: "youtube" })),
      ...allAccountPlaylists
        .filter((p) => !taggedIds.has(p.id))
        .map((p) => ({ ...p, category: "account", isLocal: false })),
    ];
    callbacks.onAccountPlaylistsChange(accountPlaylists);
  } catch (e) {
    logger.error("Failed to load playlists:", e);
    if (callbacks.getSignedIn()) {
      window.error("Failed to sync with YouTube - showing cached playlists");
    }
  } finally {
    callbacks.onLoadingChange(false);
    _isLoadingPlaylists = false;
    if (dismiss) dismiss();
  }
}
