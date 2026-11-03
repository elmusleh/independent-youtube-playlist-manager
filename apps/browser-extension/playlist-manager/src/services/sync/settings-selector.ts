/**
 * Only actual user preferences may travel in the sync snapshot's settings category.
 * `getSettings()` merges browser.storage.local and browser.storage.sync, so copying it
 * wholesale can include sync credentials, tokens, history, and unrelated local state.
 */
export const SYNCABLE_SETTING_KEYS = [
  "openPlaylistEditorAfterCreation",
  "openPlaylistPage",
  "closeAddedTabs",
  "disableThumbnails",
  "openPlaylistBuilderAfterAdd",
  "openSavedPlaylistAfterAdd",
  "defaultEditorPage",
  "saveCreatedPlaylists",
  "disableContextMenu",
  "contextMenuDestination",
  "disableContextBuilder",
  "disableContextSaved",
  "themeChoice",
  "defaultPageSize",
  "playlistsPerPage",
  "cacheDuration",
  "watchLaterPlaylistId",
  "favoritePlaylistIds",
  "maxVisibleFavorites",
  "maxLogLines",
  "defaultPrivacy",
  "autoRemoveDuplicates",
  "autoDeleteEmptyPlaylists",
  "addToLatestPosition",
  "defaultQuickAddTarget",
  "defaultTabScope",
  "manageSortBy",
  "deleteAfterMerge",
  "ruleEnabled",
  "ruleTrackPause",
  "ruleTrackUnload",
  "ruleAutoDelete",
  "ruleCompletionThreshold",
  "ruleHistoryRetentionDays",
  "ruleHistoryThrottleMs",
  "ruleHistoryDebounceMs",
  "ruleTrackDuringPlayback",
  "playAllChunkEnabled",
  "playAllChunkSize",
  "enableLikedVideos",
  "enableUploadedVideos",
  "enableSubscriptions",
  "enableActivities",
  "enableSearch",
  "enableComments",
  "enableAccountPlaylists",
  "enableWatchLater",
  "enableOpenById",
  "enableMyChannel",
  "autoSaveEditor",
  "autoSaveInterval",
  "autoRetryEnabled",
  "autoFetchMetadata",
  "metadataExecutionStrategy",
  "enableInnertubeScraping",
  "enableEmbedScraping",
  "enableOEmbedScraping",
  "enableInvidiousPiped",
  "customInvidiousInstances",
  "customPipedInstances",
] as const;

const syncableSettingKeys = new Set<string>(SYNCABLE_SETTING_KEYS);

/** Pick only known preferences from local or remote settings data. */
export function selectSyncableSettings(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  const settings: Record<string, unknown> = {};
  for (const key of syncableSettingKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) settings[key] = source[key];
  }
  return settings;
}
