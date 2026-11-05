/**
 * Shadow Store for Sync v2.
 *
 * IndexedDB store that tracks each record's base copy (for dirty detection),
 * hash, and remote version. This enables:
 *   - Dirty detection by hash comparison (catches changes from ANY code path)
 *   - "What is left to upload" for free
 *   - Per-record version tracking for incremental pulls
 */

const DB_NAME = "yph_sync_shadow_v1";
const STORE_NAME = "shadow";
const DB_VERSION = 1;
const META_COLLECTION = "__meta__";

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export type ShadowRecord = {
  /** Composite key: `${collection}|${recordId}` */
  key: string;
  collection: string;
  recordId: string;
  /** Hash of the last-synced base copy (for dirty detection). */
  baseHash: string;
  /** The last-synced base copy (for 3-way merge). */
  baseCopy: unknown;
  /** Remote version (HLC or revision) when last synced. */
  remoteVersion: number;
  /** Local device ID that last modified this record. */
  localDeviceId: string;
  /** True when the last acknowledged remote baseline is a deletion. */
  deleted?: boolean;
  /** When this shadow entry was last updated. */
  updatedAt: number;
};

/** Open the shadow database. */
async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("collection", "collection", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Compute a hash of a record for dirty detection.
 * Uses a fast non-crypto hash (FNV-1a) for performance.
 */
export function computeHash(data: unknown): string {
  const json = JSON.stringify(data === undefined ? null : data) ?? "null";
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Get the shadow record for a collection + recordId.
 */
export async function getShadow(
  collection: string,
  recordId: string
): Promise<ShadowRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const key = `${collection}|${recordId}`;
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all shadow records for a collection.
 */
export async function getShadowsByCollection(collection: string): Promise<ShadowRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("collection");
    const request = index.getAll(collection);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Upsert a shadow record.
 */
export async function setShadow(
  collection: string,
  recordId: string,
  baseCopy: unknown,
  remoteVersion: number,
  localDeviceId: string,
  deleted = false
): Promise<void> {
  const db = await openDb();
  const baseHash = computeHash(baseCopy);
  const key = `${collection}|${recordId}`;
  const record: ShadowRecord = {
    key,
    collection,
    recordId,
    baseHash,
    baseCopy,
    remoteVersion,
    localDeviceId,
    deleted,
    updatedAt: Date.now(),
  };

  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(record);
  return waitForTransaction(tx);
}

/**
 * Delete a shadow record (when local record is deleted).
 */
export async function deleteShadow(collection: string, recordId: string): Promise<void> {
  const db = await openDb();
  const key = `${collection}|${recordId}`;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(key);
  return waitForTransaction(tx);
}

/**
 * Check if a local record is dirty (different from base).
 * Returns true if the record has been modified since last sync.
 */
export async function isDirty(
  collection: string,
  recordId: string,
  currentCopy: unknown
): Promise<boolean> {
  const shadow = await getShadow(collection, recordId);
  if (!shadow) return true; // No shadow = new record = dirty
  if (shadow.deleted) return true;
  const currentHash = computeHash(currentCopy);
  return currentHash !== shadow.baseHash;
}

/**
 * Get all dirty records for a collection.
 * Returns array of { recordId, currentCopy } for records that need upload.
 */
export async function getDirtyRecords(
  collection: string,
  getCurrentCopy: (recordId: string) => Promise<unknown | null>
): Promise<Array<{ recordId: string; currentCopy: unknown }>> {
  const shadows = await getShadowsByCollection(collection);
  const dirty: Array<{ recordId: string; currentCopy: unknown }> = [];

  for (const shadow of shadows) {
    const currentCopy = await getCurrentCopy(shadow.recordId);
    if (currentCopy === null) continue; // Deleted locally - handled separately
    const currentHash = computeHash(currentCopy);
    if (currentHash !== shadow.baseHash) {
      dirty.push({ recordId: shadow.recordId, currentCopy });
    }
  }

  return dirty;
}

/**
 * Get the base copy for 3-way merge.
 */
export async function getBaseCopy(collection: string, recordId: string): Promise<unknown | null> {
  const shadow = await getShadow(collection, recordId);
  return shadow?.baseCopy ?? null;
}

/**
 * Get all base copies for a collection (for full 3-way merge).
 */
export async function getAllBaseCopies(collection: string): Promise<Map<string, unknown>> {
  const shadows = await getShadowsByCollection(collection);
  const map = new Map<string, unknown>();
  for (const shadow of shadows) {
    if (shadow.baseCopy !== null && shadow.baseCopy !== undefined) {
      map.set(shadow.recordId, shadow.baseCopy);
    }
  }
  return map;
}

/**
 * Clear all shadow records (e.g., on logout or reset).
 */
export async function clearAllShadows(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  return waitForTransaction(tx);
}

/**
 * Get count of shadow records per collection (for UI status).
 */
export async function getShadowCounts(): Promise<Record<string, number>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const counts: Record<string, number> = {};
      for (const record of request.result) {
        if (record.collection === META_COLLECTION) continue;
        counts[record.collection] = (counts[record.collection] || 0) + 1;
      }
      resolve(counts);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Initialize shadow store with current local state (first run / migration).
 * Called during v1 -> v2 migration.
 */
export async function initializeFromLocal(
  collections: {
    playlists: unknown[];
    settings: Record<string, unknown>;
    history: Record<string, unknown>;
  },
  localDeviceId: string,
  remoteRevision: number
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const now = Date.now();

  // Playlists
  for (const playlist of collections.playlists) {
    if (playlist && typeof playlist === "object" && "id" in playlist) {
      const id = (playlist as { id: string }).id;
      const key = `playlists|${id}`;
      store.put({
        key,
        collection: "playlists",
        recordId: id,
        baseHash: computeHash(playlist),
        baseCopy: playlist,
        remoteVersion: remoteRevision,
        localDeviceId,
        updatedAt: now,
      });
    }
  }

  // Settings (each key is a separate record)
  for (const [key, value] of Object.entries(collections.settings)) {
    const recordKey = `settings|${key}`;
    store.put({
      key: recordKey,
      collection: "settings",
      recordId: key,
      baseHash: computeHash(value),
      baseCopy: value,
      remoteVersion: remoteRevision,
      localDeviceId,
      updatedAt: now,
    });
  }

  // History (each videoId is a separate record)
  for (const [videoId, entry] of Object.entries(collections.history)) {
    const recordKey = `history|${videoId}`;
    store.put({
      key: recordKey,
      collection: "history",
      recordId: videoId,
      baseHash: computeHash(entry),
      baseCopy: entry,
      remoteVersion: remoteRevision,
      localDeviceId,
      updatedAt: now,
    });
  }

  return waitForTransaction(tx);
}
