/**
 * Settings collection adapter for the sync engine.
 *
 * Each syncable setting key is its own record; merge is per-key LWW.
 */

import { mergeSettings, isSyncableSetting } from "../merge/settings";
import {
  getShadow,
  setShadow,
  isDirty,
  getShadowsByCollection,
  deleteShadow,
} from "../shadow-store";
import type { DirtyCandidate } from "./types";
import { computeRecordId } from "../keys";
import { deriveKeys } from "../keys";
import { encryptRecord, decryptRecord, RECORD_VERSION } from "../record-codec";
import { getHlc } from "../hlc";
import type { RecordEnvelope, EncryptedRecord } from "../record-codec";

export type AdapterContext = {
  syncKey: string;
  localDeviceId: string;
  conflictStrategy?: "merge" | "lww";
  librarySnapshot: () => Promise<{ settings: Record<string, unknown> }>;
  saveSettings: (settings: Record<string, unknown>, deletedKeys?: string[]) => Promise<void>;
  // shared HLC state for monotonicity across adapters
  hlcState?: { lastHlc: any };
};

export async function collectDirtySettings(ctx: AdapterContext): Promise<DirtyCandidate[]> {
  const { settings } = await ctx.librarySnapshot();
  const keys = await deriveKeys(ctx.syncKey);
  const dirty: DirtyCandidate[] = [];
  let lastHlc: any = ctx.hlcState?.lastHlc;
  for (const [key, value] of Object.entries(settings)) {
    if (!isSyncableSetting(key)) continue;
    if (await isDirty("settings", key, value)) {
      const rid = await computeRecordId(ctx.syncKey, "settings", key);
      const hlc = await getHlc(ctx.syncKey, lastHlc, ctx.localDeviceId);
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
        record: {
          collection: "settings",
          rid,
          version,
          payload: JSON.stringify(encrypted),
          deleted: false,
        },
        collection: "settings",
        recordId: key,
        value,
        version,
        deleted: false,
      });
    }
  }
  // Deletion tombstones: detect locally deleted settings
  const localKeys = new Set(Object.keys(settings));
  const shadows = await getShadowsByCollection("settings");
  for (const shadow of shadows) {
    if (localKeys.has(shadow.recordId)) continue;
    // An acknowledged deletion has already been propagated; do not re-emit it.
    if (shadow.deleted) continue;
    const baseCopy = shadow.baseCopy;
    if (baseCopy === undefined) continue;
    const rid = await computeRecordId(ctx.syncKey, "settings", shadow.recordId);
    const hlc = await getHlc(ctx.syncKey, lastHlc, ctx.localDeviceId);
    lastHlc = hlc;
    const version = hlc.value;
    const envelope: RecordEnvelope = {
      v: RECORD_VERSION,
      collection: "settings",
      id: rid,
      hlc: version,
      deleted: true,
      data: { key: shadow.recordId, value: baseCopy },
    };
    const encrypted = await encryptRecord(envelope, keys);
    dirty.push({
      record: {
        collection: "settings",
        rid,
        version,
        payload: JSON.stringify(encrypted),
        deleted: true,
      },
      collection: "settings",
      recordId: shadow.recordId,
      value: baseCopy,
      version,
      deleted: true,
    });
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

  const failed: string[] = [];
  const remoteObj: Record<string, unknown> = {};
  const remoteVersions = new Map<string, number>();
  const remoteDeletes = new Map<string, number>();
  for (const r of remote) {
    try {
      const encrypted = JSON.parse(r.payload) as EncryptedRecord;
      if (
        encrypted.collection !== "settings" ||
        encrypted.id !== r.rid ||
        encrypted.hlc !== r.version ||
        encrypted.deleted !== r.deleted
      ) {
        throw new Error("record metadata does not match relay envelope");
      }
      const envelope = await decryptRecord(encrypted, keys);
      if (envelope.collection !== "settings" || envelope.deleted !== r.deleted) {
        throw new Error("invalid settings envelope");
      }
      const parsed = envelope?.data as { key: string; value: unknown } | undefined;
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.key === "string" &&
        isSyncableSetting(parsed.key)
      ) {
        if ((await computeRecordId(ctx.syncKey, "settings", parsed.key)) !== r.rid) {
          throw new Error("setting key does not match relay record id");
        }
        if (r.deleted) {
          remoteDeletes.set(parsed.key, r.version);
          continue;
        }
        const shadow = await getShadow("settings", parsed.key);
        if (shadow?.baseCopy !== undefined) baseCopies[parsed.key] = shadow.baseCopy;
        if (shadow && r.version <= shadow.remoteVersion) continue;
        remoteObj[parsed.key] = parsed.value;
        remoteVersions.set(parsed.key, r.version);
      } else {
        throw new Error("settings envelope is missing a syncable key");
      }
    } catch (error) {
      failed.push(`settings ${r.rid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const { merged } = mergeSettings(local, remoteObj, baseCopies, {
    strategy: ctx.conflictStrategy ?? "merge",
    preferRemoteOnTie: true,
  });
  const locallyEditedDeletes = new Set<string>();
  const appliedDeletes = new Set<string>();
  for (const [key, version] of remoteDeletes) {
    const shadow = await getShadow("settings", key);
    if (shadow && version <= shadow.remoteVersion) continue;
    if (
      Object.prototype.hasOwnProperty.call(local, key) &&
      (await isDirty("settings", key, local[key]))
    ) {
      // Preserve a concurrent local edit and make it dirty against the remote tombstone.
      merged[key] = local[key];
      locallyEditedDeletes.add(key);
    } else {
      delete merged[key];
      appliedDeletes.add(key);
    }
  }

  const remoteKeyCount = Object.keys(remoteObj).length;
  if (remoteKeyCount === 0 && appliedDeletes.size === 0 && locallyEditedDeletes.size === 0) {
    return { applied: 0, failed };
  }

  try {
    const updates: Record<string, unknown> = {};
    for (const key of Object.keys(remoteObj)) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) updates[key] = merged[key];
    }
    await ctx.saveSettings(updates, [...appliedDeletes]);
  } catch (e) {
    failed.push(`settings: ${e instanceof Error ? e.message : String(e)}`);
    return { applied: 0, failed };
  }

  try {
    for (const [key, value] of Object.entries(remoteObj)) {
      await setShadow("settings", key, value, remoteVersions.get(key) ?? 0, ctx.localDeviceId);
    }
    for (const key of locallyEditedDeletes) {
      await setShadow("settings", key, null, remoteDeletes.get(key) ?? 0, ctx.localDeviceId, true);
    }
    for (const key of appliedDeletes) await deleteShadow("settings", key);
  } catch (error) {
    failed.push(
      `settings shadow update: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { applied: remoteKeyCount + appliedDeletes.size, failed };
}
