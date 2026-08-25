interface Window {
  videoIdCount: number;
  youtubeRegexPattern: string;
  videoService: import("../services/video-service").VideoService;
}

/**
 * youtube-auth
 */

interface Window {
  getYouTubeToken: () => Promise<string>;
  revokeYouTubeToken: () => Promise<void>;
  isSignedIn: () => Promise<boolean>;
  signIn: () => Promise<string>;
}

/**
 * youtube-api
 */

interface YtPlaylistInfo {
  id: string;
  title: string;
  timestamp: number;
  isTagged?: boolean;
  privacyStatus?: "private" | "unlisted" | "public";
}

interface YtPlaylistInfoExtended extends YtPlaylistInfo {
  videoCount: number;
  isTagged: boolean;
  isLocal?: boolean;
  thumbnailUrl?: string | null;
  category?: string;
  privacyStatus?: "private" | "unlisted" | "public";
}

interface YtPlaylistItem {
  videoId: string;
  itemId: string;
  title?: string;
  channel?: string;
  channelId?: string;
  publishedAt?: string;
}

interface Window {
  // Playlist endpoints
  ytCreatePlaylist: (
    title: string,
    privacyStatus?: "private" | "unlisted" | "public"
  ) => Promise<string>;
  ytUpdatePlaylist: (ytId: string, title: string) => Promise<void>;
  ytUpdatePlaylistPrivacy: (
    ytId: string,
    privacyStatus: "private" | "unlisted" | "public"
  ) => Promise<void>;
  ytDeletePlaylist: (ytId: string) => Promise<void>;
  ytListPlaylists: () => Promise<YtPlaylistInfo[]>;
  ytListAllPlaylists: () => Promise<YtPlaylistInfoExtended[]>;
  ytGetPlaylist: (id: string) => Promise<YtPlaylistInfo | null>;
  ytGetPlaylistItems: (ytId: string) => Promise<YtPlaylistItem[]>;
  ytAddVideo: (ytId: string, videoId: string, position?: number) => Promise<void>;
  ytRemoveItem: (itemId: string) => Promise<void>;
  ytMoveItem: (
    itemId: string,
    playlistId: string,
    videoId: string,
    position: number
  ) => Promise<void>;

  // Channel & System Playlists
  ytGetMyChannel: () => Promise<{ title: string; thumbnail: string; handle: string }>;
  ytGetWatchLaterPlaylistId: () => Promise<string | null>;
  ytGetLikedVideosPlaylistId: () => Promise<string | null>;
  ytGetUploadedVideosPlaylistId: () => Promise<string | null>;

  // Data fetching (new endpoints)
  ytGetLikedVideos: () => Promise<YtPlaylistItem[]>;
  ytGetUploadedVideos: () => Promise<YtPlaylistItem[]>;
  ytListSubscriptions: () => Promise<{ channelId: string; title: string; thumbnail: string }[]>;
  ytListActivities: (
    maxResults?: number
  ) => Promise<
    { type: string; title: string; videoId?: string; channelId: string; timestamp: string }[]
  >;
  ytSearch: (
    query: string,
    maxResults?: number
  ) => Promise<
    {
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnail: string;
      publishedAt: string;
    }[]
  >;
  ytListComments: (maxResults?: number) => Promise<
    {
      id: string;
      textDisplay: string;
      videoId: string;
      authorDisplayName: string;
      publishedAt: string;
    }[]
  >;

  // Video metadata
  ytFetchVideoDurations: (videoIds: string[]) => Promise<Map<string, any>>;
  clearMetadataSessionCache: (ids?: string[]) => void;

  // User profile
  saveUserProfile: (profile: { title: string; thumbnail: string; handle: string }) => Promise<void>;
  getUserProfile: () => Promise<{ title: string; thumbnail: string; handle?: string } | null>;
}

/**
 * storage-service
 */

type GetSettings = () => Promise<Settings>;
type StoreObject = (id: string, obj: any) => Promise<void>;
type RemoveObject = (id: string) => Promise<void>;
type FetchObject = <T>(id: string, defaultValue: T) => Promise<T>;
type FetchAllObjects = () => Promise<{ [key: string]: any }>;
type GeneratePlaylistId = () => Promise<string>;
type GeneratePlaylistIds = (size: number) => Promise<string[]>;
type ImportPlaylists = (playlistsExport: PlaylistExport[]) => Promise<void>;
type RemoveSavedPlaylists = () => Promise<void>;
type SavePlaylist = (
  playlist: Playlist,
  options?: { syncToYoutube?: boolean; resumeFromState?: SyncState }
) => Promise<string>;
type RemovePlaylist = (playlist: Playlist) => Promise<void>;
type GetPlaylists = () => Promise<Playlist[]>;
type GetLocalPlaylists = () => Promise<Playlist[]>;
type GetPlaylist = (id: string) => Promise<Playlist>;
type GetAccountPlaylists = () => Promise<YtPlaylistInfoExtended[]>;
type GetAccountSubscriptions = () => Promise<
  { channelId: string; title: string; thumbnail: string }[]
>;
type GetAccountActivities = (maxResults?: number) => Promise<
  {
    type: string;
    title: string;
    videoId?: string;
    channelId: string;
    timestamp: string;
  }[]
>;
type GetAccountComments = (maxResults?: number) => Promise<
  {
    id: string;
    textDisplay: string;
    videoId: string;
    authorDisplayName: string;
    publishedAt: string;
  }[]
>;
type YoutubeSearch = (
  query: string,
  maxResults?: number
) => Promise<
  {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    publishedAt: string;
  }[]
>;
type AdoptPlaylist = (ytId: string) => Promise<void>;
type YtGetMyChannel = () => Promise<{ title: string; thumbnail: string }>;

interface Window {
  getSettings: GetSettings;
  fetchObject: FetchObject;
  fetchAllObjects: FetchAllObjects;
  storeObject: StoreObject;
  removeObject: RemoveObject;
  generatePlaylistId: GeneratePlaylistId;
  generatePlaylistIds: GeneratePlaylistIds;
  importPlaylists: ImportPlaylists;
  removeSavedPlaylists: RemoveSavedPlaylists;
  removePlaylist: RemovePlaylist;
  removePlaylists: (playlists: Playlist[]) => Promise<void>;
  savePlaylist: SavePlaylist;
  getPlaylist: GetPlaylist;
  getPlaylists: GetPlaylists;
  getLocalPlaylists: GetLocalPlaylists;
  getAccountPlaylists: GetAccountPlaylists;
  getAccountSubscriptions: GetAccountSubscriptions;
  getAccountActivities: GetAccountActivities;
  getAccountComments: GetAccountComments;
  youtubeSearch: YoutubeSearch;
  adoptPlaylist: AdoptPlaylist;

  ytGetMyChannel: YtGetMyChannel;
  ytAddVideo: (ytId: string, videoId: string, position?: number) => Promise<void>;
  ytRemoveItem: (itemId: string) => Promise<void>;
  ytMoveItem: (
    itemId: string,
    playlistId: string,
    videoId: string,
    position: number
  ) => Promise<void>;
  ytGetWatchLaterPlaylistId: () => Promise<string | null>;
  ytGetLikedVideosPlaylistId: () => Promise<string | null>;
  ytGetUploadedVideosPlaylistId: () => Promise<string | null>;
  ytGetLikedVideos: () => Promise<YtPlaylistItem[]>;
  ytGetUploadedVideos: () => Promise<YtPlaylistItem[]>;
  ytListSubscriptions: () => Promise<{ channelId: string; title: string; thumbnail: string }[]>;
  ytListActivities: (
    maxResults?: number
  ) => Promise<
    { type: string; title: string; videoId?: string; channelId: string; timestamp: string }[]
  >;
  ytFetchVideoDurations: (videoIds: string[]) => Promise<Map<string, any>>;
  fetchVideoMetadataInvidious: (
    videoId: string,
    customPiped?: string[],
    customInvidious?: string[]
  ) => Promise<{
    title: string;
    channel: string;
    duration: string;
    lengthSeconds: number;
    viewCount?: number;
    publishedAt?: string;
    isPrivate?: boolean;
    isDeleted?: boolean;
    isBroken?: boolean;
    isLive?: boolean;
  } | null>;
  fetchDurationsInvidious: (
    videoIds: string[],
    customPiped?: string[],
    customInvidious?: string[]
  ) => Promise<Map<string, any>>;
  fetchVideoMetadataEmbedPage: (videoId: string) => Promise<{
    title: string;
    channel: string;
    duration: string;
    lengthSeconds: number;
    viewCount?: number;
    publishedAt?: string;
    isPrivate?: boolean;
    isDeleted?: boolean;
    isBroken?: boolean;
    isLive?: boolean;
  } | null>;
  fetchVideoMetadataOEmbed: (videoId: string) => Promise<{
    title: string;
    channel: string;
    duration: string;
    lengthSeconds: number;
    viewCount?: number;
    publishedAt?: string;
    isPrivate?: boolean;
    isDeleted?: boolean;
    isBroken?: boolean;
    isLive?: boolean;
  } | null>;
  fetchVideoMetadataInnertube: (videoId: string) => Promise<{
    title: string;
    channel: string;
    duration: string;
    lengthSeconds: number;
    viewCount?: number;
    publishedAt?: string;
    isPrivate?: boolean;
    isDeleted?: boolean;
    isBroken?: boolean;
    isLive?: boolean;
  } | null>;
  fetchMetadataInnertube: (videoIds: string[]) => Promise<Map<string, any>>;
  saveUserProfile: (profile: { title: string; thumbnail: string }) => Promise<void>;
  getUserProfile: () => Promise<{ title: string; thumbnail: string } | null>;
  ensureWatchLaterPlaylist: (
    forceCreate?: boolean
  ) => Promise<{ id: string | null; recreated: boolean }>;
  invalidatePlaylistCache: () => void;
  invalidateCacheAndNotify: () => void;
  _saveToLocalStorage: (playlist: Playlist) => Promise<void>;
  saveSyncSnapshot: (id: string, videos: string[]) => Promise<void>;
  getSyncSnapshot: (id: string) => Promise<string[]>;
  getMetadataCacheCount: () => Promise<number>;
  clearAllMetadataCache: () => Promise<void>;
}

/**
 * utils
 */

interface Window {
  success: (msg: string) => () => void;
  error: (msg: string) => () => void;
  info: (msg: string) => () => void;
  logSystemEvent: (
    level: "INFO" | "ERROR" | "WARN",
    message: string,
    details?: any
  ) => Promise<void>;
  secsToISO: (secs: number) => string;
  isoToSecs: (iso: string) => number;
}

/**
 * sync-state-service
 */

interface SyncState {
  localPlaylistId: string;
  remotePlaylistId: string;
  playlistTitle: string;
  totalVideos: number;
  syncedVideoIds: string[];
  remainingVideoIds: string[];
  privacyStatus: "private" | "unlisted" | "public";
  startedAt: number;
  lastAttemptAt: number;
  error?: string;
  autoRetryEnabled: boolean;
  retryCount: number;
}

interface Window {
  saveSyncState: (state: SyncState) => Promise<void>;
  getSyncState: (localPlaylistId: string) => Promise<SyncState | null>;
  clearSyncState: (localPlaylistId: string) => Promise<void>;
  getAllPendingSyncs: () => Promise<SyncState[]>;
  isAutoRetryScheduled: (localPlaylistId: string) => Promise<boolean>;
  cancelAutoRetry: (localPlaylistId: string) => Promise<void>;
  scheduleAutoRetry: (localPlaylistId: string) => Promise<void>;
  initializeSyncState: (
    localPlaylistId: string,
    playlistTitle: string,
    allVideoIds: string[],
    privacyStatus?: "private" | "unlisted" | "public",
    remotePlaylistId?: string
  ) => Promise<SyncState>;
  updateSyncProgress: (localPlaylistId: string, newlySyncedVideoIds: string[]) => Promise<void>;
  isSyncComplete: (localPlaylistId: string) => Promise<boolean>;
}
