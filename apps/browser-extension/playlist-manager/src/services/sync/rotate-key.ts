/**
 * Sync key rotation: generate a new key, push all current data to the new space,
 * update the durable config, and (optionally) delete the old space.
 */

import {
  loadSyncConfig,
  saveSyncConfig,
  RELAY_SUPABASE_URL,
  RELAY_SUPABASE_ANON_KEY,
} from "./sync-config.js";
import { buildTransport, collectSource, buildSelection } from "../sync-manager.js";
import { computeStorageAddress } from "./keys.js";
import { generateSyncKey } from "./sync-key.js";
import { createAnonClient } from "../supabase-client.js";

export async function rotateSyncKey(deleteOldSpace = true): Promise<string> {
  const config = await loadSyncConfig();
  if (!config.syncKey) throw new Error("No sync key configured");
  const oldKey = config.syncKey;

  const transports: { backend: string; transport: any }[] = [];
  for (const backend of config.backends) {
    const t = await buildTransport(config, backend);
    if (t) transports.push({ backend, transport: t });
  }
  if (transports.length === 0) throw new Error("No sync backend available");

  const newKey = generateSyncKey();
  const source = await collectSource();
  const selection = buildSelection(config);
  const newRev = (typeof config.syncRevision === "number" ? config.syncRevision : 0) + 1;

  let pushError: string | undefined;
  for (const { transport } of transports) {
    const result = await transport.upload(newKey, source as any, selection as any, newRev);
    if (result?.error && !pushError) pushError = result.error;
  }
  if (pushError) throw new Error(pushError);

  config.syncKey = newKey;
  config.syncRevision = newRev;
  config.lastSyncedAt = Date.now();
  config.lastSyncSummary = "Sync key rotated.";
  config.lastError = null;
  await saveSyncConfig(config);

  if (deleteOldSpace) {
    try {
      const oldSpace = await computeStorageAddress(oldKey);
      for (const { backend } of transports) {
        try {
          if (backend === "relay") {
            const client = createAnonClient(RELAY_SUPABASE_URL, RELAY_SUPABASE_ANON_KEY);
            await client.from("relay_snapshots").delete().eq("address", oldSpace);
          } else if (backend === "supabase-byo" && config.supabaseUrl && config.supabaseKey) {
            const client = createAnonClient(config.supabaseUrl, config.supabaseKey);
            await client.from("relay_snapshots").delete().eq("address", oldSpace);
          }
        } catch {
          /* best-effort */
        }
      }
    } catch {
      /* best-effort */
    }
  }

  return newKey;
}
