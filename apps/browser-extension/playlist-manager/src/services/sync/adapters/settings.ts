/**
 * Settings collection adapter for the sync engine.
 *
 * Each syncable setting key is its own record; merge is per-key LWW.
 */

import { mergeSettings, isSyncableSetting } from "../merge/settings";
import { getShadow, setShadow, isDirty } from "../shadow-store";
import type { RelayRecord } from "../relay-transport";
import { computeRecordId } from "../keys";
import { deriveKeys } from "../keys";
import { encryptRecord, decryptRecord, RECORD_VERSION } from "../record-codec";
import { getHlc } from "../hlc";
import type { RecordEnvelope, EncryptedRecord } from "../record-codec";

export type AdapterContext = {
  syncKey: string;
  localDeviceId: string;
  librarySnapshot: () => Promise<{ settings: Record<string, unknown> }>;
  saveSettings: (settings: Record<string, unknown>) => Promise<void>;
  // shared HLC state for monotonicity across adapters
  hlcState?: { lastHlc: any };
};

export async function collectDirtySettings(ctx: AdapterContext): Promise<RelayRecord[]> {
  const { settings } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const dirty: RelayRecord[] = [];
  let lastHlc: any = ctx.hlcState?.lastHlc;
  for (const [key, value] of Object.entries(settings)) {
    if (!isSyncableSetting(key)) continue;
    if (await isDirty("settings", key, value)) {
      const rid = await computeRecordId(ctx.syncKey, "settings", key);
      const hlc = await getHlc(ctx.syncKey, lastHlc);
      lastHlc = hlc;
      const version = hlc.value;
      const envelope: RecordEnvelope = {
        v: RECORD_VERSION,
        collection: "settings",
        id: rid,
        hlc: version,
        deleted: false,
        data: { key, value },
      };
      const encrypted = await encryptRecord(envelope, keys);
      dirty.push({
        collection: "settings",
        rid,
        version,
        payload: JSON.stringify(encrypted),
        deleted: false,
      });
      await setShadow("settings", key, value, version, ctx.localDeviceId);
    }
  }
  // Deletion tombstones: detect locally deleted settings
  const localKeys = new Set(Object.keys(settings));
  const shadows = await getShadowsByCollection("settings");
  for (const shadow of shadows) {
    if (localKeys.has(shadow.recordId)) continue;
    const baseCopy = shadow.baseCopy;
    if (!baseCopy) continue;
    const rid = await computeRecordId(ctx.syncKey, "settings", shadow.recordId);
    const hlc = await getHlc(ctx.syncKey, lastHlc);
    lastHlc = hlc;
    const version = hlc.value;
    const envelope: RecordEnvelope = {
      v: RECORD_VERSION,
      collection: "settings",
      id: rid,
      hlc: version,
      deleted: true,
      data: baseCopy,
    };
    const encrypted = await encryptRecord(envelope, keys);
    dirty.push({
      collection: "settings",
      rid,
      version,
      payload: JSON.stringify(encrypted),
      deleted: true,
    });
    await setShadow("settings", shadow.recordId, baseCopy, version, ctx.localDeviceId);
  }

  if (ctx.hlcState) ctx.hlcState.lastHlc = lastHlc;
  return dirty;
}

export async function applyRemoteSettings(
  ctx: AdapterContext,
  remote: Array<{ rid: string; payload: string; deleted: boolean; version: number }>
): Promise<{ applied: number; failed: string[] }> {
  // Nothing to apply from an empty remote; leave local settings untouched.
  if (!remote || remote.length === 0) return { applied: 0, failed: [] };
  const { settings: local } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const baseCopies: Record<string, unknown> = {};
  for (const key of Object.keys(local)) {
    const base = await getShadow("settings", key);
    if (base?.baseCopy !== undefined) baseCopies[key] = base.baseCopy;
  }

  const deletedKeys = new Set<string>();
  const remoteObj: Record<string, unknown> = {};
  for (const r of remote) {
    if (r.deleted) {
      try {
        const encrypted = JSON.parse(r.payload) as EncryptedRecord;
        const envelope = await decryptRecord(encrypted, keys);
        if (envelope?.data?.key) {
          deletedKeys.add(envelope.data.key);
          await deleteShadow("settings", envelope.data.key);
        }
      } catch {
        // Skip undecryptable records
      }
      continue;
    }
    try {
      const encrypted = JSON.parse(r.payload) as EncryptedRecord;
      const envelope = await decryptRecord(encrypted, keys);
      const parsed = envelope?.data as { key: string; value: unknown } | undefined;
      if (parsed && typeof parsed === "object" && "key" in parsed) {
        remoteObj[parsed.key] = parsed.value;
      }
    } catch {
      /* skip */
    }
  }

  const { merged } = mergeSettings(local, remoteObj, baseCopies);
  // Remove deleted keys
  for (const key of deletedKeys) {
    delete merged[key];
  }

  const failed: string[] = [];
  let appliedOk = true;
  try {
    await ctx.saveSettings(merged);
  } catch (e) {
    appliedOk = false;
    failed.push(`settings: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (appliedOk) {
    for (const [key, value] of Object.entries(merged)) {
      await setShadow("settings", key, value, Date.now(), ctx.localDeviceId);
    }
  }

  return { applied: Object.keys(merged).length, failed };
}
