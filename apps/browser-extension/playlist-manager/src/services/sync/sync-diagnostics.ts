/**
 * Sync diagnostics: background-safe `[SYNC]` system event logger and
 * dedicated read-only relay connectivity check (`verifyRelayConnection`).
 */

import { computeAuthToken, computeStorageAddress } from "./keys.js";
import { claimSpace, pullAll } from "./relay-transport.js";
import {
  isRelayConfigured,
  RELAY_SUPABASE_ANON_KEY,
  RELAY_SUPABASE_URL,
  type SyncConfig,
} from "./sync-config.js";

const LOG_KEY = "yph_system_logs";
const MAX_LOGS = 500;

export async function appendSyncSystemLog(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  const formatted = message.startsWith("[SYNC]") ? message : `[SYNC] ${message}`;
  const w = (globalThis as any).window;
  if (typeof w?.logSystemEvent === "function") {
    await w.logSystemEvent(level, formatted, details);
    return;
  }

  const b = (globalThis as any).browser || (globalThis as any).chrome;
  if (!b?.storage?.local?.get || !b?.storage?.local?.set) return;

  try {
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    let line = `[${ts}] [${level}] ${formatted}`;
    if (details && Object.keys(details).length > 0) {
      line += ` | ${JSON.stringify(details)}`;
    }
    const stored = await b.storage.local.get(LOG_KEY);
    const logs: string[] = Array.isArray(stored?.[LOG_KEY]) ? [...stored[LOG_KEY]] : [];
    logs.push(line);
    while (logs.length > MAX_LOGS) logs.shift();
    await b.storage.local.set({ [LOG_KEY]: logs });
  } catch {
    // Never fail a sync pass due to log persistence errors.
  }
}

export type ConnectionCheckResult = {
  ok: boolean;
  endpointHost: string;
  latencyMs: number;
  totalRecords: number;
  countsByCollection: Record<string, number>;
  summary: string;
  error?: string;
};

export function resolveActiveRelayEndpoint(cfg: SyncConfig): { url: string; anonKey: string } {
  const useByo = cfg.backends.includes("supabase-byo") && !!cfg.supabaseUrl;
  return {
    url: useByo ? cfg.supabaseUrl : cfg.relayUrl || RELAY_SUPABASE_URL,
    anonKey:
      (cfg.backends.includes("supabase-byo") && cfg.supabaseKey) ||
      cfg.relayAnonKey ||
      RELAY_SUPABASE_ANON_KEY,
  };
}

export function enabledCollectionNames(content: any): string[] {
  const list = ["devices"];
  if (content?.playlists !== false) list.push("playlists");
  if (content?.history === true) list.push("history");
  if (content?.settings === true) list.push("settings");
  return list;
}

export function formatSyncRunSummary(
  failed: string[],
  cursorBlocked: boolean,
  appliedCount: number,
  pushedCount: number
): string {
  const totalSynced = appliedCount + pushedCount;
  if (failed.length > 0) return `Partial: ${failed.join("; ")}`;
  if (cursorBlocked)
    return `Synced ${totalSynced} records; cursor held while a collection is disabled`;
  if (totalSynced > 0) {
    return `Synced ${totalSynced} records (↓${appliedCount} applied, ↑${pushedCount} uploaded)`;
  }
  return "Sync complete (up to date)";
}

export function stampSyncedConfig(
  cfg: SyncConfig,
  space: string,
  relayUrl: string,
  nowTs: number,
  summary: string
): void {
  cfg.syncConfigVersion = 2;
  cfg.syncProtocolVersion = 2;
  cfg.lastSyncedAt = nowTs;
  cfg.lastSyncSummary = summary;
  cfg.lastError = null;
  cfg.lastSyncedSpace = space;
  cfg.lastSyncedRelayUrl = relayUrl.replace(/\/$/, "");
  cfg.categoryTimestamps = {
    playlists:
      cfg.content?.playlists !== false ? nowTs : (cfg.categoryTimestamps?.playlists ?? null),
    settings: cfg.content?.settings === true ? nowTs : (cfg.categoryTimestamps?.settings ?? null),
    history: cfg.content?.history === true ? nowTs : (cfg.categoryTimestamps?.history ?? null),
  };
}

export async function verifyRelayConnection(cfg: SyncConfig): Promise<ConnectionCheckResult> {
  const started = Date.now();
  if (!cfg.syncKey) {
    return {
      ok: false,
      endpointHost: "",
      latencyMs: 0,
      totalRecords: 0,
      countsByCollection: {},
      summary: "Enter or generate a sync key before testing the connection.",
      error: "No sync key configured.",
    };
  }
  if (!cfg.backends.includes("relay") && !cfg.backends.includes("supabase-byo")) {
    return {
      ok: false,
      endpointHost: "",
      latencyMs: 0,
      totalRecords: 0,
      countsByCollection: {},
      summary: "Enable IYPM hosted or Your own Supabase before testing.",
      error: "No cloud sync backend enabled.",
    };
  }
  if (
    cfg.backends.includes("relay") &&
    !cfg.backends.includes("supabase-byo") &&
    !isRelayConfigured()
  ) {
    return {
      ok: false,
      endpointHost: "",
      latencyMs: 0,
      totalRecords: 0,
      countsByCollection: {},
      summary: "Hosted relay endpoint is not configured.",
      error: "Hosted relay is not configured.",
    };
  }

  const relayConfig = resolveActiveRelayEndpoint(cfg);
  let endpointHost = relayConfig.url;
  try {
    endpointHost = new URL(relayConfig.url).host;
  } catch {
    // keep raw string if malformed; fetch will report error cleanly
  }

  try {
    const space = await computeStorageAddress(cfg.syncKey);
    const authHash = await computeAuthToken(cfg.syncKey, space);
    const claimed = await claimSpace(relayConfig, space, authHash);
    if (!claimed) {
      throw new Error("Space authentication token rejected by relay.");
    }
    const records = await pullAll(relayConfig, space, authHash, 0);
    const latencyMs = Math.max(1, Date.now() - started);
    const active = records.filter((r) => !r.deleted);
    const counts: Record<string, number> = {};
    for (const rec of active) {
      counts[rec.collection] = (counts[rec.collection] ?? 0) + 1;
    }
    const breakdown = ["playlists", "history", "settings", "devices"]
      .filter((c) => (counts[c] ?? 0) > 0)
      .map((c) => `${counts[c]} ${c}`)
      .join(", ");
    const summary =
      active.length > 0
        ? `Connected to ${endpointHost} (${latencyMs} ms) — cloud space holds ${active.length} encrypted record${active.length === 1 ? "" : "s"} (${breakdown})`
        : `Connected to ${endpointHost} (${latencyMs} ms) — cloud space verified (empty; click "Sync now" to upload)`;

    return {
      ok: true,
      endpointHost,
      latencyMs,
      totalRecords: active.length,
      countsByCollection: counts,
      summary,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - started);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      endpointHost,
      latencyMs,
      totalRecords: 0,
      countsByCollection: {},
      summary: `Connection test failed (${endpointHost}): ${msg}`,
      error: msg,
    };
  }
}
