import type {
  MutateOperation,
  MutateResult,
  Settings,
  Playlist,
} from "../../../apps/browser-extension/shared/protocol-contracts.js";
declare global {
  var yphMutateLibrary: ((operation: MutateOperation) => Promise<MutateResult>) | undefined;
  interface Window {
    getSettings(): Promise<Settings>;
    getPlaylists(): Promise<Playlist[]>;
    storeObject(key: string, value: unknown): Promise<void>;
    isSignedIn(): Promise<boolean>;
    ytGetPlaylistItems(id: string): Promise<{ videoId: string }[]>;
    ytAddVideo(id: string, videoId: string, position?: number): Promise<void>;
    invalidatePlaylistCache?: () => void;
  }
}
