/** Authored protocol source. API declarations are generated from checked JS/JSDoc. */
import type { Playlist, Settings, Video, SortRule } from "../playlist-manager/src/types/model.js";
export type { Playlist, Settings, Video, SortRule };
export type VideoId = string;
export type VideoMeta = Video;
export type TabScope = "current" | "selected" | "left" | "right" | "window" | "other" | "all";
export type Position = "top" | "bottom";
type Receipt = { receipt?: string };
export type PutOperation = Receipt & { type: "put"; playlist: Playlist; expectedRevision: number };
export type AppendOperation = Receipt & {
  type: "append";
  id?: string;
  ids: string[];
  create?: boolean;
  title?: string;
  position?: Position;
};
export type ReplaceOperation = Receipt & {
  type: "replace";
  playlists: Playlist[];
  expectedRevision: number;
};
export type DeleteOperation = Receipt & { type: "delete"; id: string; expectedRevision: number };
export type BuilderOperation = Receipt &
  (
    | { type: "builder-append"; ids: string[]; position?: Position }
    | { type: "builder-consume"; ids: string[] }
    | { type: "builder-replace"; ids: string[]; expectedRevision: number }
  );
export type WatchedOperation = Receipt & { type: "remove-watched"; id: string; videoId: string };
export type MutateOperation =
  | PutOperation
  | AppendOperation
  | ReplaceOperation
  | DeleteOperation
  | BuilderOperation
  | WatchedOperation;
export interface PutResult {
  id: string;
  revision: number;
}
export interface AppendResult extends PutResult {
  addedIds: string[];
  duplicates: number;
}
export interface BuilderResult {
  id: "builder";
  total: number;
  addedIds: string[];
  duplicates: number;
}
export type MutateResult =
  | PutResult
  | AppendResult
  | BuilderResult
  | { revision: number }
  | { id: string }
  | { removed: boolean };
export type MessageResponse<T> = { ok: true; result: T } | { ok: false; error: string };
export interface LibrarySnapshot {
  playlists: Playlist[];
  revision: number;
}
export interface SourceAnchor {
  id: number;
  url: string;
  windowId: number;
  index?: number;
  highlighted?: boolean;
  incognito?: boolean;
}
export interface TabSnapshot extends SourceAnchor {
  pinned?: boolean;
}
export type CaptureOperation = "capture" | "import" | "destination";
export type CaptureSource = "menu" | "popup";
export type CaptureStatus = "ready" | "scanning" | "saving" | "complete" | "failed" | "cancelled";
export interface CaptureResult {
  id: string;
  revision?: number;
  addedIds: string[];
  duplicates: number;
  added: number;
  skipped: number;
  failed: number;
  jobId: string;
}
export interface CaptureJob {
  id: string;
  expires: number;
  status: CaptureStatus;
  operation: CaptureOperation;
  source: CaptureSource;
  ids: string[];
  tabs: TabSnapshot[];
  sourceTab: SourceAnchor | null;
  mode: string;
  position: Position;
  closeTabs: boolean;
  addedIds: string[];
  inFlight: string | null;
  error: string;
  title?: string;
  canScroll?: boolean;
  destinationId?: string;
  requestedId?: string;
  skipped?: number;
  result?: CaptureResult | { id: string };
}
export type CreateJobInput = Pick<CaptureJob, "operation" | "source"> &
  Partial<
    Pick<
      CaptureJob,
      | "ids"
      | "tabs"
      | "sourceTab"
      | "mode"
      | "position"
      | "closeTabs"
      | "title"
      | "canScroll"
      | "skipped"
    >
  >;
export interface StartCaptureOptions {
  scope?: string;
  anchor?: SourceAnchor;
  ids?: string[];
  mode?: string;
  source?: CaptureSource;
  operation?: "capture" | "import";
  review?: boolean;
  title?: string;
}
export type StartCaptureResult = CaptureResult | { review: true; jobId: string };
export interface CommitOptions {
  quantity?: number;
  order?: "newest" | "oldest";
  title?: string;
}
