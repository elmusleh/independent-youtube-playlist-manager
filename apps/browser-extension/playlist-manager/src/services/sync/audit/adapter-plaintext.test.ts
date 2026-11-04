// BUG-7 at the adapter: the real playlists adapter's wire payload must be ciphertext.
import { it, expect } from "vitest";
import { collectDirtyPlaylists } from "../adapters/playlists";
it("BUG-7 wire payload must not contain plaintext playlist content", async () => {
  const playlist = {
    id: "local-1",
    title: "SECRET-PLAYLIST-NAME",
    videos: ["abc123def45"],
    updatedAt: "2026-11-04T10:00:00.000Z",
    revision: 1,
  };
  const dirty = await collectDirtyPlaylists({
    syncKey: "ABCDEFGHJKMNPQRSTVWX",
    space: "s",
    authHash: "h",
    localDeviceId: "d",
    relayConfig: { url: "x", anonKey: "y" },
    librarySnapshot: async () => ({ playlists: [playlist], revision: 1 }),
    mutateLibrary: async () => ({}),
  } as any);
  expect(dirty.length).toBe(1); // guard: a real record was produced (not an env error)
  expect(dirty[0].payload.includes("SECRET-PLAYLIST-NAME")).toBe(false);
});
it("control: adapter produces exactly one dirty record for one playlist", async () => {
  const dirty = await collectDirtyPlaylists({
    syncKey: "ABCDEFGHJKMNPQRSTVWX",
    space: "s",
    authHash: "h",
    localDeviceId: "d",
    relayConfig: { url: "x", anonKey: "y" },
    librarySnapshot: async () => ({
      playlists: [
        { id: "p", title: "t", videos: [], updatedAt: "2026-11-04T10:00:00.000Z", revision: 1 },
      ],
      revision: 1,
    }),
    mutateLibrary: async () => ({}),
  } as any);
  expect(dirty.length).toBe(1);
});
