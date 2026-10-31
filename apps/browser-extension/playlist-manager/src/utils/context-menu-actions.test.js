import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { libraryFixture } from "../test-support/library-fixture";
beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const anchor = { id: 1, windowId: 2, index: 0, url: "https://youtu.be/abcdefghijk" };
async function setup() {
  const fixture = await libraryFixture();
  fixture.api.tabs.query.mockResolvedValue([anchor]);
  fixture.api.tabs.get.mockResolvedValue(anchor);
  window.getSettings = vi.fn().mockResolvedValue({});
  window.getPlaylists = vi.fn().mockRejectedValue(new Error("Offline"));
  window.isSignedIn = vi.fn().mockResolvedValue(false);
  const controller = await import("../../../background/capture-controller.js");
  return { ...fixture, ...controller };
}
it("falls back from a blob media source to the watch page", async () => {
  await setup();
  const { videoIdFromMenu } = await import("../../../background/context-menu-actions.js");
  expect(
    videoIdFromMenu({ srcUrl: "blob:https://youtube.com/example", pageUrl: anchor.url }, anchor)
  ).toBe("abcdefghijk");
});
it("explains private-window exclusion before querying tabs", async () => {
  const { startCapture, api } = await setup();
  await expect(
    startCapture({ scope: "all", mode: "new", anchor: { ...anchor, incognito: true } })
  ).rejects.toThrow(/private/i);
  expect(api.tabs.query).not.toHaveBeenCalled();
});
it("creates a local destination offline without listing remote playlists", async () => {
  const { startCapture, stored } = await setup();
  const result = await startCapture({ scope: "current", mode: "new", anchor });
  expect(window.getPlaylists).not.toHaveBeenCalled();
  expect(result.added).toBe(1);
  expect(stored.yph_local_playlists[0].videos).toEqual(["abcdefghijk"]);
});
it("sends remote favorites to review without mutating a destination", async () => {
  const { startCapture, stored, api } = await setup();
  window.getSettings.mockResolvedValue({ watchLaterPlaylistId: "PLremote" });
  stored.yt_playlist_cache_v1 = {
    list: { data: [{ id: "PLremote", title: "Remote", videos: [] }] },
  };
  const result = await startCapture({ scope: "current", mode: "favorite", anchor });
  expect(result.review).toBe(true);
  expect(stored.yph_local_playlists).toBeUndefined();
  expect(api.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining("#/capture?job=") });
});
it("does not silently replace a deleted favorite", async () => {
  const { startCapture, stored } = await setup();
  window.getSettings.mockResolvedValue({ watchLaterPlaylistId: "local-deleted" });
  const result = await startCapture({ scope: "current", mode: "favorite", anchor });
  expect(result.review).toBe(true);
  expect(stored.yph_local_playlists).toBeUndefined();
});
it("closes only newly saved, unchanged, unpinned tabs", async () => {
  const { closeSavedTabs, api } = await setup();
  api.tabs.get.mockResolvedValue({ ...anchor, windowId: 8 });
  await closeSavedTabs([anchor, { ...anchor, id: 2, pinned: true }], ["abcdefghijk"]);
  expect(api.tabs.remove).not.toHaveBeenCalled();
  api.tabs.get.mockResolvedValue(anchor);
  await closeSavedTabs([anchor], []);
  expect(api.tabs.remove).not.toHaveBeenCalled();
  await closeSavedTabs([anchor], ["abcdefghijk"]);
  expect(api.tabs.remove).toHaveBeenCalledWith(1);
});
