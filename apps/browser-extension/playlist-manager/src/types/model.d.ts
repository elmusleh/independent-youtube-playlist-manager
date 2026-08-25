export interface Video {
  id: string | number;
  videoId: string;
  url: string;
  title: string;
  channel: string;
  thumbnailUrl?: string | null;
  duration?: string; // ISO 8601 (e.g. "PT4M20S"); absent = not fetched
  durationISO?: string; // ISO 8601 duration (alias for duration)
  durationSeconds?: number; // total absolute length in seconds
  progress?: number; // watched progress in seconds
  viewCount?: number;
  publishedAt?: string; // ISO 8601 date string
  isPrivate?: boolean;
  isDeleted?: boolean;
  isBroken?: boolean;
  isLive?: boolean;
}

export interface NormalizedVideoMeta {
  videoId: string;
  title: string;
  channel: string;
  durationISO: string;
  durationSeconds: number;
  viewCount?: number;
  publishedAt?: string;
  isPrivate: boolean;
  isDeleted: boolean;
  isBroken: boolean;
  isLive: boolean;
  lastCachedAt: number;
  lastFetchAttempt?: number;
}

export interface VideoMetaExport {
  title: string;
  channel: string;
  durationISO: string;
  durationSeconds?: number;
  viewCount?: number;
  publishedAt?: string;
  isPrivate?: boolean;
  isDeleted?: boolean;
  isBroken?: boolean;
  isLive?: boolean;
}

export interface PlaylistExport {
  title: string;
  videos: string[];
  timestamp: number;
  metadata?: Record<string, VideoMetaExport>;
}

export interface CompleteBackupFile {
  format: "yph_full_backup";
  schemaVersion: number;
  exportedAt: string;
  metadata: {
    appVersion: string;
    totalPlaylists: number;
    totalVideos: number;
    totalMetadataEntries: number;
    totalHistoryEntries: number;
  };
  data: {
    settings: Settings;
    playlists: Playlist[];
    videoMetadata: Record<string, NormalizedVideoMeta>;
    history: Record<string, any>;
    syncSnapshots?: Record<string, string[]>;
  };
}

export interface ImportResult {
  success: boolean;
  importedPlaylists: number;
  importedMetadata: number;
  importedHistory: number;
  mode: "merge" | "overwrite";
  errors: string[];
}

export interface Playlist {
  id: string;
  title: string;
  loadedVideos?: Video[];
  videos: string[];
  /** Date created */
  timestamp: number;
  saved?: boolean;
  isLocal?: boolean;
  isTagged?: boolean;
  isDirty?: boolean;
  /** If true, videos won't be auto-deleted after watching */
  isPermanent?: boolean;
}

export interface Settings {
  [id: string]: any;
  openPlaylistEditorAfterCreation: boolean;
  openPlaylistPage: boolean;
  closeAddedTabs: boolean;
  disableThumbnails: boolean;
  openPlaylistBuilderAfterAdd: boolean;
  openSavedPlaylistAfterAdd: boolean;
  defaultEditorPage: "/new" | "/saved";
  saveCreatedPlaylists: boolean;
  disableContextBuilder: boolean;
  disableContextSaved: boolean;
  themeChoice: ThemeChoice;
  defaultPageSize: number;
  cacheDuration: number; // in minutes, -1 for no expiration
  watchLaterPlaylistId: string | null; // custom playlist ID to use instead of YouTube's Watch Later
  maxLogLines: number;
  defaultPrivacy: "private" | "unlisted" | "public";
  autoRemoveDuplicates: boolean;
  autoDeleteEmptyPlaylists: boolean;
  addToLatestPosition: "top" | "bottom";
  defaultQuickAddTarget: "favorite" | "latest" | "create";
  defaultTabScope:
    | "current"
    | "left"
    | "right"
    | "all-this-window-include"
    | "all-this-window-exclude"
    | "all-windows";
  manageSortBy: string;
  deleteAfterMerge: boolean;
  ruleEnabled: boolean;
  ruleTrackPause: boolean;
  ruleTrackUnload: boolean;
  ruleAutoDelete: boolean;
  ruleCompletionThreshold: number;
  ruleHistoryRetentionDays: number;
  ruleHistoryThrottleMs: number; // Minimum time between saves in milliseconds (default: 5000)
  ruleHistoryDebounceMs: number; // Delay before saving after pause/unload in milliseconds (default: 1000)
  ruleTrackDuringPlayback: boolean; // Enable periodic position saves during active playback (default: false)
  playAllChunkEnabled: boolean; // true = split into multiple tabs, false = single tab
  playAllChunkSize: number; // max videos per tab when chunking is enabled
  enableLikedVideos: boolean;
  enableUploadedVideos: boolean;
  enableSubscriptions: boolean;
  enableActivities: boolean;
  enableSearch: boolean;
  enableComments: boolean;
  enableAccountPlaylists: boolean;
  enableWatchLater: boolean;
  enableOpenById: boolean;
  enableMyChannel: boolean;
  autoSaveEditor: boolean;
  autoSaveInterval: number; // in seconds
  autoRetryEnabled: boolean; // Auto-retry sync after quota reset (default: true)
  autoFetchMetadata: boolean; // Auto-fetch missing metadata on page load (default: false)
  metadataExecutionStrategy: "free_first" | "api_first"; // default: "free_first"
  enableInnertubeScraping: boolean; // default: true
  enableEmbedScraping: boolean; // default: true
  enableOEmbedScraping: boolean; // default: true
  enableInvidiousPiped: boolean; // default: true
  customInvidiousInstances: string; // custom URLs separated by comma/newline
  customPipedInstances: string; // custom URLs separated by comma/newline
}

export type SyncStatus = "synced" | "pending" | "deleted";

export interface SyncRecord<T> {
  id: string;
  data: T;
  syncStatus: SyncStatus;
  updatedAt: string;
  version?: number;
}

export interface CatalogVideo {
  video_id: string;
  title: string;
  channel: string;
  duration_iso: string;
  duration_seconds: number;
  view_count?: number;
  published_at?: string;
  is_live?: boolean;
  is_private?: boolean;
  is_deleted?: boolean;
  thumbnail_url?: string;
  created_at?: string;
  updated_at?: string;
}

export type PlaylistsSorting = "date-created-asc" | "date-created-desc" | "title-az" | "title-za";

export type Theme = "light" | "dark";
export type ThemeChoice = "device" | Theme;
