/* global browser, window */
/** Synthetic data for isolated browser profiles; never reads a user's profile. */
function createFixture() {
  const ids = Array.from({ length: 205 }, (_, i) => `vid${String(i).padStart(8, "0")}`);
  return {
    local: {
      yph_local_playlists: [
        {
          id: "local-release",
          title: "Large playlist with a long descriptive title for mobile layouts",
          videos: ids,
          isLocal: true,
          saved: true,
          timestamp: Date.now(),
        },
        {
          id: "local-second",
          title: "Second playlist",
          videos: ids.slice(0, 2),
          isLocal: true,
          saved: true,
          timestamp: Date.now(),
        },
      ],
      yphPlaylistBuilder: ids.slice(0, 3),
      local_yt_history: Object.fromEntries(
        ids.slice(0, 20).map((id) => [
          id,
          {
            title: `History ${id}`,
            channel: "Test Channel",
            lastWatchedAt: Date.now(),
            t: 20,
            duration: 120,
          },
        ])
      ),
    },
    settings: {
      defaultPageSize: 10,
      autoFetchMetadata: false,
      autoSaveEditor: false,
      watchLaterPlaylistId: "local-release",
    },
    metadata: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          videoId: id,
          title: `Video ${id} with a longer title to test mobile rendering`,
          channel: "Test Channel",
          durationSeconds: 120,
          lastCachedAt: Date.now(),
        },
      ])
    ),
  };
}

async function seedExtension(fixture) {
  await browser.storage.local.set(fixture.local);
  await browser.storage.sync.set(fixture.settings);
  await window.videoService.cacheMetadata(fixture.metadata);
}

const routes = [
  "/saved",
  "/playlist?id=local-release",
  "/favorite",
  "/new",
  "/playlist-builder",
  "/manage",
  "/history",
  "/settings",
  "/search",
  "/subscriptions",
  "/share",
  "/shortcuts",
  "/api-setup",
  "/logs",
  "/open-by-id",
];
const sizes = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [844, 390],
  [1024, 768],
  [1440, 900],
];
module.exports = { createFixture, seedExtension, routes, sizes };
