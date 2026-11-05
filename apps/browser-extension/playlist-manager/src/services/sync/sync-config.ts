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
export type ConflictStrategy = "merge" | "lww";

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
  /** Legacy persisted relay endpoint fields, retained for config compatibility. */
  relayUrl?: string;
  relayAnonKey?: string;
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
  /** Current shape version for this stored configuration. */
  syncConfigVersion: 2;
  /** Relay record protocol this device has successfully used, or null when unverified. */
  syncProtocolVersion: 2 | null;
  /** Explicit user acknowledgement for an unverified/legacy relay configuration. */
  legacyV2AcknowledgedAt: number | null;
  /** Legacy relay cursor retained for the active v2 engine. */
  lastSeq?: number;
  /** Per-collection relay cursors for independent progress tracking. */
  lastSeqByCollection?: Record<string, number>;
  /** Per-category last successful sync timestamps. */
  categoryTimestamps: SyncTimestamps;
  /** Conflict resolution strategy for concurrent modifications ("merge" = 3-way merge, "lww" = last-write-wins). */
  conflictStrategy?: ConflictStrategy;
  /** Active SHA-256 space address most recently synced by this device. */
  lastSyncedSpace?: string | null;
  /** Active relay URL most recently synced by this device. */
  lastSyncedRelayUrl?: string | null;
};

const KEY = "yph_sync_config";
const DEVICE_ID_KEY = "yph_sync_device_id";

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncKey: null,
  backends: [],
  syncIntervalMinutes: 5,
  supabaseUrl: "",
  supabaseKey: "",
  content: { playlists: true, settings: true, history: true },
  lastSyncedAt: null,
  lastError: null,
  lastSyncSummary: null,
  knownDevices: [],
  syncRevision: 0,
  syncConfigVersion: 2,
  syncProtocolVersion: null,
  legacyV2AcknowledgedAt: null,
  categoryTimestamps: { playlists: null, settings: null, history: null },
  conflictStrategy: "merge",
  lastSyncedSpace: null,
  lastSyncedRelayUrl: null,
};

/**
 * The developer-hosted v2 relay endpoint (IYPM Supabase project `pfydngsbcmuhsqqjbcte`).
 * Zero-knowledge: stores only AES-256-GCM encrypted v2 records keyed by SHA-256 space address.
 */
export const RELAY_SUPABASE_URL = "https://pfydngsbcmuhsqqjbcte.supabase.co";
export const RELAY_SUPABASE_ANON_KEY = "sb_publishable_pKwO4ShF2yR1cufZA-2jfw_QsENS9vN";

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

export function migrateSyncConfig(stored: unknown): SyncConfig {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return structuredClone(DEFAULT_SYNC_CONFIG);
  }

  const source = stored as Partial<SyncConfig> & { backend?: SyncBackend | null };
  const content = { playlists: true, settings: true, history: true };
  const requestedBackends = Array.isArray(source.backends)
    ? source.backends
    : source.backend
      ? [source.backend]
      : [];
  const backends = requestedBackends.filter((backend): backend is SyncBackend =>
    ["relay", "supabase-byo", "file"].includes(backend)
  );
  const categoryTimestamps = source.categoryTimestamps ?? {
    playlists: source.lastSyncedAt ?? null,
    settings: null,
    history: null,
  };
  const acknowledgement = source.legacyV2AcknowledgedAt;

  return {
    ...DEFAULT_SYNC_CONFIG,
    ...source,
    syncConfigVersion: 2,
    syncProtocolVersion: source.syncProtocolVersion === 2 ? 2 : null,
    legacyV2AcknowledgedAt:
      typeof acknowledgement === "number" &&
      Number.isSafeInteger(acknowledgement) &&
      acknowledgement > 0
        ? acknowledgement
        : null,
    backends,
    content,
    knownDevices: Array.isArray(source.knownDevices) ? source.knownDevices : [],
    syncRevision: typeof source.syncRevision === "number" ? source.syncRevision : 0,
    categoryTimestamps,
    conflictStrategy: source.conflictStrategy === "lww" ? "lww" : "merge",
    lastSyncedSpace: typeof source.lastSyncedSpace === "string" ? source.lastSyncedSpace : null,
    lastSyncedRelayUrl:
      typeof source.lastSyncedRelayUrl === "string" ? source.lastSyncedRelayUrl : null,
    syncIntervalMinutes:
      typeof source.syncIntervalMinutes === "number"
        ? source.syncIntervalMinutes
        : DEFAULT_SYNC_CONFIG.syncIntervalMinutes,
  };
}

export async function loadSyncConfig(): Promise<SyncConfig> {
  try {
    const stored = await storageArea().get(KEY);
    return migrateSyncConfig(stored);
  } catch {
    return structuredClone(DEFAULT_SYNC_CONFIG);
  }
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  // `config` is often a Svelte 5 $state proxy, which the storage API cannot
  // structured-clone (DataCloneError: Proxy object could not be cloned).
  // Serialize to a plain object before handing it to storage.
  const plain = JSON.parse(JSON.stringify(config)) as SyncConfig;
  plain.syncConfigVersion = 2;
  await storageArea().set(KEY, plain);
}
