import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAllShadows } from "./sync/shadow-store";

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

type DeviceState = {
  deviceId: string;
  storage: Record<string, any>;
  playlists: Array<Record<string, any>>;
};

const SHARED_SYNC_KEY = "ABCDEFGHIJKLMNOPQRST";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeDevice(
  deviceId: string,
  playlists: Array<Record<string, any>>,
  history: Record<string, any> = {},
  settings: Record<string, any> = {}
): DeviceState {
  return {
    deviceId,
    playlists: structuredClone(playlists),
    storage: {
      ...structuredClone(settings),
      yph_sync_device_id: deviceId,
      yph_library_revision: 1,
      local_yt_history: structuredClone(history),
      yph_sync_config: {
        syncKey: SHARED_SYNC_KEY,
        backends: ["relay"],
        syncIntervalMinutes: 0,
        relayUrl: "https://relay.test",
        relayAnonKey: "test-anon-key",
        content: { playlists: true, settings: true, history: true },
        lastSeq: 0,
        syncConfigVersion: 2,
        syncProtocolVersion: 2,
        legacyV2AcknowledgedAt: null,
      },
    },
  };
}

describe("Firefox <-> Chrome 25-playlist initial merge over shared relay", () => {
  const originalWindowDesc = Object.getOwnPropertyDescriptor(globalThis, "window");

  afterEach(async () => {
    if (originalWindowDesc) {
      Object.defineProperty(globalThis, "window", originalWindowDesc);
    } else {
      delete (globalThis as any).window;
    }
    await clearAllShadows();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uploads all 25 Firefox playlists + history and converges both Chrome and Firefox to 26 playlists", async () => {
    const relayStore = new Map<string, RelayRow>();
    let nextSeq = 0;

    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.endsWith("/sync_claim")) {
        return jsonResponse(true);
      }
      if (url.endsWith("/sync_pull")) {
        const since = Number(body.p_since_seq ?? 0);
        const rows = Array.from(relayStore.values())
          .filter((r) => r.seq > since)
          .sort((a, b) => a.seq - b.seq);
        return jsonResponse(rows);
      }
      if (url.endsWith("/sync_push")) {
        const incoming = (body.p_records ?? []) as Array<Record<string, any>>;
        const acks = incoming.map((rec) => {
          const key = `${rec.collection}|${rec.rid}`;
          nextSeq += 1;
          relayStore.set(key, {
            collection: rec.collection,
            rid: rec.rid,
            version: Number(rec.version ?? 1),
            seq: nextSeq,
            payload: String(rec.payload),
            deleted: Boolean(rec.deleted),
            updatedAt: new Date().toISOString(),
          });
          return { collection: rec.collection, rid: rec.rid, status: "ok", seq: nextSeq };
        });
        return jsonResponse(acks);
      }
      throw new Error(`Unexpected relay fetch: ${url}`);
    });

    async function runDeviceSync(device: DeviceState, spiderMonkeyWindowGetter: boolean) {
      vi.resetModules();
      await clearAllShadows();

      const localStorage = {
        get: async (keys?: string | string[]) => {
          const allKeys = [...Object.keys(device.storage), "yph_local_playlists"];
          const list = keys === undefined ? allKeys : Array.isArray(keys) ? keys : [keys];
          const res: Record<string, any> = {};
          for (const k of list) {
            if (k === "yph_local_playlists") {
              res.yph_local_playlists = structuredClone(device.playlists);
            } else if (k in device.storage) {
              res[k] = structuredClone(device.storage[k]);
            }
          }
          return res;
        },
        set: async (values: Record<string, unknown>) => {
          if ("yph_local_playlists" in values) {
            device.playlists = structuredClone(values.yph_local_playlists as any[]);
          }
          Object.assign(device.storage, structuredClone(values));
        },
        remove: async (keys: string | string[]) => {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete device.storage[k];
        },
      };

      const browserApi: Record<string, any> = {
        runtime: {
          ...(spiderMonkeyWindowGetter
            ? { getBrowserInfo: async () => ({ name: "Firefox" }) }
            : {}),
          onStartup: { addListener: vi.fn() },
          onMessage: { addListener: vi.fn() },
          sendMessage: vi.fn(async (msg: any) => {
            if (msg?.cmd === "mutate-library" && msg?.operation?.type === "replace") {
              device.playlists = structuredClone(msg.operation.playlists);
              device.storage.yph_library_revision = (device.storage.yph_library_revision ?? 1) + 1;
              return { ok: true, result: { revision: device.storage.yph_library_revision } };
            }
            return undefined;
          }),
        },
        storage: {
          local: localStorage,
          sync: {
            get: async () => ({}),
            set: async (values: Record<string, unknown>) => {
              Object.assign(device.storage, structuredClone(values));
            },
            remove: localStorage.remove,
          },
          onChanged: { addListener: vi.fn() },
        },
        alarms: { clear: vi.fn(), create: vi.fn(), onAlarm: { addListener: vi.fn() } },
      };

      vi.stubGlobal("browser", browserApi);
      if (spiderMonkeyWindowGetter) {
        const ffWin: Record<string, any> = {};
        Object.defineProperty(globalThis, "window", {
          get: () => ffWin,
          set: undefined,
          configurable: true,
        });
      } else {
        Object.defineProperty(globalThis, "window", {
          value: {},
          writable: true,
          configurable: true,
        });
      }

      const engine = await import("./sync-engine");
      return engine.runOnce();
    }

    const chromeDevice = makeDevice(
      "device-chrome",
      [
        {
          id: "chrome-pl-1",
          title: "Chrome Starter Playlist",
          videos: ["dQw4w9WgXcQ"],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      {},
      { yph_theme: "dark" }
    );

    const firefoxPlaylists = Array.from({ length: 25 }, (_, i) => ({
      id: `ff-pl-${i + 1}`,
      title: `Firefox Playlist #${i + 1}`,
      videos: [
        `vid_${String(i + 1).padStart(2, "0")}_aaaa`,
        `vid_${String(i + 1).padStart(2, "0")}_bbbb`,
      ],
      createdAt: 2000 + i,
      updatedAt: 2000 + i,
    }));
    const firefoxHistory = {
      h9999999999: {
        title: "Firefox Watched Video",
        channel: "Firefox Channel",
        timestamp: 42,
        duration: 180,
        isCompleted: false,
        lastWatchedAt: 5000,
      },
    };
    const firefoxDevice = makeDevice("device-firefox", firefoxPlaylists, firefoxHistory, {
      favoritePlaylistIds: ["ff-pl-1"],
    });

    // 1. Chrome syncs its 1 playlist first
    const chromeFirst = await runDeviceSync(chromeDevice, false);
    expect(chromeFirst.lastError).toBeNull();
    expect(chromeFirst.phase).toBe("idle");

    // 2. Firefox (with getter-only window + 25 string[] playlists + 1 history item) syncs
    const ffFirst = await runDeviceSync(firefoxDevice, true);
    expect(ffFirst.lastError).toBeNull();
    expect(ffFirst.phase).toBe("idle");
    expect(firefoxDevice.playlists).toHaveLength(26);
    const ffKnownDevices = new Set([
      firefoxDevice.deviceId,
      ...(firefoxDevice.storage.yph_sync_devices ?? []).map((d: any) => d.deviceId),
    ]);
    expect(ffKnownDevices.size).toBe(2);

    // 3. Chrome syncs again and receives all 25 Firefox playlists + 1 history item + pinned setting
    const chromeSecond = await runDeviceSync(chromeDevice, false);
    expect(chromeSecond.lastError).toBeNull();
    expect(chromeSecond.phase).toBe("idle");
    expect(chromeDevice.playlists).toHaveLength(26);
    expect(Object.keys(chromeDevice.storage.local_yt_history)).toEqual(["h9999999999"]);
    expect(chromeDevice.storage.favoritePlaylistIds).toEqual(["ff-pl-1"]);
    const chromeKnownDevices = new Set([
      chromeDevice.deviceId,
      ...(chromeDevice.storage.yph_sync_devices ?? []).map((d: any) => d.deviceId),
    ]);
    expect(chromeKnownDevices.size).toBe(2);
  });
});
