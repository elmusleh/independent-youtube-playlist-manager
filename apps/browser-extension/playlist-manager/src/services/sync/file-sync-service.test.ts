import { describe, expect, it } from "vitest";
import { FileSyncService } from "./file-sync-service";
import { deriveEncryptionKey, deriveStorageAddress } from "./key-derivation";
import { encryptSnapshot } from "./encryption-service";
import { createSnapshot, encodeSnapshot } from "./snapshot-codec";
import { generateSyncKey } from "./sync-key";

function makeDirectory() {
  const files = new Map<string, Uint8Array>();
  const handle = {
    getFileHandle: async (name: string, options?: { create?: boolean }) => {
      if (!files.has(name) && !options?.create) {
        const error = new Error("File not found") as Error & { name: string };
        error.name = "NotFoundError";
        throw error;
      }
      if (!files.has(name)) files.set(name, new Uint8Array());

      return {
        getFile: async () => ({
          arrayBuffer: async () => files.get(name)!.slice().buffer as ArrayBuffer,
        }),
        createWritable: async () => ({
          write: async (value: BufferSource) => {
            const bytes =
              value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
            files.set(name, bytes.slice());
          },
          close: async () => {},
        }),
      };
    },
  } as unknown as FileSystemDirectoryHandle;
  return { files, handle };
}

async function storeSnapshot(
  files: Map<string, Uint8Array>,
  syncKey: string,
  revision: number,
  playlists: unknown[]
) {
  const address = await deriveStorageAddress(syncKey);
  const encryptionKey = await deriveEncryptionKey(syncKey);
  const snapshot = createSnapshot({
    revision,
    deviceId: "existing-device",
    payload: { playlists },
  });
  const encrypted = await encryptSnapshot(encryptionKey, encodeSnapshot(snapshot));
  files.set(`iypm-sync-${address}.bin`, encrypted);
}

describe("FileSyncService", () => {
  it("refuses to replace a newer snapshot already in the folder", async () => {
    const directory = makeDirectory();
    const syncKey = generateSyncKey();
    await storeSnapshot(directory.files, syncKey, 8, [{ id: "remote" }]);
    const service = new FileSyncService(directory.handle, "local-device");

    const result = await service.upload(
      syncKey,
      { playlists: [{ id: "local" }] },
      { playlists: true },
      3
    );

    expect(result.pushed).toBe(false);
    expect(result.error).toContain("refusing to replace");
    const stored = await service.download(syncKey);
    expect(stored.status).toBe("ok");
    if (stored.status !== "ok") return;
    expect(stored.snapshot.revision).toBe(8);
    expect(stored.snapshot.payload.playlists).toEqual([{ id: "remote" }]);
  });

  it("does not overwrite a snapshot with an equal revision", async () => {
    const directory = makeDirectory();
    const syncKey = generateSyncKey();
    await storeSnapshot(directory.files, syncKey, 5, [{ id: "first" }]);
    const service = new FileSyncService(directory.handle, "second-device");

    const result = await service.upload(
      syncKey,
      { playlists: [{ id: "second" }] },
      { playlists: true },
      5
    );

    expect(result.pushed).toBe(false);
    const stored = await service.download(syncKey);
    expect(stored.status).toBe("ok");
    if (stored.status !== "ok") return;
    expect(stored.snapshot.payload.playlists).toEqual([{ id: "first" }]);
  });
});
