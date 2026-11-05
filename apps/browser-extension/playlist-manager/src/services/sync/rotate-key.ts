/**
 * Sync key rotation for v2: generate a new key and reset the cursor so the
 * background engine performs a full push to the new space on its next run.
 * The previous remote space is deliberately retained until all devices have
 * moved and the new copy has been independently verified.
 */
import { loadSyncConfig, saveSyncConfig } from "./sync-config.js";
import { generateSyncKey } from "./sync-key.js";
import {
  LEGACY_SYNC_RECOVERY_NOTICE,
  needsV2RelayAcknowledgement,
} from "./sync-config-compatibility.js";
import { clearLocalSyncRuntimeState, resetSyncConfigCursors } from "./sync-state-reset.js";

export async function rotateSyncKey(): Promise<string> {
  const config = await loadSyncConfig();
  if (!config.syncKey) throw new Error("No sync key configured");
  if (needsV2RelayAcknowledgement(config)) throw new Error(LEGACY_SYNC_RECOVERY_NOTICE);

  const summary = "Sync key rotated; the old remote space is retained.";
  const newKey = generateSyncKey();
  config.syncKey = newKey;
  resetSyncConfigCursors(config, summary);
  config.syncConfigVersion = 2;
  config.syncProtocolVersion = 2;
  config.legacyV2AcknowledgedAt = null;
  await clearLocalSyncRuntimeState(summary);
  await saveSyncConfig(config);

  // Keep the previous remote space intact. Deleting it immediately could destroy
  // unsynced records from another device or data that has not reached this device.
  return newKey;
}
