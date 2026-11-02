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

export type SyncBackend = "relay" | "supabase-byo" | "file";

export type SyncContentSelection = {
  playlists: boolean;
  settings: boolean;
  history: boolean;
};

export type SyncConfig = {
  syncKey: string | null;
  backend: SyncBackend | null;
  /** User-supplied endpoint; empty means "use the built-in relay". */
  supabaseUrl: string;
  supabaseKey: string;
  content: SyncContentSelection;
  lastSyncedAt: number | null;
  lastError: string | null;
  /** Human-readable summary of the last completed sync (shown in status + toast). */
  lastSyncSummary: string | null;
  /** Pseudonymous device ids observed across syncs (local + remote writers). */
  knownDevices: string[];
};

const KEY = "yph_sync_config";
const DEVICE_ID_KEY = "yph_sync_device_id";

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncKey: null,
  backend: null,
  supabaseUrl: "",
  supabaseKey: "",
  content: { playlists: true, settings: false, history: false },
  lastSyncedAt: null,
  lastError: null,
  lastSyncSummary: null,
  knownDevices: [],
};

/**
 * The developer-hosted relay endpoint. Replace these two placeholders with the real
 * Supabase project URL + anon key before the "easy / recommended" backend can function.
 * The relay is zero-knowledge: it stores only ciphertext keyed by a SHA-256 address.
 *
 * TODO(owner): provision a Supabase project with a `sync_snapshots` table
 * (`address text primary key`, `blob text`, `revision bigint`, `device_id text`,
 * `updated_at timestamptz`) and paste the URL + anon key here.
 */
export const RELAY_SUPABASE_URL = "https://placeholder.supabase.co";
export const RELAY_SUPABASE_ANON_KEY = "placeholder-anon-key";

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
    const stored = await storageArea().get(KEY);
    if (!stored) return structuredClone(DEFAULT_SYNC_CONFIG);
    return { ...DEFAULT_SYNC_CONFIG, ...(stored as Partial<SyncConfig>) };
  } catch {
    return structuredClone(DEFAULT_SYNC_CONFIG);
  }
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  try {
    await storageArea().set(KEY, config);
  } catch {
    // Persistence is best-effort; a failed write should not break the UI.
  }
}
