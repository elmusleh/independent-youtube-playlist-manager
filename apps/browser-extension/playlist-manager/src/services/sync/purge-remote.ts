/**
 * purge-remote.ts
 *
 * Deletes the encrypted remote sync space on the active relay or custom Supabase backend.
 * Uses `sync_delete_space` RPC via `deleteSpace` in `relay-transport.ts`.
 * Does NOT delete or alter any local playlists, history, or settings.
 */

import { computeStorageAddress, computeAuthToken } from "./keys.js";
import { deleteSpace } from "./relay-transport.js";
import { resolveActiveRelayEndpoint } from "./sync-diagnostics.js";
import type { SyncConfig } from "./sync-config.js";

export async function purgeRemoteSyncSpace(
  config: SyncConfig,
  backend: "relay" | "supabase-byo" = "relay"
): Promise<{ ok: boolean; error?: string }> {
  if (!config.syncKey) {
    return { ok: false, error: "No sync key configured on this device." };
  }

  try {
    const relayConfig = resolveActiveRelayEndpoint(config, backend);
    const space = await computeStorageAddress(config.syncKey);
    const authHash = await computeAuthToken(config.syncKey, space);

    const deleted = await deleteSpace(relayConfig, space, authHash);
    if (!deleted) {
      return {
        ok: false,
        error: "Remote space could not be deleted (invalid auth or space not found).",
      };
    }

    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "Failed to contact remote relay to delete space.",
    };
  }
}
