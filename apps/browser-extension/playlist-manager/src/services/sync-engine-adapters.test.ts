import { afterEach, describe, expect, it, vi } from "vitest";
import { acknowledgePushedCandidates, runAdapterPass } from "./sync-engine-adapters";
import { computeRecordId, deriveKeys } from "./sync/keys";
import { encryptRecord, RECORD_VERSION } from "./sync/record-codec";
import { setShadow } from "./sync/shadow-store";

afterEach(() => vi.unstubAllGlobals());

describe("runAdapterPass", () => {
  it("returns local device candidates when optional collections are disabled", async () => {
    const result = await runAdapterPass({
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      localDeviceId: "device-test",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: false, history: false, settings: false } },
    });

    expect(result.failed).toEqual([]);
    expect(result.allDirty).toHaveLength(1);
    expect(result.allDirty[0].collection).toBe("devices");
  });

  it("reads the authoritative local playlist store in the background worker", async () => {
    const localPlaylist = {
      id: "stored-local-playlist",
      title: "Stored locally",
      videos: [],
      createdAt: 1,
      updatedAt: 1,
      revision: 1,
    };
    const state = {
      yph_local_playlists: [localPlaylist],
      yph_library_revision: 4,
      local_yt_history: {},
    };
    await setShadow("playlists", localPlaylist.id, localPlaylist, 100, "worker-device");
    vi.stubGlobal("window", {
      getPlaylists: async () => [],
      getSettings: async () => ({}),
    });
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async (keys: string | string[]) =>
            Object.fromEntries(
              (Array.isArray(keys) ? keys : [keys])
                .filter((key) => key in state)
                .map((key) => [key, state[key as keyof typeof state]])
            ),
          set: async () => undefined,
        },
      },
    });

    const result = await runAdapterPass({
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      localDeviceId: "worker-device",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: true, settings: false, history: false } },
    });

    expect(result.dirtyCandidates.some((candidate) => candidate.collection === "playlists")).toBe(
      false
    );
  });

  it("collects enabled history without failing on its shadow lookup", async () => {
    vi.stubGlobal("window", {
      getPlaylists: async () => [],
      getSettings: async () => ({}),
    });
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({ local_yt_history: {} }),
          set: async () => undefined,
        },
      },
    });

    const result = await runAdapterPass({
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      localDeviceId: "history-device-test",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: false, history: true, settings: false } },
    });

    expect(result.failed).toEqual([]);
  });

  it("collects enabled settings without failing on its shadow lookup", async () => {
    vi.stubGlobal("window", {
      getPlaylists: async () => [],
      getSettings: async () => ({}),
    });
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({ local_yt_history: {} }),
          set: async () => undefined,
        },
      },
    });

    const result = await runAdapterPass({
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      localDeviceId: "settings-device-test",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: false, history: false, settings: true } },
    });

    expect(result.failed).toEqual([]);
  });

  it("keeps a local playlist dirty until the relay acknowledges its push", async () => {
    const playlist = {
      id: "playlist-pending-test",
      title: "Private title must not leave the device in plaintext",
      videos: [],
      createdAt: 1,
      updatedAt: 1,
      revision: 1,
    };
    vi.stubGlobal("window", {
      getPlaylists: async () => [playlist],
      getSettings: async () => ({}),
    });
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({
            yph_local_playlists: [playlist],
            yph_library_revision: 1,
            local_yt_history: {},
          }),
          set: async () => undefined,
        },
      },
    });
    const ctx = {
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      localDeviceId: "pending-device-test",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: true, history: false, settings: false } },
    };

    await runAdapterPass(ctx);
    const retry = await runAdapterPass(ctx);

    expect(retry.allDirty.some((record) => record.collection === "playlists")).toBe(true);
    expect(
      retry.allDirty.find((record) => record.collection === "playlists")?.payload
    ).not.toContain(playlist.title);
  });

  it("does not acknowledge a candidate when the relay reports a conflict", async () => {
    const playlist = {
      id: "playlist-conflict-test",
      title: "Conflict title",
      videos: [],
      createdAt: 1,
      updatedAt: 1,
      revision: 1,
    };
    vi.stubGlobal("window", {
      getPlaylists: async () => [playlist],
      getSettings: async () => ({}),
    });
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({
            yph_local_playlists: [playlist],
            yph_library_revision: 1,
            local_yt_history: {},
          }),
          set: async () => undefined,
        },
      },
    });
    const ctx = {
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      localDeviceId: "conflict-device-test",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: true, history: false, settings: false } },
    };

    const first = await runAdapterPass(ctx);
    const results = first.dirtyCandidates.map((candidate) => ({
      collection: candidate.record.collection,
      rid: candidate.record.rid,
      status: candidate.collection === "playlists" ? ("conflict" as const) : ("ok" as const),
    }));
    const failed = await acknowledgePushedCandidates(
      first.dirtyCandidates,
      results,
      ctx.localDeviceId
    );
    const retry = await runAdapterPass(ctx);

    expect(failed).toEqual(expect.arrayContaining([expect.stringMatching(/conflict/i)]));
    expect(retry.allDirty.some((record) => record.collection === "playlists")).toBe(true);
  });

  it("acknowledges a local playlist only when its matching relay result is ok", async () => {
    const playlist = {
      id: "playlist-ack-test",
      title: "Acknowledged title",
      videos: [],
      createdAt: 1,
      updatedAt: 1,
      revision: 1,
    };
    vi.stubGlobal("window", {
      getPlaylists: async () => [playlist],
      getSettings: async () => ({}),
    });
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({
            yph_local_playlists: [playlist],
            yph_library_revision: 1,
            local_yt_history: {},
          }),
          set: async () => undefined,
        },
      },
    });
    const ctx = {
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      localDeviceId: "ack-device-test",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: true, history: false, settings: false } },
    };
    const first = await runAdapterPass(ctx);
    const results = first.dirtyCandidates.map((candidate) => ({
      collection: candidate.record.collection,
      rid: candidate.record.rid,
      status: "ok" as const,
    }));

    const failed = await acknowledgePushedCandidates(
      first.dirtyCandidates,
      results,
      ctx.localDeviceId
    );
    const next = await runAdapterPass(ctx);

    expect(failed).toEqual([]);
    expect(next.allDirty.some((record) => record.collection === "playlists")).toBe(false);
  });

  it("rejects duplicate relay results without acknowledging the candidate", async () => {
    const playlist = {
      id: "playlist-duplicate-result-test",
      title: "Duplicate result title",
      videos: [],
      createdAt: 1,
      updatedAt: 1,
      revision: 1,
    };
    vi.stubGlobal("window", {
      getPlaylists: async () => [playlist],
      getSettings: async () => ({}),
    });
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({
            yph_local_playlists: [playlist],
            yph_library_revision: 1,
            local_yt_history: {},
          }),
          set: async () => undefined,
        },
      },
    });
    const ctx = {
      syncKey: "ABCDEFGHIJKLMNOPQRST",
      localDeviceId: "duplicate-result-device",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: true, history: false, settings: false } },
    };
    const first = await runAdapterPass(ctx);
    const candidate = first.dirtyCandidates.find((item) => item.collection === "playlists");
    expect(candidate).toBeDefined();
    if (!candidate) throw new Error("expected a playlist candidate");
    const result = {
      collection: candidate.record.collection,
      rid: candidate.record.rid,
      status: "ok" as const,
    };

    const failed = await acknowledgePushedCandidates(
      [candidate],
      [result, result],
      ctx.localDeviceId
    );
    const retry = await runAdapterPass(ctx);

    expect(failed).toEqual(
      expect.arrayContaining([expect.stringMatching(/duplicate|exactly one/i)])
    );
    expect(retry.allDirty.some((record) => record.collection === "playlists")).toBe(true);
  });

  it("removes a remotely deleted setting from the real storage path", async () => {
    const syncKey = "ABCDEFGHIJKLMNOPQRST";
    const rid = await computeRecordId(syncKey, "settings", "themeChoice");
    const encrypted = await encryptRecord(
      {
        v: RECORD_VERSION,
        collection: "settings",
        id: rid,
        hlc: 200,
        deleted: true,
        data: { key: "themeChoice", value: "dark" },
      },
      await deriveKeys(syncKey)
    );
    const stored: Record<string, unknown> = {
      themeChoice: "dark",
      localOnlyPreference: "keep",
      local_yt_history: {},
    };
    vi.stubGlobal("window", {
      getPlaylists: async () => [],
      getSettings: async () => ({
        themeChoice: stored.themeChoice,
        localOnlyPreference: stored.localOnlyPreference,
      }),
      storeObject: async (key: string, value: unknown) => {
        stored[key] = value;
      },
      removeObject: async (key: string) => {
        delete stored[key];
      },
    });
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async (keys: string | string[]) =>
            Object.fromEntries(
              (Array.isArray(keys) ? keys : [keys]).map((key) => [key, stored[key]])
            ),
          set: async (values: Record<string, unknown>) => Object.assign(stored, values),
          remove: async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key];
          },
        },
      },
    });
    await setShadow("settings", "themeChoice", "dark", 100, "settings-delete-device");

    const result = await runAdapterPass({
      syncKey,
      localDeviceId: "settings-delete-device",
      relayConfig: { url: "https://relay.invalid", anonKey: "test-key" },
      space: "space-test",
      authHash: "auth-test",
      incoming: [
        {
          collection: "settings",
          rid,
          version: 200,
          seq: 1,
          payload: JSON.stringify(encrypted),
          deleted: true,
        },
      ],
      sinceSeq: 0,
      storage: { get: async () => undefined, set: async () => undefined },
      cfg: { content: { playlists: false, history: false, settings: true } },
    });

    expect(result.failed).toEqual([]);
    expect(stored).not.toHaveProperty("themeChoice");
    expect(stored.localOnlyPreference).toBe("keep");
  });
});
