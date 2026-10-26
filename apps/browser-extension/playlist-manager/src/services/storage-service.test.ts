import { beforeEach, expect, it, vi } from "vitest";
import type { Playlist } from "../types/model";

vi.mock("./logger-service.js", () => ({
  SystemLogger: { info: vi.fn(), error: vi.fn() },
}));

let stored: Record<string, any>;
beforeEach(async () => {
  vi.resetModules();
  stored = { yph_meta_cache_migrated_v2: true };
  vi.stubGlobal("browser", {
    storage: {
      local: {
        get: vi.fn(async (key: string) => structuredClone({ [key]: stored[key] })),
        set: vi.fn(async (value: object) => Object.assign(stored, structuredClone(value))),
      },
      onChanged: { addListener: vi.fn() },
    },
    runtime: { sendMessage: vi.fn().mockResolvedValue(undefined) },
  });
  window.isSignedIn = vi.fn().mockResolvedValue(false);
  await import("./storage-service");
});

it.each([1404, 14000])("saves %i sorted videos with nested reactive sort rules", async (count) => {
  const rules = new Proxy([new Proxy({ field: "channel", direction: "asc" }, {})], {});
  const playlist = {
    id: "local-large",
    title: "Large playlist",
    videos: Array.from({ length: count }, (_, i) => `video${String(i).padStart(6, "0")}`),
    timestamp: 1,
    isLocal: true,
    sortRules: rules,
  } as Playlist;
  await expect(window.savePlaylist(playlist, { syncToYoutube: false })).resolves.toBe(
    "local-large"
  );
  expect(stored.yph_local_playlists[0].videos).toEqual(playlist.videos);
  expect(stored.yph_local_playlists[0].sortRules).toEqual([{ field: "channel", direction: "asc" }]);
  playlist.videos.reverse();
  expect(stored.yph_local_playlists[0].videos[0]).toBe("video000000");
});

it("preserves the saved playlist when storage fails and allows retry", async () => {
  const playlist = { id: "local-retry", title: "Retry", videos: ["video000000"], timestamp: 1 };
  await window.savePlaylist(playlist, { syncToYoutube: false });
  const previous = structuredClone(stored.yph_local_playlists);
  vi.mocked(browser.storage.local.set).mockRejectedValueOnce(new Error("Storage unavailable"));
  await expect(window.savePlaylist({ ...playlist, title: "Changed" })).rejects.toThrow(
    "Storage unavailable"
  );
  expect(stored.yph_local_playlists).toEqual(previous);
  await window.savePlaylist({ ...playlist, title: "Changed" });
  expect(stored.yph_local_playlists[0].title).toBe("Changed");
});
