/**
 * Hybrid Logical Clock (HLC) for Sync v2.
 */

import { computeRecordId } from "./keys";

const COUNTER_BITS = 16;
const MAX_COUNTER = (1 << COUNTER_BITS) - 1;

export type HlcTimestamp = {
  value: number;
  wall: number;
  counter: number;
  deviceHash: number;
};

let cachedDeviceKey: string | null = null;
let cachedDeviceHash: number | null = null;

async function getDeviceHash(syncKey: string, deviceId = "hlc-device-id"): Promise<number> {
  const cacheKey = `${syncKey}|${deviceId}`;
  if (cachedDeviceKey === cacheKey && cachedDeviceHash !== null) return cachedDeviceHash;
  const recordId = await computeRecordId(syncKey, "device", deviceId);
  cachedDeviceKey = cacheKey;
  cachedDeviceHash = parseInt(recordId.slice(0, 4), 16) & 0xffff;
  return cachedDeviceHash;
}

function toTimestamp(
  wall: number,
  counter: number,
  deviceHash: number,
  value?: number
): HlcTimestamp {
  return { value: value ?? wall, wall, counter, deviceHash };
}

export async function getHlc(
  syncKey: string,
  lastHlc?: HlcTimestamp,
  deviceId?: string
): Promise<HlcTimestamp> {
  const deviceHash = await getDeviceHash(syncKey, deviceId);
  const wall = Date.now();

  let counter = 0;
  let value = wall;

  if (lastHlc) {
    if (wall === lastHlc.wall) {
      counter = lastHlc.counter + 1;
      if (counter > MAX_COUNTER) {
        while (Date.now() === wall) {
          await new Promise((r) => setTimeout(r, 0));
        }
        return getHlc(syncKey, lastHlc, deviceId);
      }
      // Ensure value is strictly monotonic even within same wall
      value = Math.max(wall, (lastHlc.value ?? wall) + 1);
    } else if (wall > lastHlc.wall) {
      counter = 0;
      value = wall;
    } else {
      // Clock regression: use lastHlc.wall + counter
      counter = lastHlc.counter + 1;
      if (counter > MAX_COUNTER) {
        throw new Error("HLC counter overflow with clock regression");
      }
      value = (lastHlc.value ?? lastHlc.wall) + 1;
      return toTimestamp(lastHlc.wall, counter, deviceHash, value);
    }
  }

  return toTimestamp(wall, counter, deviceHash, value);
}

export function compareHlc(a: HlcTimestamp | number, b: HlcTimestamp | number): number {
  const aWall = typeof a === "number" ? a : a.wall;
  const bWall = typeof b === "number" ? b : b.wall;
  if (aWall !== bWall) return aWall < bWall ? -1 : 1;
  const aCounter = typeof a === "number" ? 0 : a.counter;
  const bCounter = typeof b === "number" ? 0 : b.counter;
  if (aCounter !== bCounter) return aCounter < bCounter ? -1 : 1;
  const aDevice = typeof a === "number" ? 0 : a.deviceHash;
  const bDevice = typeof b === "number" ? 0 : b.deviceHash;
  if (aDevice !== bDevice) return aDevice < bDevice ? -1 : 1;
  return 0;
}

export function isNewer(a: HlcTimestamp | number, b: HlcTimestamp | number): boolean {
  return compareHlc(a, b) > 0;
}

export async function receiveHlc(
  syncKey: string,
  remoteHlc: HlcTimestamp | number,
  localHlc?: HlcTimestamp
): Promise<HlcTimestamp> {
  const remoteWall = typeof remoteHlc === "number" ? remoteHlc : remoteHlc.wall;
  const remoteCounter = typeof remoteHlc === "number" ? 0 : remoteHlc.counter;
  const localWall = localHlc?.wall ?? 0;
  const localCounter = localHlc?.counter ?? 0;
  const deviceHash = await getDeviceHash(syncKey);

  const now = Date.now();
  const maxWall = Math.max(localWall, remoteWall);

  if (maxWall > now) {
    const counter = (maxWall === remoteWall ? remoteCounter : localCounter) + 1;
    if (counter > MAX_COUNTER) {
      while (Date.now() <= maxWall) {
        await new Promise((r) => setTimeout(r, 0));
      }
      return getHlc(syncKey, localHlc);
    }
    return toTimestamp(maxWall, counter, deviceHash);
  }

  if (maxWall === now) {
    const counter = Math.max(localCounter, remoteCounter) + 1;
    if (counter > MAX_COUNTER) {
      while (Date.now() === now) {
        await new Promise((r) => setTimeout(r, 0));
      }
      return getHlc(syncKey, localHlc);
    }
    return toTimestamp(now, counter, deviceHash);
  }

  return getHlc(syncKey);
}

export function hlcToString(hlc: HlcTimestamp | number): string {
  const wall = typeof hlc === "number" ? hlc : hlc.wall;
  const counter = typeof hlc === "number" ? 0 : hlc.counter;
  const deviceHash = typeof hlc === "number" ? 0 : hlc.deviceHash;
  return (
    "HLC(" +
    new Date(wall).toISOString() +
    ", c=" +
    counter +
    ", d=" +
    deviceHash.toString(16).padStart(4, "0") +
    ")"
  );
}

export function parseHlc(value: number): HlcTimestamp {
  return { value, wall: value, counter: 0, deviceHash: 0 };
}
