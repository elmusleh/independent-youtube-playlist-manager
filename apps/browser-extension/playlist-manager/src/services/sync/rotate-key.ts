/**
 * Sync key rotation for v2: generate a new key, push all current data to the new
 * space via the background engine on the next run, and delete the old space.
 *
 * The data push is deferred to the engine (it will collect dirty records against
 * the new key on its next run). Old-space deletion uses the v2 RPC.
 */
import {
  loadSyncConfig,
  saveSyncConfig,
  RELAY_SUPABASE_URL,
  RELAY_SUPABASE_ANON_KEY,
} from "./sync-config.js";
import { computeStorageAddress, computeAuthToken } from "./keys.js";
import { generateSyncKey } from "./sync-key.js";
import { deleteSpace } from "./relay-transport.js";

export async function rotateSyncKey(deleteOldSpace = true): Promise<string> {
  const config = await loadSyncConfig();
  if (!config.syncKey) throw new Error("No sync key configured");

  const oldKey = config.syncKey;
  const newKey = generateSyncKey();

  config.syncKey = newKey;
  (config as any).lastSeq = 0; // force a full push to the new space
  config.lastSyncedAt = null;
  config.lastSyncSummary = "Sync key rotated.";
  config.lastError = null;
  await saveSyncConfig(config);

  if (deleteOldSpace) {
    try {
      const relayConfig = { url: RELAY_SUPABASE_URL, anonKey: RELAY_SUPABASE_ANON_KEY };
      const oldSpace = await computeStorageAddress(oldKey);
      const oldAuth = await computeAuthToken(oldKey, oldSpace);
      await deleteSpace(relayConfig, oldSpace, oldAuth);
    } catch {
      /* best-effort */
    }
  }

  return newKey;
}
