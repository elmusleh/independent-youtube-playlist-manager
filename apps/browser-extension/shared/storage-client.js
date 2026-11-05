// @ts-check
/** All playlist/builder writes go through the worker, including writes from other pages. */
/** @overload
 * @param {import("./protocol-contracts.js").PutOperation} operation
 * @returns {Promise<import("./protocol-contracts.js").PutResult>}
 */
/** @overload
 * @param {import("./protocol-contracts.js").AppendOperation} operation
 * @returns {Promise<import("./protocol-contracts.js").AppendResult>}
 */
/** @overload
 * @param {import("./protocol-contracts.js").ReplaceOperation} operation
 * @returns {Promise<{ revision: number }>}
 */
/** @overload
 * @param {import("./protocol-contracts.js").DeleteOperation} operation
 * @returns {Promise<{ id: string }>}
 */
/** @overload
 * @param {import("./protocol-contracts.js").BuilderOperation} operation
 * @returns {Promise<import("./protocol-contracts.js").BuilderResult>}
 */
/** @overload
 * @param {import("./protocol-contracts.js").WatchedOperation} operation
 * @returns {Promise<{ removed: boolean }>}
 */
/** @overload
 * @param {import("./protocol-contracts.js").MutateOperation} operation
 * @returns {Promise<import("./protocol-contracts.js").MutateResult>}
 */
/** @param {import("./protocol-contracts.js").MutateOperation} operation
 * @returns {Promise<import("./protocol-contracts.js").MutateResult>}
 */
export async function mutateLibrary(operation) {
  const plain = JSON.parse(JSON.stringify(operation));
  if (globalThis.yphMutateLibrary) return globalThis.yphMutateLibrary(plain);
  const response = await browser.runtime.sendMessage({ cmd: "mutate-library", operation: plain });
  if (!response?.ok)
    throw new Error(
      response?.error || "Playlist storage is unavailable. Retry without closing this page."
    );
  return response.result;
}

/** @returns {Promise<import("./protocol-contracts.js").LibrarySnapshot>} */
export async function librarySnapshot() {
  const stored = await browser.storage.local.get(["yph_local_playlists", "yph_library_revision"]);
  return {
    playlists: stored.yph_local_playlists || [],
    revision: stored.yph_library_revision || 0,
  };
}
