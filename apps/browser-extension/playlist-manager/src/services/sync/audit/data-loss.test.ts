// BUG-9: a failed local apply must not lose the remote edit forever.
// Uses the REAL adapter + REAL shadow store (fake-indexeddb); fails the local write on purpose.
import { it, expect, vi } from "vitest";
import { applyRemotePlaylists } from "../adapters/playlists";
import { getShadow } from "../shadow-store";
it("BUG-9 a remote edit whose local apply FAILED is not recorded as synced", async () => {
  const remote = {
    id: "p1",
    title: "REMOTE-EDIT",
    videos: ["vid000000001"],
    updatedAt: "2026-11-04T11:00:00.000Z",
    revision: 2,
  };
  const ctx: any = {
    syncKey: "ABCDEFGHJKMNPQRSTVWX",
    space: "s",
    authHash: "h",
    localDeviceId: "dev-A",
    relayConfig: { url: "x", anonKey: "y" },
    librarySnapshot: async () => ({
      playlists: [
        {
          id: "p1",
          title: "LOCAL",
          videos: [],
          updatedAt: "2026-11-04T10:00:00.000Z",
          revision: 1,
        },
      ],
      revision: 1,
    }),
    mutateLibrary: async () => {
      throw new Error("simulated storage write failure");
    },
  };
  const res = await applyRemotePlaylists(ctx, [
    { rid: "r", payload: JSON.stringify(remote), deleted: false, version: 0 },
  ]);
  expect(res.failed.length).toBe(1); // guard: the failure really happened
  const shadow = await getShadow("playlists", "p1");
  // The remote edit was NOT applied, so the shadow base must NOT now claim it as the synced copy.
  const recordedAsSynced = shadow?.baseCopy && (shadow.baseCopy as any).title === "REMOTE-EDIT";
  expect(recordedAsSynced).toBeFalsy();
});
