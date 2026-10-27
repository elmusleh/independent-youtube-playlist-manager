import { sanitizeVideoId } from "./schema-normalizer.js";

const DB_NAME = "yph_metadata_db_v2";
const DB_VERSION = 1;
const STORE_NAME = "metadata";
const VIDEO_META_PREFIX = "yph:meta:";

/**
 * Generates the IndexedDB key for a video's metadata entry.
 * @param videoId - The YouTube video ID
 * @returns The prefixed key string (yph:meta:<videoId>)
 */
export function metaKey(videoId: string): string {
  return VIDEO_META_PREFIX + sanitizeVideoId(videoId);
}

/**
 * Checks whether a key string follows the metadata key pattern.
 * @param key - The key to check
 * @returns true if the key starts with the metadata prefix
 */
export function isMetaKey(key: any): boolean {
  return typeof key === "string" && key.startsWith(VIDEO_META_PREFIX);
}

export const DB_CONSTANTS = {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  VIDEO_META_PREFIX,
};

let _dbPromise: Promise<IDBDatabase> | null = null;
const _memoryFallback = new Map<string, any>();

export function getMemoryFallback(): Map<string, any> {
  return _memoryFallback;
}

export function getDbPromise(): Promise<IDBDatabase> | null {
  return _dbPromise;
}

export function setDbPromise(promise: Promise<IDBDatabase> | null): void {
  _dbPromise = promise;
}

export function resetDbPromise(): void {
  _dbPromise = null;
}

export async function getDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB not supported"));
  }

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          _dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        _dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("[DB-SERVICE] IndexedDB upgrade blocked by another tab");
      };
    } catch (e) {
      _dbPromise = null;
      reject(e);
    }
  });

  return _dbPromise;
}

/**
 * Execute an async database operation with automatic reconnection on transaction failure
 */
export async function withRetry<T>(
  operation: (db: IDBDatabase) => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 100
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      const db = await getDb();
      return await operation(db);
    } catch (err: any) {
      attempt++;
      _dbPromise = null; // Reset connection on failure so it can reconnect
      if (attempt >= maxRetries) {
        console.error(`[DB-SERVICE] Operation failed after ${attempt} attempts:`, err);
        throw err;
      }
      console.warn(
        `[DB-SERVICE] Operation attempt ${attempt} failed, retrying in ${delay}ms...`,
        err
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}
