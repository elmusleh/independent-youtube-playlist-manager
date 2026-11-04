/**
 * Durable sync configuration stored in `browser.storage.local`.
 *
 * Sync credentials (the sync key, backend choice, and endpoint config) must NOT live in
 * `localStorage` — browser cleanup wipes it and silently unpairs devices. This module is
 * the single source of truth, persisted alongside the rest of the app state.
 *
 * The "relay" backend is the developer-hosted default endpoint; "supabase-byo" is the
 * user's own Supabase project. Both ride the same Supabase transport and differ only by
 * URL + anon key.
 */

import type { SyncSnapshot } from "./snapshot-codec.js";

export type SyncBackend = "relay" | "supabase-byo" | "file";

export type SyncContentSelection = {
  playlists: boolean;
  settings: boolean;
  history: boolean;
};

export type DownloadStatus = "ok" | "missing" | "permission" | "corrupt" | "decrypt" | "conflict";

export type DownloadResult =
  | { status: "ok"; snapshot: SyncSnapshot }
  | { status: "missing" }
  | { status: "permission"; message: string }
  | { status: "corrupt"; message: string }
  | { status: "decrypt"; message: string }
  | { status: "conflict"; branches: SyncSnapshot[] };

/** Per-category sync timestamps for granular status display. */
export type SyncTimestamps = {
  playlists: number | null;
  settings: number | null;
  history: number | null;
};

export type SyncConfig = {
  syncKey: string | null;
  /** Enabled sync backends (more than one = mirror to each). */
  backends: SyncBackend[];
  /** Periodic sync interval in minutes. 0 = manual only. */
  syncIntervalMinutes: number;
  /** User-supplied Supabase endpoint for the "supabase-byo" backend. */
  supabaseUrl: string;
  supabaseKey: string;
  content: SyncContentSelection;
  lastSyncedAt: number | null;
  lastError: string | null;
  /** Human-readable summary of the last completed sync (shown in status + toast). */
  lastSyncSummary: string | null;
  /** Pseudonymous device ids observed across syncs (local + remote writers). */
  knownDevices: string[];
  /**
   * Lamport clock for LWW conflict resolution. This is a *globally* monotonic revision
   * derived from the remote snapshot, NOT the device-local library mutation counter —
   * two devices must never tie, or neither will pull the other's data.
   */
  syncRevision: number;
  /** Per-category last successful sync timestamps. */
  categoryTimestamps: SyncTimestamps;
};

const KEY = "yph_sync_config";
const DEVICE_ID_KEY = "yph_sync_device_id";

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncKey: null,
  backends: [],
  syncIntervalMinutes: 5,
  supabaseUrl: "",
  supabaseKey: "",
  content: { playlists: true, settings: false, history: false },
  lastSyncedAt: null,
  lastError: null,
  lastSyncSummary: null,
  knownDevices: [],
  syncRevision: 0,
  categoryTimestamps: { playlists: null, settings: null, history: null },
};

/**
 * The developer-hosted relay endpoint. Replace these two placeholders with the real
 * Supabase project URL + anon key before the "easy / recommended" backend can function.
 * The relay is zero-knowledge: it stores only ciphertext keyed by a SHA-256 address.
 *
 * TODO(owner): provision a Supabase project with a `relay_snapshots` table
 * (`address text primary key`, `payload text`, `revision bigint`, `device_id text`,
 * `updated_at timestamptz`) and paste the URL + anon key here.
 */
export const RELAY_SUPABASE_URL = "https://qvwitlpnetwthyhrobca.supabase.co";
export const RELAY_SUPABASE_ANON_KEY = "sb_publishable_HV50FQtJrkoNcKLsFk5BHQ_KUU2GeKb";

/** True when the hosted relay has real credentials (not the placeholder). */
export function isRelayConfigured(): boolean {
  return (
    RELAY_SUPABASE_URL.includes("placeholder") === false &&
    RELAY_SUPABASE_ANON_KEY.includes("placeholder") === false
  );
}

/** Cross-browser durable storage adapter (browser.storage.local with chrome fallback). */
function storageArea(): {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
} {
  const b = (globalThis as any).browser;
  const c = (globalThis as any).chrome;
  if (b?.storage?.local) {
    return {
      get: async (k) => (await b.storage.local.get(k))[k],
      set: async (k, v) => b.storage.local.set({ [k]: v }),
    };
  }
  if (c?.storage?.local) {
    return {
      get: async (k) => (await c.storage.local.get(k))[k],
      set: async (k, v) => c.storage.local.set({ [k]: v }),
    };
  }
  // Non-extension fallback (tests / plain page).
  return {
    get: async (k) => JSON.parse(localStorage.getItem(k) || "null"),
    set: async (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  };
}

/** Get (or lazily create and persist) this device's stable pseudonymous id. */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await storageArea().get(DEVICE_ID_KEY);
    if (typeof existing === "string" && existing) return existing;
  } catch {
    // fall through to generate
  }
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await storageArea().set(DEVICE_ID_KEY, id);
  return id;
}

export async function loadSyncConfig(): Promise<SyncConfig> {
  try {
    const stored = (await storageArea().get(KEY)) as
      | (Partial<SyncConfig> & {
          backend?: SyncBackend | null;
        })
      | null;
    if (!stored) return structuredClone(DEFAULT_SYNC_CONFIG);
    // Deep-merge the nested `content` object so a config saved by an older build
    // (missing settings/history) never loses the user's new toggles.
    const content = { ...DEFAULT_SYNC_CONFIG.content, ...(stored.content ?? {}) };
    // Migrate the old single `backend` field to the new `backends` array.
    const backends = Array.isArray(stored.backends)
      ? stored.backends
      : stored.backend
        ? [stored.backend]
        : [];
    // Ensure categoryTimestamps exists (migration from older configs).
    const categoryTimestamps = stored.categoryTimestamps ?? {
      playlists: stored.lastSyncedAt ?? null,
      settings: null,
      history: null,
    };
    return {
      ...DEFAULT_SYNC_CONFIG,
      ...stored,
      backends,
      content,
      knownDevices: Array.isArray(stored.knownDevices) ? stored.knownDevices : [],
      syncRevision: typeof stored.syncRevision === "number" ? stored.syncRevision : 0,
      categoryTimestamps,
      syncIntervalMinutes:
        typeof stored.syncIntervalMinutes === "number"
          ? stored.syncIntervalMinutes
          : DEFAULT_SYNC_CONFIG.syncIntervalMinutes,
    };
  } catch {
    return structuredClone(DEFAULT_SYNC_CONFIG);
  }
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  // `config` is often a Svelte 5 $state proxy, which the storage API cannot
  // structured-clone (DataCloneError: Proxy object could not be cloned).
  // Serialize to a plain object before handing it to storage.
  const plain = JSON.parse(JSON.stringify(config)) as SyncConfig;
  await storageArea().set(KEY, plain);
}
