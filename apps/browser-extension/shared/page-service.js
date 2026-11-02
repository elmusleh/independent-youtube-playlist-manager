/**
 * Access to services that `background/init.js` publishes on `globalThis`.
 *
 * In the MV3 worker `init.js` aliases `globalThis.window = globalThis`, and
 * `background/index.js` imports the editor bundles, so `window.videoService` really does
 * exist there at runtime. `@ts-check` cannot see it: from its point of view `window` is
 * `Window & typeof globalThis`, which has no `videoService`. Every background access goes
 * through this module so the unavoidable cast lives in one documented place instead of
 * being repeated — or silently skipped — at each call site.
 *
 * The optional methods mirror what the page bundle actually exposes; keep them in sync
 * with `playlist-manager/src/services/video-service.ts`.
 */

/**
 * @typedef {object} ScrapedMetadataRecord
 * @property {string} videoId
 * @property {string} [title]
 * @property {string} [channel]
 * @property {string} [durationISO]
 * @property {number} [durationSeconds]
 * @property {boolean} [isLive]
 * @property {number} [lastCachedAt]
 */

/**
 * @typedef {object} VideoServiceBridge
 * @property {(records: Record<string, ScrapedMetadataRecord>) => Promise<unknown>} [cacheScrapedMetadata]
 */

/**
 * @returns {VideoServiceBridge | undefined} the page video service, when it is loaded
 */
export function videoServiceBridge() {
  const scope = /** @type {any} */ (globalThis);
  return scope.videoService;
}
