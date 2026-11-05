import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { libraryFixture } from "../test-support/library-fixture";
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.resetModules());
const first = "abcdefghijk",
  second = "12345678901";
it("serializes writes to different playlists without losing either addition", async () => {
  const { mutateLibrary, stored } = await libraryFixture({
    yph_local_playlists: [
      { id: "local-a", title: "A", videos: [] },
      { id: "local-b", title: "B", videos: [] },
    ],
  });
  await Promise.all([
    mutateLibrary({ type: "append", id: "local-a", ids: [first] }),
    mutateLibrary({ type: "append", id: "local-b", ids: [second] }),
  ]);
  expect(stored.yph_local_playlists.map((p: any) => p.videos)).toEqual([[first], [second]]);
});
it("rejects a dirty editor's stale revision without overwriting a capture", async () => {
  const { mutateLibrary, stored } = await libraryFixture({
    yph_local_playlists: [{ id: "local-a", title: "A", videos: [], revision: 1 }],
  });
  await mutateLibrary({ type: "append", id: "local-a", ids: [first] });
  await expect(
    mutateLibrary({
      type: "put",
      playlist: { id: "local-a", title: "Dirty", videos: [second], timestamp: 2 },
      expectedRevision: 1,
    })
  ).rejects.toThrow(/changed/);
  expect(stored.yph_local_playlists[0].videos).toEqual([first]);
});
it("rejects stale whole-array restores and continues after a failed operation", async () => {
  const { mutateLibrary, stored } = await libraryFixture();
  await mutateLibrary({ type: "append", create: true, title: "A", ids: [first] });
  await expect(
    mutateLibrary({ type: "replace", playlists: [], expectedRevision: 0 })
  ).rejects.toThrow(/changed/);
  await mutateLibrary({ type: "builder-append", ids: [second] });
  expect(stored.yph_local_playlists).toHaveLength(1);
  expect(stored.yphPlaylistBuilder).toEqual([second]);
});
it("journals new-playlist results atomically so retries never create copies", async () => {
  const { mutateLibrary, stored } = await libraryFixture();
  const operation = {
    type: "append" as const,
    create: true,
    ids: [first],
    receipt: "11111111-1111-4111-8111-111111111111",
  };
  const result = await mutateLibrary(operation);
  expect(await mutateLibrary(operation)).toEqual(result);
  expect(stored.yph_local_playlists).toHaveLength(1);
});
it("consumes only saved builder IDs, retaining concurrent additions", async () => {
  const { mutateLibrary, stored } = await libraryFixture({ yphPlaylistBuilder: [first, second] });
  await mutateLibrary({ type: "builder-consume", ids: [first] });
  expect(stored.yphPlaylistBuilder).toEqual([second]);
});
it("does not signal success or update the badge when persistence fails", async () => {
  const { mutateLibrary, api } = await libraryFixture();
  api.storage.local.set.mockRejectedValueOnce(new Error("Quota exceeded"));
  await expect(mutateLibrary({ type: "builder-append", ids: [first] })).rejects.toThrow(/Quota/);
  expect(api.action.setBadgeText).not.toHaveBeenCalled();
});
it("bounds payloads and rejects invalid video IDs", async () => {
  const { mutateLibrary } = await libraryFixture();
  await expect(mutateLibrary({ type: "builder-append", ids: ["invalid"] })).rejects.toThrow(
    /Invalid/
  );
});
it("handles 14,000-video destinations while retaining order and deduplicating", async () => {
  const ids = Array.from({ length: 14000 }, (_, i) => `vid${String(i).padStart(8, "0")}`);
  const { mutateLibrary, stored } = await libraryFixture({
    yph_local_playlists: [{ id: "local-large", title: "Large", videos: ids }],
  });
  const result = await mutateLibrary({
    type: "append",
    id: "local-large",
    ids: [ids[0], first],
    position: "top",
  });
  expect((result as { addedIds?: string[] }).addedIds).toEqual([first]);
  expect(stored.yph_local_playlists[0].videos).toEqual([first, ...ids]);
});

it("rejects stale deletes and prevents a deleted legacy record from being resurrected", async () => {
  const { mutateLibrary, stored } = await libraryFixture({
    yph_local_playlists: [{ id: "local-old", title: "Old", videos: [], revision: 1 }],
  });
  await expect(
    mutateLibrary({ type: "delete", id: "local-old", expectedRevision: 0 })
  ).rejects.toThrow(/changed/);
  await mutateLibrary({ type: "delete", id: "local-old", expectedRevision: 1 });
  await expect(
    mutateLibrary({
      type: "put",
      playlist: { id: "local-old", title: "Stale", videos: [], timestamp: 2 },
      expectedRevision: 0,
    })
  ).rejects.toThrow(/changed/);
  expect(stored.yph_local_playlists).toEqual([]);
});
