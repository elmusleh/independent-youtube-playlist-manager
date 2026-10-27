import { normalizeVideoMeta, sanitizeVideoId } from "./schema-normalizer.js";
import type { NormalizedVideoMeta } from "../types/model.js";
import {
  metaKey,
  isMetaKey,
  DB_CONSTANTS,
  getMemoryFallback,
  withRetry,
  resetDbPromise,
} from "./db-service-core.js";

const { STORE_NAME, VIDEO_META_PREFIX } = DB_CONSTANTS;

export { metaKey, isMetaKey };

const _memoryFallback = getMemoryFallback();

/**
 * Persists a normalized video metadata entry
 */
export async function dbPutMetadata(videoId: string, rawMeta: any): Promise<NormalizedVideoMeta> {
  const cleanId = sanitizeVideoId(videoId);
  const normalized = normalizeVideoMeta(rawMeta, cleanId);
  const key = metaKey(cleanId);

  try {
    await withRetry(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.put(normalized, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
        })
    );
  } catch {
    _memoryFallback.set(key, normalized);
  }

  return normalized;
}

/**
 * Persists a batch of metadata entries atomically with normalization in a single transaction
 */
export async function dbPutMetadataBatch(
  items: Array<{ id: string; meta: any }> | Record<string, any>
): Promise<number> {
  const batch: [string, NormalizedVideoMeta][] = [];

  if (Array.isArray(items)) {
    for (const item of items) {
      const cleanId = sanitizeVideoId(item.id);
      if (cleanId) {
        batch.push([metaKey(cleanId), normalizeVideoMeta(item.meta, cleanId)]);
      }
    }
  } else if (items && typeof items === "object") {
    for (const [id, rawMeta] of Object.entries(items)) {
      const cleanId = sanitizeVideoId(id);
      if (cleanId) {
        batch.push([metaKey(cleanId), normalizeVideoMeta(rawMeta, cleanId)]);
      }
    }
  }

  if (batch.length === 0) return 0;

  try {
    await withRetry(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          for (const [key, val] of batch) {
            store.put(val, key);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error("Batch transaction aborted"));
        })
    );
  } catch (e) {
    for (const [key, val] of batch) {
      _memoryFallback.set(key, val);
    }
  }

  return batch.length;
}

/**
 * Retrieves a normalized video metadata record from IndexedDB
 */
export async function dbGetMetadata(videoId: string): Promise<NormalizedVideoMeta | null> {
  const cleanId = sanitizeVideoId(videoId);
  if (!cleanId) return null;
  const key = metaKey(cleanId);

  try {
    const raw = await withRetry(
      (db) =>
        new Promise<any>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
    if (!raw) return _memoryFallback.get(key) || null;
    return normalizeVideoMeta(raw, cleanId);
  } catch (err) {
    return _memoryFallback.get(key) || null;
  }
}

/**
 * Batch retrieves metadata records for multiple video IDs in a single transaction
 */
export async function dbGetMetadataBatch(
  videoIds: string[]
): Promise<Record<string, NormalizedVideoMeta>> {
  const validIds = videoIds.map((id) => sanitizeVideoId(id)).filter(Boolean);
  if (validIds.length === 0) return {};

  const results: Record<string, NormalizedVideoMeta> = {};

  try {
    const fetchedMap = await withRetry(
      (db) =>
        new Promise<Map<string, any>>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const map = new Map<string, any>();
          let pending = validIds.length;

          for (const id of validIds) {
            const key = metaKey(id);
            const req = store.get(key);
            req.onsuccess = () => {
              if (req.result) map.set(id, req.result);
              pending--;
              if (pending === 0) resolve(map);
            };
            req.onerror = () => {
              pending--;
              if (pending === 0) resolve(map);
            };
          }
        })
    );

    for (const id of validIds) {
      const val = fetchedMap.get(id) || _memoryFallback.get(metaKey(id));
      if (val) {
        results[id] = normalizeVideoMeta(val, id);
      }
    }
  } catch (err) {
    console.warn(`[DB-SERVICE] Error in batch metadata read:`, err);
    for (const id of validIds) {
      const val = _memoryFallback.get(metaKey(id));
      if (val) {
        results[id] = normalizeVideoMeta(val, id);
      }
    }
  }

  return results;
}

/**
 * Returns all cached video metadata entries in IndexedDB
 */
export async function dbGetAllMetadata(): Promise<Record<string, NormalizedVideoMeta>> {
  const result: Record<string, NormalizedVideoMeta> = {};
  try {
    const entries = await withRetry(
      (db) =>
        new Promise<Array<{ key: IDBValidKey; value: any }>>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const list: Array<{ key: IDBValidKey; value: any }> = [];
          const req = store.openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              list.push({ key: cursor.key, value: cursor.value });
              cursor.continue();
            } else {
              resolve(list);
            }
          };
          req.onerror = () => reject(req.error);
        })
    );

    for (const { key, value } of entries) {
      if (isMetaKey(key)) {
        const videoId = String(key).replace(VIDEO_META_PREFIX, "");
        result[videoId] = normalizeVideoMeta(value, videoId);
      }
    }
  } catch (err) {
    console.error("[DB-SERVICE] Error reading all metadata:", err);
  }

  // Include memory fallback
  for (const [key, value] of _memoryFallback.entries()) {
    if (isMetaKey(key)) {
      const videoId = String(key).replace(VIDEO_META_PREFIX, "");
      if (!result[videoId]) {
        result[videoId] = normalizeVideoMeta(value, videoId);
      }
    }
  }

  return result;
}

/**
 * Deletes metadata records for specified video IDs
 */
export async function dbDeleteMetadata(videoIds: string[]): Promise<void> {
  const keys = videoIds.map((id) => metaKey(id));
  if (keys.length === 0) return;

  for (const k of keys) {
    _memoryFallback.delete(k);
  }

  try {
    await withRetry(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          for (const key of keys) {
            store.delete(key);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    );
  } catch (e) {
    console.warn("[DB-SERVICE] Failed to delete metadata keys:", e);
  }
}

/**
 * Clears all video metadata records from IndexedDB
 */
export async function dbClearMetadata(): Promise<number> {
  _memoryFallback.clear();
  try {
    return await withRetry(
      (db) =>
        new Promise<number>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const countReq = store.count();
          countReq.onsuccess = () => {
            const total = countReq.result;
            store.clear();
            tx.oncomplete = () => resolve(total);
          };
          tx.onerror = () => reject(tx.error);
        })
    );
  } catch (err) {
    console.error("[DB-SERVICE] Error clearing metadata cache:", err);
    return 0;
  }
}

/**
 * Returns counts and estimated storage metrics
 */
export async function dbGetStats(): Promise<{ totalMetadata: number; totalKeys: number }> {
  try {
    return await withRetry(
      (db) =>
        new Promise<{ totalMetadata: number; totalKeys: number }>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const countReq = store.count();
          countReq.onsuccess = () => {
            resolve({
              totalMetadata: countReq.result,
              totalKeys: countReq.result,
            });
          };
          countReq.onerror = () => reject(countReq.error);
        })
    );
  } catch {
    return { totalMetadata: _memoryFallback.size, totalKeys: _memoryFallback.size };
  }
}
