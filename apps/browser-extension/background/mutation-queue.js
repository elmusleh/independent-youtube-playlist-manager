/* eslint-disable no-console */
/**
 * Mutation queue — serializes writes to the playlists storage key with revision checks.
 */

/**
 * Mutation queue for serializing writes to the playlists storage key.
 * Each mutation is a function that returns a Promise.
 */
const _mutationQueue = [];
let _queueProcessing = false;
let _revision = 0;

/**
 * Get current revision of playlists storage.
 * @returns {Promise<number>}
 */
async function getPlaylistsRevision() {
  const result = await browser.storage.local.get("yph_playlists_revision");
  return result.yph_playlists_revision || 0;
}

/**
 * Increment and store revision.
 * @returns {Promise<number>}
 */
async function incrementPlaylistsRevision() {
  _revision = await getPlaylistsRevision();
  _revision++;
  await browser.storage.local.set({ yph_playlists_revision: _revision });
  return _revision;
}

/**
 * Serialize a mutation to the playlists storage key.
 * @param {Function} mutationFn - Async function that performs the mutation
 * @param {number} expectedRevision - Revision the mutation expects
 * @returns {Promise<any>}
 */
export async function enqueuePlaylistMutation(mutationFn, expectedRevision) {
  return new Promise((resolve, reject) => {
    _mutationQueue.push({ mutationFn, expectedRevision, resolve, reject });
    processMutationQueue();
  });
}

/**
 * Process the mutation queue sequentially.
 */
async function processMutationQueue() {
  if (_queueProcessing || _mutationQueue.length === 0) return;
  _queueProcessing = true;

  while (_mutationQueue.length > 0) {
    const { mutationFn, expectedRevision, resolve, reject } = _mutationQueue.shift();

    try {
      // Verify revision hasn't changed
      const currentRevision = await getPlaylistsRevision();
      if (currentRevision !== expectedRevision) {
        reject(
          new Error(
            `Stale revision: expected ${expectedRevision}, current ${currentRevision}. Another write occurred.`
          )
        );
        continue;
      }

      const result = await mutationFn();
      // Increment revision after successful mutation
      await incrementPlaylistsRevision();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  _queueProcessing = false;
}

export default {
  enqueuePlaylistMutation,
  getPlaylistsRevision,
};
