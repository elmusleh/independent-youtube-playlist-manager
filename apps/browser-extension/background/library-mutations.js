// @ts-check
import { permittedUI } from "./message-access.js";
import { updateBadge } from "./utils.js";
const KEY = "yph_local_playlists";
const REV = "yph_library_revision";
const BUILDER = "yphPlaylistBuilder";
/** @type {Promise<unknown>} */
let tail = Promise.resolve();
const conflict = () =>
  new Error(
    "This playlist changed in another page. Your edits are still here. Compare with the saved playlist before retrying."
  );
/** @param {unknown} value @returns {string[]} */
export function validIds(value) {
  if (
    !Array.isArray(value) ||
    value.length > 100000 ||
    value.some((id) => typeof id !== "string" || !/^[\w-]{11}$/.test(id))
  )
    throw new Error("Invalid video list (maximum 100,000 videos).");
  return [...new Set(value)];
}
/** @param {import("../shared/protocol-contracts.js").Playlist} value */
function plainPlaylist(value) {
  if (
    !value ||
    typeof value.title !== "string" ||
    value.title.length > 500 ||
    typeof value.id !== "string"
  )
    throw new Error("Invalid playlist.");
  const plain = { ...value, videos: validIds(value.videos), saved: true, isLocal: true };
  delete plain.loadedVideos;
  delete plain.isDirty;
  return plain;
}
function expectRevision(actual, expected) {
  if (!Number.isSafeInteger(expected) || actual !== expected) throw conflict();
}
/** @overload
 * @param {import("../shared/protocol-contracts.js").PutOperation} operation
 * @returns {Promise<import("../shared/protocol-contracts.js").PutResult>}
 */
/** @overload
 * @param {import("../shared/protocol-contracts.js").AppendOperation} operation
 * @returns {Promise<import("../shared/protocol-contracts.js").AppendResult>}
 */
/** @overload
 * @param {import("../shared/protocol-contracts.js").ReplaceOperation} operation
 * @returns {Promise<{ revision: number }>}
 */
/** @overload
 * @param {import("../shared/protocol-contracts.js").DeleteOperation} operation
 * @returns {Promise<{ id: string }>}
 */
/** @overload
 * @param {import("../shared/protocol-contracts.js").BuilderOperation} operation
 * @returns {Promise<import("../shared/protocol-contracts.js").BuilderResult>}
 */
/** @overload
 * @param {import("../shared/protocol-contracts.js").WatchedOperation} operation
 * @returns {Promise<{ removed: boolean }>}
 */
/** @overload
 * @param {import("../shared/protocol-contracts.js").MutateOperation} operation
 * @returns {Promise<import("../shared/protocol-contracts.js").MutateResult>}
 */
/** @param {import("../shared/protocol-contracts.js").MutateOperation} operation
 * @returns {Promise<import("../shared/protocol-contracts.js").MutateResult>}
 */
export function mutateLibrary(operation) {
  const next = tail.then(() => apply(operation));
  tail = next.catch(() => {});
  return next;
}
/** @param {import("../shared/protocol-contracts.js").MutateOperation} op
 * @returns {Promise<import("../shared/protocol-contracts.js").MutateResult>} */
async function apply(op) {
  if (!op || typeof op.type !== "string") throw new Error("Invalid storage operation.");
  if (op.receipt && !/^[\da-f-]{36}$/.test(op.receipt)) throw new Error("Invalid capture receipt.");
  if (
    op.receipt &&
    (await browser.storage.local.get(`yph_capture_job:${op.receipt}:cancel`))[
      `yph_capture_job:${op.receipt}:cancel`
    ]
  )
    throw new Error("Capture cancelled. Previously saved videos were kept.");
  const receiptKey = op.receipt ? `yph_capture_receipt:${op.receipt}` : null;
  if (receiptKey) {
    const receipt = (await browser.storage.local.get(receiptKey))[receiptKey];
    if (receipt) return receipt;
  }
  const stored = await browser.storage.local.get([
    KEY,
    REV,
    BUILDER,
    "yph_builder_revision",
    "yph_deleted_playlist_ids",
  ]);
  /** @type {import("../shared/protocol-contracts.js").Playlist[]} */
  const playlists = stored[KEY] || [];
  const revision = stored[REV] || 0;
  if (!Array.isArray(playlists))
    throw new Error("Playlist storage needs repair. Export a backup before continuing.");
  /** @type {import("../shared/protocol-contracts.js").MutateResult} */
  let result;
  if (
    op.type === "builder-append" ||
    op.type === "builder-consume" ||
    op.type === "builder-replace"
  ) {
    const current = validIds(stored[BUILDER] || []);
    const ids = validIds(op.ids || []);
    const existing = new Set(current);
    const addedIds = ids.filter((id) => !existing.has(id));
    let videos;
    if (op.type === "builder-append")
      videos = op.position === "top" ? [...addedIds, ...current] : [...current, ...addedIds];
    else if (op.type === "builder-consume") videos = current.filter((id) => !ids.includes(id));
    else if (op.type === "builder-replace") {
      expectRevision(stored.yph_builder_revision || 0, op.expectedRevision);
      videos = ids;
    } else throw new Error("Unknown builder operation.");
    result = {
      id: "builder",
      total: videos.length,
      addedIds,
      duplicates: ids.length - addedIds.length,
    };
    await browser.storage.local.set({
      [BUILDER]: videos,
      yph_builder_revision: (stored.yph_builder_revision || 0) + 1,
      ...(receiptKey ? { [receiptKey]: result } : {}),
    });
    updateBadge(videos.length ? String(videos.length) : "");
    return result;
  }
  if (op.type === "replace") {
    expectRevision(revision, op.expectedRevision);
    if (!Array.isArray(op.playlists) || op.playlists.length > 10000)
      throw new Error("Invalid playlist collection.");
    const incoming = op.playlists.map(plainPlaylist);
    const known = new Set();
    for (const item of incoming) {
      if (!item.id || known.has(item.id)) throw new Error("Duplicate or missing playlist ID.");
      known.add(item.id);
      item.revision = (playlists.find((p) => p.id === item.id)?.revision || 0) + 1;
    }
    await browser.storage.local.set({
      [KEY]: incoming,
      [REV]: revision + 1,
      yph_deleted_playlist_ids: (stored.yph_deleted_playlist_ids || []).filter(
        (id) => !incoming.some((p) => p.id === id)
      ),
    });
    return { revision: revision + 1 };
  }
  const index = playlists.findIndex((p) => p.id === ("id" in op ? op.id : undefined));
  const current = playlists[index];
  if (op.type === "put") {
    const playlist = plainPlaylist(op.playlist);
    const found = playlists.findIndex((p) => p.id === playlist.id);
    const previous = playlists[found];
    expectRevision(previous?.revision || 0, op.expectedRevision);
    if (
      !previous &&
      (op.expectedRevision > 0 || stored.yph_deleted_playlist_ids?.includes(playlist.id))
    )
      throw conflict();
    playlist.revision = (previous?.revision || 0) + 1;
    playlist.syncStatus = "pending";
    playlist.updatedAt = new Date().toISOString();
    if (found < 0) playlists.push(playlist);
    else playlists[found] = playlist;
    result = { id: playlist.id, revision: playlist.revision };
  } else if (op.type === "append") {
    const ids = validIds(op.ids);
    let destination = current;
    if (op.create) {
      destination = plainPlaylist({
        id: `local-${crypto.randomUUID()}`,
        title: op.title || "New local playlist",
        videos: [],
        timestamp: Date.now(),
      });
      playlists.push(destination);
    }
    if (!destination) throw new Error("The destination was deleted. Choose another playlist.");
    const existing = new Set(destination.videos);
    const addedIds = ids.filter((id) => !existing.has(id));
    destination.videos =
      op.position === "top"
        ? [...addedIds, ...destination.videos]
        : [...destination.videos, ...addedIds];
    destination.revision = (destination.revision || 0) + 1;
    destination.syncStatus = "pending";
    destination.updatedAt = new Date().toISOString();
    result = {
      id: destination.id,
      revision: destination.revision,
      addedIds,
      duplicates: ids.length - addedIds.length,
    };
  } else if (op.type === "delete") {
    if (!current) throw conflict();
    expectRevision(current.revision || 0, op.expectedRevision);
    playlists.splice(index, 1);
    stored.yph_deleted_playlist_ids = [
      ...new Set([...(stored.yph_deleted_playlist_ids || []), op.id]),
    ];
    result = { id: op.id };
  } else if (op.type === "remove-watched") {
    if (!current || current.isPermanent || !current.videos.includes(op.videoId))
      return { removed: false };
    current.videos = current.videos.filter((id) => id !== op.videoId);
    current.revision = (current.revision || 0) + 1;
    result = { removed: true };
  } else throw new Error("Unknown storage operation.");
  await browser.storage.local.set({
    [KEY]: playlists,
    [REV]: revision + 1,
    yph_deleted_playlist_ids: stored.yph_deleted_playlist_ids || [],
    ...(receiptKey ? { [receiptKey]: result } : {}),
  });
  return result;
}
// Set before importing bundled services: worker-local calls must not message themselves.
globalThis.yphMutateLibrary = mutateLibrary;
browser.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.cmd !== "mutate-library") return undefined;
  if (!permittedUI(sender)) {
    respond({ ok: false, error: "This page cannot modify playlists." });
    return false;
  }
  mutateLibrary(message.operation).then(
    (result) => respond({ ok: true, result }),
    (error) => respond({ ok: false, error: error.message })
  );
  return true;
});
