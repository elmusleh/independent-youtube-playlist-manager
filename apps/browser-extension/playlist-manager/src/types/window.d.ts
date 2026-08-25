import type { Playlist, Settings } from "./model.js";

declare global {
  interface Window {
    // SPA navigation guard flags
    _storageServiceLoaded?: boolean;
    _youtubeApiLoaded?: boolean;
    _syncServiceLoaded?: boolean;
    _utilsLoaded?: boolean;
    _syncStateServiceLoaded?: boolean;

    // Auth state flags
    _isSignedIn?: boolean;
    _youtubeAuthLoading?: boolean;
    _watchLaterId?: string;

    // Cross-browser extension API
    browser?: typeof browser;
    chrome?: typeof browser;

    // ytFetch exposed on window
    ytFetch: (path: string, options?: RequestInit) => Promise<unknown>;

    // SyncService class instance
    SyncService: {
      syncPlaylist: (playlistId: string) => Promise<void>;
      refreshAllManaged: () => Promise<void>;
      syncAllDirty: () => Promise<void>;
      isSyncing: () => boolean;
    };

    // Supabase sync engine
    syncEngine?: {
      triggerSync(): Promise<{
        success: boolean;
        pushed: number;
        pulled: number;
        error?: string;
      }>;
    };
    supabaseGetSession?: () => Promise<{ user?: { id: string } } | null>;

    // System logger singleton
    SystemLogger?: {
      info(module: string, action: string, details?: unknown): Promise<void>;
      warn(module: string, action: string, details?: unknown): Promise<void>;
      error(module: string, action: string, details?: unknown): Promise<void>;
    };

    // Dev-only log level
    LOG_LEVEL?: string;

    // File System Access API
    showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
  }
}

export {};
