/** Compiler-only fixtures: no imports below execute during verification. */
import { mutateLibrary as client } from "../../../apps/browser-extension/shared/storage-client.js";
import { mutateLibrary as worker } from "../../../apps/browser-extension/background/library-mutations.js";
import type {
  CaptureJob,
  CaptureStatus,
  Playlist,
  MessageResponse,
} from "../../../apps/browser-extension/shared/protocol-contracts.js";
async function accepted(playlist: Playlist, job: CaptureJob) {
  const saved = await client({ type: "put", playlist, expectedRevision: playlist.revision || 0 });
  const revision: number = saved.revision;
  const appended = await worker({ type: "append", id: playlist.id, ids: ["abcdefghijk"] });
  const ids: string[] = appended.addedIds;
  const builder = await client({ type: "builder-consume", ids });
  const total: number = builder.total;
  const completed: CaptureStatus = "complete";
  const message: MessageResponse<typeof saved> = { ok: true, result: saved };
  return { revision, total, completed, message, nullableSource: job.sourceTab };
}
async function rejected(playlist: Playlist) {
  // @ts-expect-error unsupported operation
  await client({ type: "reorder", id: playlist.id });
  // @ts-expect-error stale-save protection cannot be omitted
  await client({ type: "put", playlist });
  // @ts-expect-error builder replacement also requires expected revision
  await worker({ type: "builder-replace", ids: [] });
  const saved = await client({ type: "put", playlist, expectedRevision: 0 });
  // @ts-expect-error client unwraps the message envelope
  saved.result;
  const consumed = await client({ type: "builder-consume", ids: [] });
  // @ts-expect-error builder has no playlist revision
  consumed.revision;
  // @ts-expect-error runtime state is complete, never done
  const done: CaptureStatus = "done";
  return done;
}
void accepted;
void rejected;
