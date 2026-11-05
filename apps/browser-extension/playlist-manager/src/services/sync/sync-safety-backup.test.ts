import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeRecordId, deriveKeys } from "./keys";
import { encryptRecord, RECORD_VERSION } from "./record-codec";
import { clearAllShadows, setShadow } from "./shadow-store";
import { applyRemotePlaylists } from "./adapters/playlists";
import { mergePlaylists } from "./merge/playlists";
import { runAdapterPass } from "../sync-engine-adapters";
import {
  captureSyncSafetyBackup,
  importSyncSafetyBackupJson,
  listSyncSafetyBackups,
  parseSafetyBackupJson,
  restoreSyncSafetyBackup,
  serializeSafetyBackupJson,
} from "./sync-safety-backup";

const SYNC_KEY = "ABCDEFGHIJKLMNOPQRST";

describe("sync zero-data-loss & forward-compatibility protections", () => {
  let state: Record<string, any>;
  let localPlaylists: Array<Record<string, any>>;

  beforeEach(async () => {
    await clearAllShadows();
    localPlaylists = [
      { id: "p1", title: "One", videos: ["v1", "v2"], revision: 1 },
      { id: "p2", title: "Two", videos: ["v3"], revision: 1 },
      { id: "p3", title: "Three", videos: ["v4"], revision: 1 },
    ];
    state = {
      yph_local_playlists: structuredClone(localPlaylists),
      yph_library_revision: 1,
      local_yt_history: {
        v1: { title: "Vid 1", timestamp: 30, duration: 100, lastWatchedAt: 1000 },
      },
      themeChoice: "dark",
      yph_sync_config: {
        syncKey: SYNC_KEY,
        backends: ["relay"],
        syncConfigVersion: 2,
        syncProtocolVersion: 2,
        lastSeq: 5,
      },
    };

    const storageLocal = {
      get: async (keys?: string | string[]) => {
        const list = keys === undefined ? Object.keys(state) : Array.isArray(keys) ? keys : [keys];
        const out: Record<string, any> = {};
        for (const k of list) {
          if (k === "yph_local_playlists") out[k] = structuredClone(localPlaylists);
          else if (k in state) out[k] = structuredClone(state[k]);
        }
        return out;
      },
      set: async (vals: Record<string, any>) => {
        Object.assign(state, structuredClone(vals));
      },
      remove: async (keys: string | string[]) => {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete state[k];
      },
    };

    vi.stubGlobal("browser", { storage: { local: storageLocal, sync: storageLocal } });
    vi.stubGlobal("window", {
      mutateLibrary: async (op: { playlists: Array<Record<string, any>> }) => {
        localPlaylists = structuredClone(op.playlists);
        state.yph_local_playlists = structuredClone(op.playlists);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures rolling local restore points and restores playlists, history, and settings", async () => {
    const snap1 = await captureSyncSafetyBackup("Before sync 1", { force: true });
    expect(snap1?.playlistsCount).toBe(3);
    expect(snap1?.videosCount).toBe(4);
    expect(snap1?.historyCount).toBe(1);

    // Simulate accidental modification / deletion locally
    localPlaylists = [];
    state.local_yt_history = {};
    state.themeChoice = "light";

    const restored = await restoreSyncSafetyBackup(snap1!.id);
    expect(restored.playlistsCount).toBe(3);
    expect(localPlaylists).toHaveLength(3);
    expect(Object.keys(state.local_yt_history)).toEqual(["v1"]);
    expect(state.themeChoice).toBe("dark");
    expect(state.yph_sync_config.lastSeq).toBe(0);

    const listed = await listSyncSafetyBackups();
    expect(listed).toHaveLength(1);
  });

  it("blocks automatic mass-deletion when remote tombstones would wipe >= 3 local playlists", async () => {
    const keys = await deriveKeys(SYNC_KEY);
    const tombstones = [];
    for (const p of localPlaylists) {
      await setShadow("playlists", p.id, p, 10, "dev-a");
      const rid = await computeRecordId(SYNC_KEY, "playlists", p.id);
      const enc = await encryptRecord(
        { v: RECORD_VERSION, collection: "playlists", id: rid, hlc: 20, deleted: true, data: p },
        keys
      );
      tombstones.push({ rid, payload: JSON.stringify(enc), deleted: true, version: 20 });
    }

    const outcome = await applyRemotePlaylists(
      {
        syncKey: SYNC_KEY,
        space: "sp",
        authHash: "ah",
        relayConfig: { url: "https://relay.test", anonKey: "k" },
        localDeviceId: "dev-a",
        librarySnapshot: async () => ({ playlists: localPlaylists, revision: 1 }),
        mutateLibrary: async (op: any) => {
          localPlaylists = op.playlists;
        },
      },
      tombstones
    );

    expect(outcome.applied).toBe(0);
    expect(outcome.failed.join(" ")).toMatch(/safety guard/i);
    expect(localPlaylists).toHaveLength(3);
  });

  it("preserves unknown future fields during 3-way playlist merges", () => {
    const base = [{ id: "p1", title: "Mix", videos: ["a"], updatedAt: 10, revision: 1 }];
    const local = [
      { id: "p1", title: "Mix Local", videos: ["a", "b"], updatedAt: 20, localTag: "keep-me" },
    ];
    const remote = [
      {
        id: "p1",
        title: "Mix",
        videos: ["a", "c"],
        updatedAt: 30,
        futureSchemaField: { color: "amber" },
      },
    ];

    const { merged } = mergePlaylists(local as any, remote as any, base as any);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Mix Local");
    expect(merged[0].videos).toEqual(["a", "c", "b"]);
    expect((merged[0] as any).futureSchemaField).toEqual({ color: "amber" });
    expect((merged[0] as any).localTag).toBe("keep-me");
  });

  it("defers future record versions and unknown collections without crashing or advancing cursor", async () => {
    const result = await runAdapterPass({
      syncKey: SYNC_KEY,
      localDeviceId: "dev-a",
      relayConfig: { url: "https://relay.test", anonKey: "k" },
      space: "sp",
      authHash: "ah",
      sinceSeq: 0,
      cfg: { content: { playlists: true, settings: true, history: true }, lastSyncedAt: null },
      storage: (globalThis as any).browser.storage.local,
      incoming: [
        {
          collection: "playlists",
          rid: "future-rid",
          version: 99,
          seq: 10,
          deleted: false,
          payload: JSON.stringify({ v: 3, ciphertext: "abc", nonce: "def" }),
        },
        {
          collection: "future_folders_v3",
          rid: "folder-1",
          version: 100,
          seq: 11,
          deleted: false,
          payload: "{}",
        },
      ],
    });

    expect(result.failed).toEqual([]);
    expect(result.cursorBlocked).toBe(true);
    expect(localPlaylists).toHaveLength(3);
  });

  it("exports, validates, and imports portable safety backup JSON files (#24)", async () => {
    const snap = await captureSyncSafetyBackup("Portable export", { force: true });
    const exportedJson = serializeSafetyBackupJson(snap!);

    expect(() => parseSafetyBackupJson("{bad-json")).toThrow(/not valid JSON/i);
    expect(() => parseSafetyBackupJson('{"schema":"wrong"}')).toThrow(/schema/i);

    // Wipe local state completely as if browser was reinstalled
    localPlaylists = [];
    state.local_yt_history = {};
    state.yph_sync_safety_backups = [];

    const imported = await importSyncSafetyBackupJson(exportedJson);
    expect(imported.playlistsCount).toBe(3);
    expect(localPlaylists).toHaveLength(3);
    expect(Object.keys(state.local_yt_history)).toEqual(["v1"]);
  });

  it("skips a single oversized playlist (>150 KB) while syncing remaining playlists (#33)", async () => {
    localPlaylists.push({
      id: "huge-pl",
      title: "Giant Archive",
      videos: ["v1"],
      giantNotes: "X".repeat(160_000),
      revision: 1,
    });

    const result = await runAdapterPass({
      syncKey: SYNC_KEY,
      localDeviceId: "dev-a",
      relayConfig: { url: "https://relay.test", anonKey: "k" },
      space: "sp",
      authHash: "ah",
      sinceSeq: 0,
      cfg: { content: { playlists: true, settings: true, history: true }, lastSyncedAt: 100 },
      storage: (globalThis as any).browser.storage.local,
      incoming: [],
    });

    expect(
      result.failed.some((msg) => msg.includes('"Giant Archive"') && msg.includes("150 KB"))
    ).toBe(true);
    const dirtyPlaylistIds = result.dirtyCandidates
      .filter((c) => c.collection === "playlists")
      .map((c) => c.recordId);
    expect(dirtyPlaylistIds).toEqual(["p1", "p2", "p3"]);
  });
});
