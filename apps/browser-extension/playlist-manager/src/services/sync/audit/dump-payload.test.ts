import { it } from "vitest";
const writeFileSync = (_p: string, _d: string) => {};
import { collectDirtyPlaylists } from "../adapters/playlists";
it("dump the exact wire payload the playlists adapter produces", async () => {
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
  writeFileSync(
    "/home/steve/.hermes/cache/scratch/iypm-sync-audit/wire-payload.json",
    JSON.stringify(dirty, null, 2)
  );
});
