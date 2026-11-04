/**
 * Devices collection adapter for the sync engine.
 *
 * Each device is its own record; merge is per-device LWW by lastSeen.
 */

import { getShadow, setShadow, isDirty, deleteShadow } from "../shadow-store";
import type { DirtyCandidate } from "./types";
import { computeRecordId, deriveKeys } from "../keys";
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
  // shared HLC state for monotonicity across adapters
  hlcState?: { lastHlc: any };
};

export async function collectDirtyDevices(ctx: AdapterContext): Promise<DirtyCandidate[]> {
  const device: DeviceRecord = {
    deviceId: ctx.localDeviceId,
    platform: ctx.platform,
    userAgent: (globalThis as any).navigator?.userAgent ?? "unknown",
    lastSeen: Math.floor(Date.now() / 3_600_000) * 3_600_000, // coarse hourly bucket (M3)
  };
  const keys = await deriveKeys(ctx.syncKey);
  if (await isDirty("devices", ctx.localDeviceId, device)) {
    const rid = await computeRecordId(ctx.syncKey, "devices", ctx.localDeviceId);
    const hlc = await getHlc(ctx.syncKey, ctx.hlcState?.lastHlc);
    if (ctx.hlcState) ctx.hlcState.lastHlc = hlc;
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
        record: {
          collection: "devices",
          rid,
          version,
          payload: JSON.stringify(encrypted),
          deleted: false,
        },
        collection: "devices",
        recordId: ctx.localDeviceId,
        value: device,
        version,
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
  // Nothing to apply from an empty remote; leave local devices untouched.
  if (!remote || remote.length === 0) return { applied: 0, failed: [] };
  const local = (await ctx.librarySnapshot()).devices ?? [];
  const keys = await deriveKeys(ctx.syncKey);
  const failed: string[] = [];
  const remoteDevices: DeviceRecord[] = [];
  const remoteVersions = new Map<string, number>();
  const remoteDeletes = new Map<string, number>();
  for (const r of remote) {
    try {
      const encrypted = JSON.parse(r.payload) as EncryptedRecord;
      if (
        encrypted.collection !== "devices" ||
        encrypted.id !== r.rid ||
        encrypted.hlc !== r.version ||
        encrypted.deleted !== r.deleted
      ) {
        throw new Error("record metadata does not match relay envelope");
      }
      const envelope = await decryptRecord(encrypted, keys);
      if (envelope.collection !== "devices" || envelope.deleted !== r.deleted) {
        throw new Error("invalid device envelope");
      }
      const device = envelope.data as DeviceRecord | null;
      if (
        !device ||
        typeof device.deviceId !== "string" ||
        !device.deviceId ||
        !Number.isFinite(device.lastSeen)
      ) {
        throw new Error("device envelope is missing a valid deviceId or lastSeen");
      }
      if ((await computeRecordId(ctx.syncKey, "devices", device.deviceId)) !== r.rid) {
        throw new Error("device id does not match relay record id");
      }
      if (r.deleted) {
        remoteDeletes.set(device.deviceId, r.version);
        continue;
      }
      const shadow = await getShadow("devices", device.deviceId);
      if (shadow && r.version <= shadow.remoteVersion) continue;
      remoteDevices.push(device);
      remoteVersions.set(device.deviceId, r.version);
    } catch (error) {
      failed.push(`devices ${r.rid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const merged = new Map<string, DeviceRecord>();
  for (const d of [...local, ...remoteDevices]) {
    const existing = merged.get(d.deviceId);
    if (!existing || d.lastSeen > existing.lastSeen) merged.set(d.deviceId, d);
  }

  const locallyEditedDeletes = new Set<string>();
  const appliedDeletes = new Set<string>();
  for (const [deviceId, version] of remoteDeletes) {
    const shadow = await getShadow("devices", deviceId);
    if (shadow && version <= shadow.remoteVersion) continue;
    const localDevice = merged.get(deviceId);
    if (
      localDevice &&
      (deviceId === ctx.localDeviceId || (await isDirty("devices", deviceId, localDevice)))
    ) {
      // Keep a concurrent local device record and let the next pass publish it again.
      locallyEditedDeletes.add(deviceId);
    } else {
      merged.delete(deviceId);
      appliedDeletes.add(deviceId);
    }
  }
  const list = [...merged.values()];

  try {
    await ctx.saveDevices(list);
  } catch (e) {
    failed.push(`devices: ${e instanceof Error ? e.message : String(e)}`);
    return { applied: 0, failed };
  }

  try {
    for (const device of remoteDevices) {
      await setShadow(
        "devices",
        device.deviceId,
        device,
        remoteVersions.get(device.deviceId) ?? 0,
        ctx.localDeviceId
      );
    }
    for (const deviceId of locallyEditedDeletes) {
      await setShadow(
        "devices",
        deviceId,
        null,
        remoteDeletes.get(deviceId) ?? 0,
        ctx.localDeviceId,
        true
      );
    }
    for (const deviceId of appliedDeletes) await deleteShadow("devices", deviceId);
  } catch (error) {
    failed.push(`devices shadow update: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { applied: list.length, failed };
}
