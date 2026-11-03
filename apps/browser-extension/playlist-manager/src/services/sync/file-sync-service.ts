/**
 * File / Syncthing transport for encrypted sync (Chromium desktop only).
 *
 * Writes the encrypted snapshot into a user-chosen folder as a single `.bin` file whose
 * name is the key-derived storage address (so the filename itself leaks nothing). A
 * separate tool — Syncthing, free file sync, Dropbox, a USB stick — moves that file
 * between devices; this service writes it and reads back whatever arrived.
 *
 * Unlike the Supabase transport there is no server-side revision column, so the
 * "strictly newer wins" comparison happens entirely at merge time (inside the decoded
 * snapshot). The pre-import backup + "ties keep local" still protect against data loss.
 *
 * The folder handle is persisted in IndexedDB so background sync can re-open it without
 * a fresh `showDirectoryPicker()` gesture.
 */

import { deriveEncryptionKey, deriveStorageAddress } from "./key-derivation";
import { encryptSnapshot, decryptSnapshot } from "./encryption-service";
import { createSnapshot, encodeSnapshot, decodeSnapshot, isNewerRevision } from "./snapshot-codec";
import { selectSyncContent, type SyncSource, type SyncSelection } from "./content-selector";
import type { SyncSnapshot } from "./snapshot-codec";
import type { DownloadResult } from "./sync-config";
import type { EncryptedSyncResult } from "./encrypted-sync-service";

const FILE_PREFIX = "iypm-sync-";
const FILE_SUFFIX = ".bin";

const DB_NAME = "iypm-file-sync";
const DB_STORE = "handles";
const HANDLE_KEY = "sync-folder";

// --- Folder-handle persistence (IndexedDB) -------------------------------------------

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Persist a user-chosen folder handle so background sync can reuse it. */
export async function storeFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Load the previously-chosen folder handle, or null if none was stored. */
export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openHandleDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(HANDLE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

/** True when this environment supports the File System Access pickers. */
export function supportsFileTransport(): boolean {
  return (
    typeof window !== "undefined" &&
    "showDirectoryPicker" in window &&
    "showOpenFilePicker" in window
  );
}

// --- The transport ---------------------------------------------------------------------

export class FileSyncService {
  private deviceId: string;

  constructor(
    private directory: FileSystemDirectoryHandle,
    deviceId?: string
  ) {
    this.deviceId =
      deviceId ??
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}`);
  }

  private fileName(address: string): string {
    return `${FILE_PREFIX}${address}${FILE_SUFFIX}`;
  }

  /** Read and validate the stored snapshot; a corrupt file must never be overwritten silently. */
  private async readSnapshot(syncKey: string): Promise<SyncSnapshot | null> {
    const address = await deriveStorageAddress(syncKey);
    const key = await deriveEncryptionKey(syncKey);

    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await this.directory.getFileHandle(this.fileName(address));
    } catch (err) {
      if (err && typeof err === "object" && "name" in err && err.name === "NotFoundError") {
        return null;
      }
      throw err;
    }

    const file = await fileHandle.getFile();
    const encrypted = new Uint8Array(await file.arrayBuffer());
    const plaintext = await decryptSnapshot(key, encrypted);
    return decodeSnapshot(plaintext);
  }

  /** Encrypt and write the local snapshot into the synced folder. */
  async upload(
    syncKey: string,
    source: SyncSource,
    selection: Partial<SyncSelection> = {},
    revision: number
  ): Promise<{ pushed: boolean; error?: string }> {
    try {
      const address = await deriveStorageAddress(syncKey);
      const key = await deriveEncryptionKey(syncKey);
      const existing = await this.readSnapshot(syncKey);
      if (existing && existing.revision >= revision) {
        return {
          pushed: false,
          error: `The folder already contains revision ${existing.revision}; refusing to replace it with revision ${revision}.`,
        };
      }

      const payload = selectSyncContent(source, selection) as unknown as Record<string, unknown>;
      const snapshot = createSnapshot({ revision, deviceId: this.deviceId, payload });
      const encrypted = await encryptSnapshot(key, encodeSnapshot(snapshot));

      const fileHandle = await this.directory.getFileHandle(this.fileName(address), {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(encrypted as unknown as BufferSource);
      await writable.close();
      return { pushed: true };
    } catch (err: any) {
      return { pushed: false, error: err?.message || String(err) };
    }
  }

  /** Read, decrypt and decode whatever snapshot arrived in the folder (or null). */
  async download(syncKey: string): Promise<DownloadResult> {
    const address = await deriveStorageAddress(syncKey);
    const key = await deriveEncryptionKey(syncKey);

    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await this.directory.getFileHandle(this.fileName(address));
    } catch (err: any) {
      if (err && typeof err === "object" && "name" in err && err.name === "NotFoundError") {
        return { status: "missing" };
      }
      const msg = err?.message || String(err);
      console.warn("[FILE-SYNC] download failed:", msg);
      if (/permission|notallowed|access|denied/i.test(msg)) {
        return { status: "permission", message: msg };
      }
      return { status: "corrupt", message: msg };
    }

    try {
      const file = await fileHandle.getFile();
      const encrypted = new Uint8Array(await file.arrayBuffer());
      let plaintext: Uint8Array;
      try {
        plaintext = await decryptSnapshot(key, encrypted);
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn("[FILE-SYNC] download failed:", msg);
        return { status: "decrypt", message: msg };
      }
      try {
        const snapshot = decodeSnapshot(plaintext);
        return { status: "ok", snapshot };
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn("[FILE-SYNC] download failed:", msg);
        return { status: "corrupt", message: msg };
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn("[FILE-SYNC] download failed:", msg);
      if (/permission|notallowed|access|denied/i.test(msg)) {
        return { status: "permission", message: msg };
      }
      return { status: "corrupt", message: msg };
    }
  }

  /** Full round-trip: write local, then read back any newer remote snapshot. */
  async sync(
    syncKey: string,
    source: SyncSource,
    selection: Partial<SyncSelection> = {},
    localRevision: number
  ): Promise<EncryptedSyncResult> {
    const uploadResult = await this.upload(syncKey, source, selection, localRevision);
    const remoteResult = await this.download(syncKey);
    const remote = remoteResult.status === "ok" ? remoteResult.snapshot : null;

    let pulled = false;
    if (remote && isNewerRevision(remote.revision, localRevision)) {
      pulled = true;
    }

    return {
      success: !uploadResult.error,
      pushed: uploadResult.pushed,
      pulled,
      remoteRevision: remote?.revision ?? null,
      snapshot: remote,
      error: uploadResult.error,
    };
  }
}
