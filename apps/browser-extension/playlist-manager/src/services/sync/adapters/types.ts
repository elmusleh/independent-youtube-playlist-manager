import type { RelayRecord } from "../relay-transport";

export type SyncCollection = "playlists" | "history" | "settings" | "devices";

/** A candidate is acknowledged locally only after its matching relay result is `ok`. */
export type DirtyCandidate = {
  record: RelayRecord;
  collection: SyncCollection;
  recordId: string;
  value: unknown;
  version: number;
  deleted: boolean;
};
