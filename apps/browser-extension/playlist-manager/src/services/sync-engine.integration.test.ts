import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeRecordId, deriveKeys } from "./sync/keys";
import { encryptRecord, RECORD_VERSION } from "./sync/record-codec";
import { clearAllShadows, getShadow, isDirty, setShadow } from "./sync/shadow-store";

vi.mock("./sync/realtime-nudge", () => ({ broadcastSyncNudge: vi.fn(async () => undefined) }));

type RelayRow = {
  collection: string;
  rid: string;
  version: number;
  seq: number;
  payload: string;
  deleted: boolean;
  updatedAt: string;
};

const SYNC_KEY = "ABCDEFGHIJKLMNOPQRST";

describe("sync engine real relay/storage path", () => {
  let state: Record<string, any>;
  let localPlaylists: Array<Record<string, unknown>>;
  let wirePushes: Array<Record<string, any>>;
  let pullRequests: Array<Record<string, any>>;
  let remoteRows: RelayRow[];
  let conflictingRemoteRow: RelayRow | null;
  let conflictNextPush: boolean;
  let claimAccepted: boolean;
  let claimRequests: Array<Record<string, any>>;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    await clearAllShadows();
    state = {
      yph_sync_config: {
        syncKey: SYNC_KEY,
        backends: ["relay"],
        syncIntervalMinutes: 0,
        relayUrl: "https://relay.test",
        relayAnonKey: "test-anon-key",
        content: { playlists: true, settings: false, history: false },
        lastSeq: 0,
        syncConfigVersion: 2,
        syncProtocolVersion: 2,
        legacyV2AcknowledgedAt: null,
      },
      yph_sync_device_id: "device-a",
      local_yt_history: {},
    };
    localPlaylists = [
      {
        id: "playlist-a",
        title: "PLAINTEXT_SECRET_TITLE",
        videos: [],
        createdAt: 1,
        updatedAt: 1,
        revision: 1,
      },
    ];
    wirePushes = [];
    pullRequests = [];
    remoteRows = [];
    conflictingRemoteRow = null;
    conflictNextPush = false;
    claimAccepted = true;
    claimRequests = [];

    const localStorage = {
      get: async (keys?: string | string[]) => {
        const list = keys === undefined ? Object.keys(state) : Array.isArray(keys) ? keys : [keys];
        const result = Object.fromEntries(
          list.filter((key) => key in state).map((key) => [key, structuredClone(state[key])])
        );
        if (list.includes("yph_local_playlists")) {
          result.yph_local_playlists = structuredClone(localPlaylists);
        }
        if (list.includes("yph_library_revision")) {
          result.yph_library_revision = state.yph_library_revision ?? 1;
        }
        return result;
      },
      set: async (values: Record<string, unknown>) => {
        Object.assign(state, structuredClone(values));
      },
      remove: async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key];
      },
    };
    const browser = {
      runtime: {
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
        sendMessage: vi.fn(),
      },
      storage: {
        local: localStorage,
        sync: {
          set: async (values: Record<string, unknown>) =>
            Object.assign(state, structuredClone(values)),
          remove: localStorage.remove,
        },
        onChanged: { addListener: vi.fn() },
      },
      alarms: {
        clear: vi.fn(),
        create: vi.fn(),
        onAlarm: { addListener: vi.fn() },
      },
    };
    const window = {
      getPlaylists: async () => structuredClone(localPlaylists),
      getSettings: async () => ({}),
      mutateLibrary: async (operation: { playlists: Array<Record<string, unknown>> }) => {
        localPlaylists = structuredClone(operation.playlists);
      },
      storeObject: async (key: string, value: unknown) => {
        state[key] = structuredClone(value);
      },
      removeObject: async (key: string) => {
        delete state[key];
      },
    };
    vi.stubGlobal("browser", browser);
    vi.stubGlobal("window", window);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.endsWith("/sync_claim")) {
        claimRequests.push(body);
        return jsonResponse(claimAccepted);
      }
      if (url.endsWith("/sync_pull")) {
        pullRequests.push(body);
        return jsonResponse(remoteRows.filter((row) => row.seq > body.p_since_seq));
      }
      if (url.endsWith("/sync_push")) {
        wirePushes.push(body);
        if (conflictNextPush && conflictingRemoteRow) {
          conflictNextPush = false;
          remoteRows = [conflictingRemoteRow];
          return jsonResponse(
            (body.p_records as Array<Record<string, any>>).map((record) => ({
              collection: record.collection,
              rid: record.rid,
              status: record.collection === "playlists" ? "conflict" : "ok",
            }))
          );
        }
        return jsonResponse(
          (body.p_records as Array<Record<string, any>>).map((record) => ({
            collection: record.collection,
            rid: record.rid,
            status: "ok",
          }))
        );
      }
      throw new Error(`Unexpected relay request: ${url}`);
    });
  });

  afterEach(async () => {
    await clearAllShadows();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("encrypts real dirty records before relay push and acknowledges only returned ok results", async () => {
    const { runOnce } = await import("./sync-engine");
    const result = await runOnce();
    const pushedRecords = wirePushes.flatMap(
      (push) => push.p_records as Array<Record<string, any>>
    );
    const playlistRecord = pushedRecords.find((record) => record.collection === "playlists");

    expect(result.phase).toBe("idle");
    expect(pushedRecords.length).toBeGreaterThan(0);
    expect(playlistRecord).toBeDefined();
    expect(typeof playlistRecord?.version).toBe("number");
    expect(JSON.stringify(wirePushes)).not.toContain("PLAINTEXT_SECRET_TITLE");
    const encryptedPayload = JSON.parse(playlistRecord?.payload ?? "null");
    expect(encryptedPayload).toMatchObject({
      v: RECORD_VERSION,
      collection: "playlists",
      deleted: false,
    });
    expect(typeof encryptedPayload.ciphertext).toBe("string");
    expect(typeof encryptedPayload.nonce).toBe("string");
    expect(encryptedPayload.data).toBeUndefined();
    expect(await isDirty("playlists", "playlist-a", localPlaylists[0])).toBe(false);
    expect((await getShadow("playlists", "playlist-a"))?.baseCopy).toEqual(localPlaylists[0]);
  });

  it("blocks an unverified legacy relay config before any remote request or local apply", async () => {
    const legacyConfig = {
      syncKey: SYNC_KEY,
      backend: "relay",
      syncRevision: 4,
      lastSyncedAt: 1234,
      lastSeq: 0,
      content: { playlists: true, settings: false, history: false },
    };
    state.yph_sync_config = legacyConfig;
    const originalPlaylists = structuredClone(localPlaylists);

    const { runOnce } = await import("./sync-engine");
    const result = await runOnce();

    expect(result.phase).toBe("paused");
    expect(result.lastError).toMatch(/backup|legacy/i);
    expect(claimRequests).toHaveLength(0);
    expect(pullRequests).toHaveLength(0);
    expect(wirePushes).toHaveLength(0);
    expect(localPlaylists).toEqual(originalPlaylists);
    expect(state.yph_sync_config).toEqual(legacyConfig);
  });

  it("runs an acknowledged legacy config and marks it current only after successful sync", async () => {
    state.yph_sync_config = {
      syncKey: SYNC_KEY,
      backend: "relay",
      syncRevision: 4,
      lastSyncedAt: 1234,
      lastSeq: 0,
      legacyV2AcknowledgedAt: 2345,
      content: { playlists: true, settings: false, history: false },
    };

    const { runOnce } = await import("./sync-engine");
    const result = await runOnce();

    expect(result.phase).toBe("idle");
    expect(claimRequests).toHaveLength(1);
    expect(state.yph_sync_config.syncConfigVersion).toBe(2);
    expect(state.yph_sync_config.syncProtocolVersion).toBe(2);
  });

  it("stops before pulling when the relay rejects the space claim", async () => {
    claimAccepted = false;

    const { runOnce } = await import("./sync-engine");
    const result = await runOnce();

    expect(result.phase).toBe("error");
    expect(result.lastError).toMatch(/claim was rejected/i);
    expect(pullRequests).toHaveLength(0);
    expect(wirePushes).toHaveLength(0);
  });

  it("pulls and merges a remote winner after a push conflict instead of surfacing a hard error", async () => {
    const playlistRid = await computeRecordId(SYNC_KEY, "playlists", "playlist-a");
    const encrypted = await encryptRecord(
      {
        v: RECORD_VERSION,
        collection: "playlists",
        id: playlistRid,
        hlc: 200,
        deleted: false,
        data: {
          id: "playlist-a",
          title: "REMOTE_CONCURRENT_TITLE",
          videos: [],
          createdAt: 1,
          updatedAt: 2,
          revision: 2,
        },
      },
      await deriveKeys(SYNC_KEY)
    );
    conflictingRemoteRow = {
      collection: "playlists",
      rid: playlistRid,
      version: 200,
      seq: 1,
      payload: JSON.stringify(encrypted),
      deleted: false,
      updatedAt: new Date(200).toISOString(),
    };
    conflictNextPush = true;

    const { runOnce } = await import("./sync-engine");
    const result = await runOnce();

    expect(pullRequests.map((request) => request.p_since_seq)).toEqual([0, 0]);
    expect(localPlaylists[0].title).toBe("REMOTE_CONCURRENT_TITLE");
    expect(result.failedCount).toBe(0);
    expect(result.lastError).toBeNull();
    expect(state.yph_sync_config.lastSeq).toBe(1);
  });

  it("retries a merged local winner after fetching the conflicting remote record", async () => {
    localPlaylists[0].updatedAt = 3;
    const playlistRid = await computeRecordId(SYNC_KEY, "playlists", "playlist-a");
    const encrypted = await encryptRecord(
      {
        v: RECORD_VERSION,
        collection: "playlists",
        id: playlistRid,
        hlc: 200,
        deleted: false,
        data: {
          id: "playlist-a",
          title: "REMOTE_OLDER_TITLE",
          videos: [],
          createdAt: 1,
          updatedAt: 2,
          revision: 2,
        },
      },
      await deriveKeys(SYNC_KEY)
    );
    conflictingRemoteRow = {
      collection: "playlists",
      rid: playlistRid,
      version: 200,
      seq: 1,
      payload: JSON.stringify(encrypted),
      deleted: false,
      updatedAt: new Date(200).toISOString(),
    };
    conflictNextPush = true;

    const { runOnce } = await import("./sync-engine");
    const result = await runOnce();

    expect(pullRequests.map((request) => request.p_since_seq)).toEqual([0, 0]);
    expect(wirePushes).toHaveLength(2);
    const retried = wirePushes[1].p_records.find(
      (record: Record<string, any>) => record.collection === "playlists"
    );
    expect(retried).toBeDefined();
    expect(retried.version).toBeGreaterThan(200);
    expect(result.failedCount).toBe(0);
    expect(result.lastError).toBeNull();
    expect(await isDirty("playlists", "playlist-a", localPlaylists[0])).toBe(false);
  });

  it("does not overwrite a conflict when its remote payload cannot be applied", async () => {
    const playlistRid = await computeRecordId(SYNC_KEY, "playlists", "playlist-a");
    conflictingRemoteRow = {
      collection: "playlists",
      rid: playlistRid,
      version: 200,
      seq: 1,
      payload: "not-an-encrypted-envelope",
      deleted: false,
      updatedAt: new Date(200).toISOString(),
    };
    conflictNextPush = true;

    const { runOnce } = await import("./sync-engine");
    const result = await runOnce();

    expect(pullRequests.map((request) => request.p_since_seq)).toEqual([0, 0]);
    expect(wirePushes).toHaveLength(1);
    expect(localPlaylists[0].title).toBe("PLAINTEXT_SECRET_TITLE");
    expect(result.failedCount).toBeGreaterThan(0);
    expect(await isDirty("playlists", "playlist-a", localPlaylists[0])).toBe(true);
    expect(state.yph_sync_config.lastSeq).toBe(0);
  });

  it("preserves device records across incremental pulls", async () => {
    const { runAdapterPass } = await import("./sync-engine-adapters");
    const storage = {
      get: async (key: string) => ({ [key]: structuredClone(state[key]) }),
      set: async (values: Record<string, unknown>) => {
        Object.assign(state, structuredClone(values));
      },
    };
    const makeDeviceRow = async (
      deviceId: string,
      version: number,
      seq: number
    ): Promise<RelayRow> => {
      const rid = await computeRecordId(SYNC_KEY, "devices", deviceId);
      const encrypted = await encryptRecord(
        {
          v: RECORD_VERSION,
          collection: "devices",
          id: rid,
          hlc: version,
          deleted: false,
          data: { deviceId, platform: "test", userAgent: "test-agent", lastSeen: version },
        },
        await deriveKeys(SYNC_KEY)
      );
      return {
        collection: "devices",
        rid,
        version,
        seq,
        payload: JSON.stringify(encrypted),
        deleted: false,
        updatedAt: new Date(version).toISOString(),
      };
    };
    const context = {
      syncKey: SYNC_KEY,
      localDeviceId: "local-device",
      relayConfig: { url: "https://relay.test", anonKey: "test-anon-key" },
      space: "space-test",
      authHash: "auth-test",
      sinceSeq: 0,
      storage,
      cfg: state.yph_sync_config,
    };

    await runAdapterPass({ ...context, incoming: [await makeDeviceRow("remote-a", 100, 1)] });
    await runAdapterPass({ ...context, incoming: [await makeDeviceRow("remote-b", 200, 2)] });

    expect(
      state.yph_sync_devices.map((device: { deviceId: string }) => device.deviceId).sort()
    ).toEqual(["remote-a", "remote-b"]);
  });

  it("clears stale unbound shadows (e.g. after switching relay endpoint or key) and uploads all local playlists", async () => {
    // Simulate a leftover shadow from a previous endpoint/key where baseHash matches localPlaylists[0].
    await setShadow("playlists", "playlist-a", localPlaylists[0], 50, "device-a");
    expect(await isDirty("playlists", "playlist-a", localPlaylists[0])).toBe(false);

    const { runOnce } = await import("./sync-engine");
    const result = await runOnce();

    const pushedPlaylists = wirePushes
      .flatMap((push) => push.p_records as Array<Record<string, any>>)
      .filter((r) => r.collection === "playlists");
    expect(result.phase).toBe("idle");
    expect(pushedPlaylists).toHaveLength(1);
    expect(result.pushedCount).toBeGreaterThanOrEqual(1);
  });

  it("syncs string[] playlists, keyless-videoId history, and pinned favorites end-to-end across two devices without re-pull loops", async () => {
    // Shared in-memory relay table for Firefox -> Chrome round-trip.
    let seqCounter = 0;
    const cloudRecords = new Map<string, RelayRow>();

    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.endsWith("/sync_claim")) return jsonResponse(true);
      if (url.endsWith("/sync_pull")) {
        pullRequests.push(body);
        const rows = [...cloudRecords.values()]
          .filter((r) => r.seq > body.p_since_seq)
          .sort((a, b) => a.seq - b.seq);
        return jsonResponse(rows);
      }
      if (url.endsWith("/sync_push")) {
        wirePushes.push(body);
        const out = (body.p_records as Array<Record<string, any>>).map((rec) => {
          seqCounter += 1;
          cloudRecords.set(`${rec.collection}|${rec.rid}`, {
            collection: rec.collection,
            rid: rec.rid,
            version: rec.version,
            seq: seqCounter,
            payload: rec.payload,
            deleted: !!rec.deleted,
            updatedAt: new Date().toISOString(),
          });
          return {
            collection: rec.collection,
            rid: rec.rid,
            status: "ok",
            current_version: rec.version,
          };
        });
        return jsonResponse(out);
      }
      throw new Error(`Unexpected relay request: ${url}`);
    });

    // Device 1 (Firefox) in background service worker mode (no window.getSettings / storeObject)
    state.yph_sync_config.content = { playlists: true, settings: true, history: true };
    state.favoritePlaylistIds = ["local-fav-1"];
    state.themeChoice = "dark";
    state.local_yt_history = {
      dQw4w9WgXcQ: {
        title: "Rick Astley",
        channel: "RickAstleyVEVO",
        timestamp: 42,
        duration: 212,
        isCompleted: false,
        lastWatchedAt: 1700000000000,
      },
    };
    localPlaylists = [
      {
        id: "local-fav-1",
        title: "Pinned Favorites",
        videos: ["dQw4w9WgXcQ", "9bZkp7q19f0"],
        timestamp: 1700000000000,
        updatedAt: "2026-11-04T22:00:00.000Z",
        revision: 1,
      },
    ];
    (globalThis as any).window = {
      mutateLibrary: async (op: { playlists: Array<Record<string, unknown>> }) => {
        localPlaylists = structuredClone(op.playlists);
      },
    };

    const engine1 = await import("./sync-engine");
    const firefoxSync = await engine1.runOnce();
    expect(firefoxSync.phase).toBe("idle");
    expect(firefoxSync.pushedCount).toBe(5); // 1 playlist + 1 history + 2 settings + 1 device

    // Device 2 (Chrome): fresh storage, empty playlists/history, no persisted settings
    await clearAllShadows();
    vi.resetModules();
    delete state.favoritePlaylistIds;
    delete state.themeChoice;
    state.yph_sync_device_id = "device-b";
    state.local_yt_history = {};
    state.yph_sync_devices = [];
    state.yph_sync_config = {
      syncKey: SYNC_KEY,
      backends: ["relay"],
      syncIntervalMinutes: 0,
      relayUrl: "https://relay.test",
      relayAnonKey: "test-anon-key",
      content: { playlists: true, settings: true, history: true },
      lastSeq: 0,
      syncConfigVersion: 2,
      syncProtocolVersion: 2,
      legacyV2AcknowledgedAt: null,
    };
    localPlaylists = [];
    let mutateCalls = 0;
    (globalThis as any).window = {
      mutateLibrary: async (op: { playlists: Array<Record<string, unknown>> }) => {
        mutateCalls += 1;
        localPlaylists = structuredClone(op.playlists);
      },
    };

    const engine2 = await import("./sync-engine");
    const chromeSync1 = await engine2.runOnce();
    expect(chromeSync1.phase).toBe("idle");
    expect(chromeSync1.failedCount).toBe(0);
    expect(localPlaylists).toHaveLength(1);
    expect(localPlaylists[0].id).toBe("local-fav-1");
    expect(localPlaylists[0].videos).toEqual(["dQw4w9WgXcQ", "9bZkp7q19f0"]);
    expect(state.favoritePlaylistIds).toEqual(["local-fav-1"]);
    expect(state.themeChoice).toBe("dark");
    expect(state.local_yt_history.dQw4w9WgXcQ).toMatchObject({
      videoId: "dQw4w9WgXcQ",
      title: "Rick Astley",
      timestamp: 42,
    });
    expect(mutateCalls).toBe(1);

    // Second Chrome sync: cursor advances past Device B's own device push and performs 0 storage mutations!
    pullRequests = [];
    const chromeSync2 = await engine2.runOnce();
    expect(chromeSync2.phase).toBe("idle");
    expect(mutateCalls).toBe(1); // MUST NOT re-write playlists when nothing changed!
    expect(state.yph_sync_config.lastSeq).toBe(seqCounter);

    // Third Chrome sync: 0 records pulled at all (`p_since_seq === seqCounter`)!
    pullRequests = [];
    const chromeSync3 = await engine2.runOnce();
    expect(pullRequests[0].p_since_seq).toBe(seqCounter);
    expect(chromeSync3.pulledCount).toBe(0);
    expect(chromeSync3.pushedCount).toBe(0);
  });
});

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => value,
    text: async () => JSON.stringify(value),
  } as Response;
}
