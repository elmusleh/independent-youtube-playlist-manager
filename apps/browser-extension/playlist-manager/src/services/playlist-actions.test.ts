import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Playlist } from "../types/model";
import type { SyncState } from "./sync-state-service";

const mocks = vi.hoisted(() => ({
  requestConfirm: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../stores/confirmation", () => ({ requestConfirm: mocks.requestConfirm }));
vi.mock("./logger", () => ({ logger: mocks.logger }));

import { createCardActions, requestSyncConfirm, syncPlaylist } from "./playlist-actions";

const LOCAL_ID = "local-1";

function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: LOCAL_ID,
    title: "My Local Playlist",
    videos: ["v1", "v2"],
    timestamp: 0,
    isLocal: true,
    ...overrides,
  };
}

function makeSyncState(overrides: Partial<SyncState> = {}): SyncState {
  return {
    localPlaylistId: LOCAL_ID,
    remotePlaylistId: "remote-1",
    playlistTitle: "My Local Playlist",
    totalVideos: 10,
    syncedVideoIds: ["v1", "v2"],
    remainingVideoIds: ["v3"],
    privacyStatus: "private",
    startedAt: 0,
    lastAttemptAt: 0,
    autoRetryEnabled: false,
    retryCount: 0,
    ...overrides,
  };
}

function makeCardParams(overrides: Record<string, unknown> = {}) {
  return {
    id: "playlist-1",
    isTagged: false,
    isLocal: false,
    signedIn: true,
    adoptingId: "",
    syncingId: "",
    openInEditor: vi.fn(),
    requestAdopt: vi.fn(),
    requestSync: vi.fn(),
    ...overrides,
  };
}

function labelsFor(params: ReturnType<typeof makeCardParams>): string[] {
  return createCardActions(params as Parameters<typeof createCardActions>[0]).map((a) => a.label);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("open", vi.fn());
  (window as unknown as Record<string, unknown>).getSyncState = vi.fn().mockResolvedValue(null);
  (window as unknown as Record<string, unknown>).ytGetPlaylist = vi.fn().mockResolvedValue(null);
  (window as unknown as Record<string, unknown>).isAutoRetryScheduled = vi
    .fn()
    .mockResolvedValue(false);
  (window as unknown as Record<string, unknown>).cancelAutoRetry = vi.fn().mockResolvedValue(null);
  (window as unknown as Record<string, unknown>).clearSyncState = vi.fn().mockResolvedValue(null);
  (window as unknown as Record<string, unknown>).savePlaylist = vi.fn().mockResolvedValue(null);
  (window as unknown as Record<string, unknown>).isSyncComplete = vi.fn().mockResolvedValue(true);
  (window as unknown as Record<string, unknown>).success = vi.fn();
  (window as unknown as Record<string, unknown>).info = vi.fn();
  (window as unknown as Record<string, unknown>).error = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCardActions", () => {
  it("includes Sync for a local playlist when signed in", () => {
    expect(labelsFor(makeCardParams({ isLocal: true, signedIn: true }))).toEqual(["Open", "Sync"]);
  });

  it("omits Sync for a local playlist when signed out", () => {
    expect(labelsFor(makeCardParams({ isLocal: true, signedIn: false }))).toEqual(["Open"]);
  });

  it("does not offer Adopt for an already adopted/tagged playlist", () => {
    const labels = labelsFor(makeCardParams({ isTagged: true, isLocal: false, signedIn: true }));
    expect(labels).not.toContain("Adopt");
    expect(labels).toEqual(["Open"]);
  });

  it("offers Adopt for an unmanaged signed-in YouTube playlist", () => {
    expect(labelsFor(makeCardParams({ isTagged: false, isLocal: false, signedIn: true }))).toEqual([
      "Open",
      "Adopt",
    ]);
  });

  it("adds Open in YouTube for liked and uploaded playlists", () => {
    for (const [id, category] of [
      ["LIKED", "liked"],
      ["UPLOADS", "uploaded"],
    ] as const) {
      const labels = labelsFor(makeCardParams({ id, category, isTagged: true }));
      expect(labels).toContain("Open in YouTube");
      expect(labels).not.toContain("Adopt");
      expect(labels[0]).toBe("Open");
    }
  });

  it("opens the matching YouTube playlist URL, mapping UPLOADS to UU", () => {
    const actions = createCardActions(
      makeCardParams({ id: "UPLOADS", category: "uploaded", isTagged: true }) as Parameters<
        typeof createCardActions
      >[0]
    );
    const openAction = actions.find((a) => a.label === "Open in YouTube");
    expect(openAction).toBeDefined();
    openAction?.onClick();
    expect(window.open).toHaveBeenCalledWith("https://www.youtube.com/playlist?list=UU", "_blank");
  });

  it("always includes the Open action", () => {
    const cases = [
      makeCardParams({ isLocal: true, signedIn: true }),
      makeCardParams({ isLocal: true, signedIn: false }),
      makeCardParams({ isTagged: true }),
      makeCardParams({ isTagged: false, isLocal: false, signedIn: false }),
      makeCardParams({ id: "LIKED", category: "liked" }),
    ];
    for (const params of cases) {
      expect(labelsFor(params)[0]).toBe("Open");
    }
  });
});

describe("requestSyncConfirm", () => {
  it("requests a fresh sync when there is no existing sync state", async () => {
    const localPlaylists = [makePlaylist()];
    const onSync = vi.fn();

    await requestSyncConfirm({ id: LOCAL_ID }, localPlaylists, onSync);

    expect(mocks.requestConfirm).toHaveBeenCalledTimes(1);
    const config = mocks.requestConfirm.mock.calls[0][0];
    expect(config.title).toBe("Sync to YouTube?");
    expect(config.message).toContain("2 videos");
    expect((window as unknown as Record<string, unknown>).clearSyncState).not.toHaveBeenCalled();

    config.onConfirm();
    expect(onSync).toHaveBeenCalledWith(null);
  });

  it("offers Resume for a valid partial sync and passes the state through", async () => {
    const state = makeSyncState();
    (window as unknown as Record<string, unknown>).getSyncState = vi.fn().mockResolvedValue(state);
    (window as unknown as Record<string, unknown>).ytGetPlaylist = vi
      .fn()
      .mockResolvedValue({ id: "remote-1" });
    (window as unknown as Record<string, unknown>).isAutoRetryScheduled = vi
      .fn()
      .mockResolvedValue(false);
    const onSync = vi.fn();

    await requestSyncConfirm({ id: LOCAL_ID }, [makePlaylist()], onSync);

    expect(mocks.requestConfirm).toHaveBeenCalledTimes(1);
    const config = mocks.requestConfirm.mock.calls[0][0];
    expect(config.title).toBe("Resume Existing Sync?");
    expect(config.message).toContain("2/10 videos (1 remaining)");
    expect(config.message).toContain("Auto-retry scheduled: No");
    expect(config.confirmLabel).toBe("Resume Sync");
    expect(config.cancelLabel).toBe("Start Fresh");

    config.onConfirm();
    expect(onSync).toHaveBeenCalledWith(state);
  });

  it("clears state and cancels a scheduled retry when starting fresh", async () => {
    const state = makeSyncState({ autoRetryEnabled: true });
    (window as unknown as Record<string, unknown>).getSyncState = vi.fn().mockResolvedValue(state);
    (window as unknown as Record<string, unknown>).ytGetPlaylist = vi
      .fn()
      .mockResolvedValue({ id: "remote-1" });
    (window as unknown as Record<string, unknown>).isAutoRetryScheduled = vi
      .fn()
      .mockResolvedValue(true);
    const onSync = vi.fn();

    await requestSyncConfirm({ id: LOCAL_ID }, [makePlaylist()], onSync);

    const config = mocks.requestConfirm.mock.calls[0][0];
    await config.onCancel();

    expect((window as unknown as Record<string, unknown>).cancelAutoRetry).toHaveBeenCalledWith(
      LOCAL_ID
    );
    expect((window as unknown as Record<string, unknown>).clearSyncState).toHaveBeenCalledWith(
      LOCAL_ID
    );
    expect(onSync).toHaveBeenCalledWith(null);
  });

  it("clears missing remote state and offers a fresh sync", async () => {
    (window as unknown as Record<string, unknown>).getSyncState = vi
      .fn()
      .mockResolvedValue(makeSyncState());
    (window as unknown as Record<string, unknown>).ytGetPlaylist = vi.fn().mockResolvedValue(null);
    const onSync = vi.fn();

    await requestSyncConfirm({ id: LOCAL_ID }, [makePlaylist()], onSync);

    expect((window as unknown as Record<string, unknown>).clearSyncState).toHaveBeenCalledWith(
      LOCAL_ID
    );
    expect(mocks.requestConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.requestConfirm.mock.calls[0][0].title).toBe("Sync to YouTube?");
  });

  it("clears invalid remote state and offers a fresh sync", async () => {
    (window as unknown as Record<string, unknown>).getSyncState = vi
      .fn()
      .mockResolvedValue(makeSyncState());
    (window as unknown as Record<string, unknown>).ytGetPlaylist = vi
      .fn()
      .mockRejectedValue(new Error("YouTube API unavailable"));
    const onSync = vi.fn();

    await requestSyncConfirm({ id: LOCAL_ID }, [makePlaylist()], onSync);

    expect((window as unknown as Record<string, unknown>).clearSyncState).toHaveBeenCalledWith(
      LOCAL_ID
    );
    expect(mocks.requestConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.requestConfirm.mock.calls[0][0].title).toBe("Sync to YouTube?");
  });

  it("does nothing when the local playlist no longer exists", async () => {
    const onSync = vi.fn();
    await requestSyncConfirm({ id: "gone" }, [makePlaylist()], onSync);
    expect(mocks.requestConfirm).not.toHaveBeenCalled();
    expect(onSync).not.toHaveBeenCalled();
  });
});

describe("syncPlaylist", () => {
  it("saves the playlist and reports success when the sync completes", async () => {
    const localPlaylist = makePlaylist();
    const result = await syncPlaylist({ id: LOCAL_ID }, null, [localPlaylist]);

    expect(result).toBe(true);
    expect((window as unknown as Record<string, unknown>).savePlaylist).toHaveBeenCalledWith(
      localPlaylist,
      { syncToYoutube: true, resumeFromState: undefined }
    );
    expect((window as unknown as Record<string, unknown>).success).toHaveBeenCalledWith(
      "Playlist synced to YouTube successfully!"
    );
    expect((window as unknown as Record<string, unknown>).error).not.toHaveBeenCalled();
  });

  it("returns false and surfaces the quota message on quota failure", async () => {
    const state = makeSyncState();
    (window as unknown as Record<string, unknown>).savePlaylist = vi
      .fn()
      .mockRejectedValue(new Error("API quota exceeded"));
    (window as unknown as Record<string, unknown>).getSyncState = vi.fn().mockResolvedValue(state);
    (window as unknown as Record<string, unknown>).isAutoRetryScheduled = vi
      .fn()
      .mockResolvedValue(false);

    const result = await syncPlaylist({ id: LOCAL_ID }, null, [makePlaylist()]);

    expect(result).toBe(false);
    expect(mocks.logger.error).toHaveBeenCalledTimes(1);
    const errorMessage = (window as unknown as Record<string, unknown>).error as ReturnType<
      typeof vi.fn
    >;
    expect(errorMessage).toHaveBeenCalledTimes(1);
    const message = errorMessage.mock.calls[0][0] as string;
    expect(message).toContain("API quota exceeded!");
    expect(message).toContain("Progress: 2/10 videos synced");
    expect(message).toContain("Remaining: 1 videos");
    expect(message).toContain("Click Sync to resume tomorrow");
  });

  it("returns false without saving when the local playlist is missing", async () => {
    const result = await syncPlaylist({ id: "gone" }, null, [makePlaylist()]);
    expect(result).toBe(false);
    expect((window as unknown as Record<string, unknown>).savePlaylist).not.toHaveBeenCalled();
  });
});
