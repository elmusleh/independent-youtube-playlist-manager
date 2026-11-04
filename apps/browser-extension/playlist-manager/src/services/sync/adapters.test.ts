import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyRemoteHistory } from "./adapters/history";
import { applyRemotePlaylists, collectDirtyPlaylists } from "./adapters/playlists";
import { computeRecordId, deriveKeys } from "./keys";
import { encryptRecord, RECORD_VERSION, type RecordEnvelope } from "./record-codec";
import { clearAllShadows, getShadow, setShadow } from "./shadow-store";

const SYNC_KEY = "ABCDEFGHIJKLMNOPQRST";

describe("history adapter deletion", () => {
  let localHistory: Record<string, Record<string, unknown>>;

  beforeEach(async () => {
    await clearAllShadows();
    localHistory = {
      deletedVideo: { videoId: "deletedVideo", lastWatchedAt: 10, title: "Old" },
      keptVideo: { videoId: "keptVideo", lastWatchedAt: 20, title: "Keep" },
    };
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({ local_yt_history: structuredClone(localHistory) }),
          set: async (values: Record<string, unknown>) => {
            if (values.local_yt_history) {
              localHistory = structuredClone(values.local_yt_history as typeof localHistory);
            }
          },
        },
      },
    });
    await setShadow("history", "deletedVideo", localHistory.deletedVideo, 100, "local");
    await setShadow("history", "keptVideo", localHistory.keptVideo, 100, "local");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearAllShadows();
  });

  it("applies a remote tombstone without restoring the pre-delete snapshot", async () => {
    const data = localHistory.deletedVideo;
    const rid = await computeRecordId(SYNC_KEY, "history", "deletedVideo");
    const envelope: RecordEnvelope = {
      v: RECORD_VERSION,
      collection: "history",
      id: rid,
      hlc: 200,
      deleted: true,
      data,
    };
    const encrypted = await encryptRecord(envelope, await deriveKeys(SYNC_KEY));
    const result = await applyRemoteHistory(
      {
        syncKey: SYNC_KEY,
        localDeviceId: "local",
        librarySnapshot: async () => ({ history: structuredClone(localHistory) }),
        saveHistory: async (entries) => {
          localHistory = Object.fromEntries(
            (entries as Array<Record<string, unknown>>).map((entry) => [
              String(entry.videoId),
              entry,
            ])
          );
          await browser.storage.local.set({ local_yt_history: localHistory });
        },
      },
      [{ rid, payload: JSON.stringify(encrypted), deleted: true, version: 200 }]
    );

    expect(result.failed).toEqual([]);
    expect(Object.keys(localHistory)).toEqual(["keptVideo"]);
    expect(localHistory.keptVideo).toEqual({
      videoId: "keptVideo",
      lastWatchedAt: 20,
      title: "Keep",
    });
  });

  it("ignores an older active history version", async () => {
    const staleEntry = { videoId: "deletedVideo", lastWatchedAt: 30, title: "Stale" };
    const rid = await computeRecordId(SYNC_KEY, "history", staleEntry.videoId);
    const encrypted = await encryptRecord(
      {
        v: RECORD_VERSION,
        collection: "history",
        id: rid,
        hlc: 50,
        deleted: false,
        data: staleEntry,
      },
      await deriveKeys(SYNC_KEY)
    );
    const result = await applyRemoteHistory(
      {
        syncKey: SYNC_KEY,
        localDeviceId: "local",
        librarySnapshot: async () => ({ history: structuredClone(localHistory) }),
        saveHistory: async (entries) => {
          localHistory = Object.fromEntries(
            (entries as Array<Record<string, unknown>>).map((entry) => [
              String(entry.videoId),
              entry,
            ])
          );
        },
      },
      [{ rid, payload: JSON.stringify(encrypted), deleted: false, version: 50 }]
    );

    expect(result.failed).toEqual([]);
    expect(localHistory.deletedVideo.lastWatchedAt).toBe(10);
    expect((await getShadow("history", "deletedVideo"))?.remoteVersion).toBe(100);
  });
});

describe("playlist adapter deletion", () => {
  let localPlaylists: Array<Record<string, unknown>>;
  const basePlaylist = {
    id: "playlist-delete-test",
    title: "Base title",
    videos: [],
    createdAt: 1,
    updatedAt: 10,
    revision: 1,
  };

  beforeEach(async () => {
    await clearAllShadows();
    localPlaylists = [{ ...basePlaylist, title: "Local edit", updatedAt: 20 }];
    await setShadow("playlists", basePlaylist.id, basePlaylist, 100, "local");
  });

  afterEach(async () => {
    await clearAllShadows();
  });

  it("keeps a local edit against a remote tombstone and leaves it dirty", async () => {
    const rid = await computeRecordId(SYNC_KEY, "playlists", basePlaylist.id);
    const encrypted = await encryptRecord(
      {
        v: RECORD_VERSION,
        collection: "playlists",
        id: rid,
        hlc: 200,
        deleted: true,
        data: basePlaylist,
      },
      await deriveKeys(SYNC_KEY)
    );
    const context = {
      syncKey: SYNC_KEY,
      space: "space-test",
      authHash: "auth-test",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      localDeviceId: "local",
      librarySnapshot: async () => ({ playlists: structuredClone(localPlaylists), revision: 5 }),
      mutateLibrary: async (operation: { playlists: Array<Record<string, unknown>> }) => {
        localPlaylists = structuredClone(operation.playlists);
      },
    };
    const result = await applyRemotePlaylists(context, [
      { rid, payload: JSON.stringify(encrypted), deleted: true, version: 200 },
    ]);
    const shadow = await getShadow("playlists", basePlaylist.id);
    const candidates = await collectDirtyPlaylists(context);

    expect(result.failed).toEqual([]);
    expect(localPlaylists).toHaveLength(1);
    expect(localPlaylists[0].title).toBe("Local edit");
    expect(shadow?.deleted).toBe(true);
    expect(
      candidates.some((candidate) => candidate.recordId === basePlaylist.id && !candidate.deleted)
    ).toBe(true);
  });

  it("does not apply an older active playlist version over a newer shadow", async () => {
    localPlaylists = [structuredClone(basePlaylist)];
    const stalePlaylist = { ...basePlaylist, title: "Stale remote title", updatedAt: 15 };
    const rid = await computeRecordId(SYNC_KEY, "playlists", basePlaylist.id);
    const encrypted = await encryptRecord(
      {
        v: RECORD_VERSION,
        collection: "playlists",
        id: rid,
        hlc: 50,
        deleted: false,
        data: stalePlaylist,
      },
      await deriveKeys(SYNC_KEY)
    );
    const context = {
      syncKey: SYNC_KEY,
      space: "space-test",
      authHash: "auth-test",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      localDeviceId: "local",
      librarySnapshot: async () => ({ playlists: structuredClone(localPlaylists), revision: 5 }),
      mutateLibrary: async (operation: { playlists: Array<Record<string, unknown>> }) => {
        localPlaylists = structuredClone(operation.playlists);
      },
    };

    const result = await applyRemotePlaylists(context, [
      { rid, payload: JSON.stringify(encrypted), deleted: false, version: 50 },
    ]);

    expect(result.failed).toEqual([]);
    expect(localPlaylists[0].title).toBe("Base title");
    expect((await getShadow("playlists", basePlaylist.id))?.remoteVersion).toBe(100);
  });
});
