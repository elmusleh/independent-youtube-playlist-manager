import { describe, expect, it, vi, beforeEach } from "vitest";
import { EncryptedSyncService } from "./encrypted-sync-service";
import { generateSyncKey } from "./sync-key";

// Mock the Supabase client module so the service never touches the network.
vi.mock("../supabase-client", () => {
  const store = new Map<string, { blob: string; revision: number }>();
  const client = {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => {
            const row = store.get(val);
            return { data: row ? { blob: row.blob, revision: row.revision } : null, error: null };
          },
        }),
      }),
      update: (row: { address: string; blob: string; revision: number }) => ({
        eq: (_col: string, val: string) => ({
          lt: (_col2: string, rev: number) => ({
            select: (_cols: string) => {
              const existing = store.get(val);
              if (existing && existing.revision < rev) {
                store.set(val, { blob: row.blob, revision: row.revision });
                return Promise.resolve({ data: [{ address: val }], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          }),
        }),
      }),
      insert: async (row: { address: string; blob: string; revision: number }) => {
        if (store.has(row.address)) {
          return { error: { message: "duplicate" } };
        }
        store.set(row.address, { blob: row.blob, revision: row.revision });
        return { error: null };
      },
    }),
  };
  return {
    createAnonClient: () => client,
    getSession: async () => ({ user: { id: "test-user" } }),
  };
});

describe("EncryptedSyncService", () => {
  it("round-trips a snapshot through upload + download", async () => {
    const key = generateSyncKey();
    const service = new EncryptedSyncService("device-a");
    const source = { playlists: [{ id: "p1", title: "Hello", videos: ["v1"] }] };

    const up = await service.upload(key, source, { playlists: true }, 1);
    expect(up.pushed).toBe(true);

    const remote = await service.download(key);
    expect(remote).not.toBeNull();
    expect(remote!.revision).toBe(1);
    expect((remote!.payload as any).playlists).toEqual(source.playlists);
  });

  it("refuses to overwrite a newer remote revision", async () => {
    const key = generateSyncKey();
    const a = new EncryptedSyncService("device-a");
    const b = new EncryptedSyncService("device-b");

    await a.upload(key, { playlists: [{ id: "p1" }] }, { playlists: true }, 5);

    // device-b has an older revision; its upload should be a no-op
    const result = await b.upload(key, { playlists: [{ id: "p2" }] }, { playlists: true }, 3);
    expect(result.pushed).toBe(false);

    const updated = await b.upload(key, { playlists: [{ id: "p2" }] }, { playlists: true }, 5);
    expect(updated.pushed).toBe(false);

    const remote = await a.download(key);
    expect(remote!.revision).toBe(5);
    expect((remote!.payload as any).playlists).toEqual([{ id: "p1" }]);
  });

  it("reports a rejected equal-revision write as a conflict", async () => {
    const key = generateSyncKey();
    const firstDevice = new EncryptedSyncService("device-a");
    const secondDevice = new EncryptedSyncService("device-b");
    await firstDevice.upload(key, { playlists: [{ id: "first" }] }, { playlists: true }, 5);

    const result = await secondDevice.sync(
      key,
      { playlists: [{ id: "second" }] },
      { playlists: true },
      5
    );

    expect(result.success).toBe(false);
    expect(result.pushed).toBe(false);
    expect(result.error).toContain("rejected this write");
    expect(result.remoteRevision).toBe(5);
  });

  it("returns null when no snapshot exists", async () => {
    const key = generateSyncKey();
    const service = new EncryptedSyncService("device-x");
    const remote = await service.download(key);
    expect(remote).toBeNull();
  });

  it("fails to decrypt with a different key", async () => {
    const keyA = generateSyncKey();
    const keyB = generateSyncKey();
    const service = new EncryptedSyncService("device-a");
    await service.upload(keyA, { playlists: [{ id: "secret" }] }, { playlists: true }, 1);

    const remote = await service.download(keyB);
    expect(remote).toBeNull();
  });
});
