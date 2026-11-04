/**
 * Devices collection adapter for the sync engine.
 *
 * Each device is its own record; merge is per-device LWW by lastSeen.
 */

import { getShadow, setShadow, isDirty } from "../shadow-store";
import type { RelayRecord } from "../relay-transport";
import { computeRecordId } from "../keys";
import { deriveKeys } from "../keys";
import { encryptRecord, decryptRecord, RECORD_VERSION } from "../record-codec";
import { getHlc } from "../hlc";
import type { RecordEnvelope, EncryptedRecord } from "../record-codec";

export type DeviceRecord = {
  deviceId: string;
  platform: string;
  userAgent: string;
  lastSeen: number;
  name?: string;
};

export type AdapterContext = {
  syncKey: string;
  localDeviceId: string;
  platform: string;
  saveDevices: (devices: DeviceRecord[]) => Promise<void>;
  librarySnapshot: () => Promise<{ devices: DeviceRecord[] }>;
};

export async function collectDirtyDevices(ctx: AdapterContext): Promise<RelayRecord[]> {
  const device: DeviceRecord = {
    deviceId: ctx.localDeviceId,
    platform: ctx.platform,
    userAgent: (globalThis as any).navigator?.userAgent ?? "unknown",
    lastSeen: Date.now(),
  };
  const keys = await deriveKeys(ctx.syncKey);
  if (await isDirty("devices", ctx.localDeviceId, device)) {
    const rid = await computeRecordId(ctx.syncKey, "devices", ctx.localDeviceId);
    const hlc = await getHlc(ctx.syncKey);
    const version = hlc.value;
    const envelope: RecordEnvelope = {
      v: RECORD_VERSION,
      collection: "devices",
      id: rid,
      hlc: version,
      deleted: false,
      data: device,
    };
    const encrypted = await encryptRecord(envelope, keys);
    return [
      {
        collection: "devices",
        rid,
        version,
        payload: JSON.stringify(encrypted),
        deleted: false,
      },
    ];
  }
  return [];
}

export async function applyRemoteDevices(
  ctx: AdapterContext,
  remote: Array<{ rid: string; payload: string; deleted: boolean; version: number }>
): Promise<{ applied: number; failed: string[] }> {
  const local = (await ctx.librarySnapshot()).devices ?? [];
  const keys = await deriveKeys(ctx.syncKey);
  const remoteDevices: DeviceRecord[] = [];
  for (const r of remote) {
    if (r.deleted) continue;
    try {
      const encrypted = JSON.parse(r.payload) as EncryptedRecord;
      const envelope = await decryptRecord(encrypted, keys);
      if (envelope?.data) remoteDevices.push(envelope.data as DeviceRecord);
    } catch {
      // Skip undecryptable records
    }
  }

  const merged = new Map<string, DeviceRecord>();
  for (const d of [...local, ...remoteDevices]) {
    const existing = merged.get(d.deviceId);
    if (!existing || d.lastSeen > existing.lastSeen) merged.set(d.deviceId, d);
  }
  const list = [...merged.values()];

  const failed: string[] = [];
  try {
    await ctx.saveDevices(list);
  } catch (e) {
    failed.push(`devices: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Only advance shadow when the write succeeded.
  if (failed.length === 0) {
    for (const d of list) {
      await setShadow("devices", d.deviceId, d, d.lastSeen, ctx.localDeviceId);
    }
  }

  return { applied: list.length, failed };
}
