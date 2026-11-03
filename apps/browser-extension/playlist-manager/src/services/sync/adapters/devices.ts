/**
 * Devices collection adapter for the sync engine.
 *
 * Each device is its own record; merge is per-device LWW by lastSeen.
 */

import { getShadow, setShadow, isDirty } from "../shadow-store";
import type { RelayRecord } from "../relay-transport";
import { computeRecordId } from "../keys";

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
  if (await isDirty("devices", ctx.localDeviceId, device)) {
    const rid = await computeRecordId(ctx.syncKey, "devices", ctx.localDeviceId);
    return [
      {
        collection: "devices",
        rid,
        version: device.lastSeen,
        payload: JSON.stringify(device),
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
  const remoteDevices = remote
    .filter((r) => !r.deleted)
    .map((r) => {
      try {
        return JSON.parse(r.payload) as DeviceRecord;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as DeviceRecord[];

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

  for (const d of list) {
    await setShadow("devices", d.deviceId, d, d.lastSeen, ctx.localDeviceId);
  }

  return { applied: list.length, failed };
}
