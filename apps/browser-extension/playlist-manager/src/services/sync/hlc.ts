/**
 * Hybrid Logical Clock (HLC) for Sync v2.
 *
 * HLC combines wall-clock time with a logical counter to provide:
 *   - Causality tracking (if event A happens before B, hlc(A) < hlc(B))
 *   - Wall-clock proximity (HLC values are close to real time)
 *   - Total ordering for conflict resolution (latest HLC wins)
 *
 * Each device has a unique deviceId incorporated into the HLC to break ties.
 * Format: 48-bit wall time (ms since epoch) + 16-bit counter + device hash
 * Combined into a single number for easy comparison.
 */

import { computeRecordId } from "./keys";

/** Number of bits for the logical counter (max 65535 per ms). */
const COUNTER_BITS = 16;
const MAX_COUNTER = (1 << COUNTER_BITS) - 1;

/** Wall time shift to make room for counter and device hash. */
const WALL_SHIFT = COUNTER_BITS + 16; // 16 bits for device hash

export type HlcTimestamp = {
  /** The combined HLC value (wall << WALL_SHIFT | counter << 16 | deviceHash) */
  value: number;
  /** Wall-clock milliseconds since epoch. */
  wall: number;
  /** Logical counter. */
  counter: number;
  /** Device hash (16 bits). */
  deviceHash: number;
};

/** Device ID cache for HLC generation. */
let cachedDeviceId: string | null = null;
let cachedDeviceHash: number | null = null;

/**
 * Get or generate a stable device hash (16 bits) from the sync key.
 * This ensures HLC values from the same device are ordered.
 */
async function getDeviceHash(syncKey: string): Promise<number> {
  if (cachedDeviceHash !== null) return cachedDeviceHash;

  // Use the record ID derivation with a fixed collection to get a stable device hash
  const recordId = await computeRecordId(syncKey, "device", "hlc-device-id");
  // Take first 16 bits of the hash
  cachedDeviceHash = parseInt(recordId.slice(0, 4), 16) & 0xffff;
  return cachedDeviceHash;
}

/**
 * Get the current HLC timestamp.
 * If called rapidly, the counter increments while wall time stays the same.
 * If wall time advances, counter resets.
 */
export async function getHlc(syncKey: string, lastHlc?: HlcTimestamp): Promise<HlcTimestamp> {
  const deviceHash = await getDeviceHash(syncKey);
  const wall = Date.now();

  let counter = 0;
  if (lastHlc) {
    if (wall === lastHlc.wall) {
      counter = lastHlc.counter + 1;
      if (counter > MAX_COUNTER) {
        // Counter overflow - wait for next millisecond
        while (Date.now() === wall) {
          await new Promise((r) => setTimeout(r, 0));
        }
        return getHlc(syncKey, lastHlc);
      }
    } else if (wall > lastHlc.wall) {
      counter = 0;
    } else {
      // Clock went backwards - use last wall time with incremented counter
      counter = lastHlc.counter + 1;
      if (counter > MAX_COUNTER) {
        throw new Error("HLC counter overflow with clock regression");
      }
      return {
        value: (lastHlc.wall << WALL_SHIFT) | (counter << 16) | deviceHash,
        wall: lastHlc.wall,
        counter,
        deviceHash,
      };
    }
  }

  const value = (wall << WALL_SHIFT) | (counter << 16) | deviceHash;
  return { value, wall, counter, deviceHash };
}

/**
 * Compare two HLC timestamps.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareHlc(a: HlcTimestamp | number, b: HlcTimestamp | number): number {
  const aVal = typeof a === "number" ? a : a.value;
  const bVal = typeof b === "number" ? b : b.value;
  return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
}

/**
 * Check if HLC a is newer than HLC b.
 */
export function isNewer(a: HlcTimestamp | number, b: HlcTimestamp | number): boolean {
  return compareHlc(a, b) > 0;
}

/**
 * Get the maximum of two HLC timestamps, then advance.
 * Used when receiving an event from another device - we must advance past it.
 */
export async function receiveHlc(
  syncKey: string,
  remoteHlc: HlcTimestamp | number,
  localHlc?: HlcTimestamp
): Promise<HlcTimestamp> {
  const remoteVal = typeof remoteHlc === "number" ? remoteHlc : remoteHlc.value;
  const localVal = localHlc ? localHlc.value : 0;

  // New HLC must be > max(local, remote)
  const maxVal = Math.max(localVal, remoteVal);
  const deviceHash = await getDeviceHash(syncKey);

  // Extract wall and counter from maxVal
  const wall = maxVal >> WALL_SHIFT;
  let counter = (maxVal >> 16) & MAX_COUNTER;

  if (wall === Date.now()) {
    // Same wall time - increment counter
    counter = counter + 1;
    if (counter > MAX_COUNTER) {
      // Wait for next ms
      while (Date.now() === wall) {
        await new Promise((r) => setTimeout(r, 0));
      }
      return receiveHlc(syncKey, remoteHlc, localHlc);
    }
  } else if (wall > Date.now()) {
    // Remote is in the future - use their wall time, reset counter
    counter = 0;
  } else {
    // Local time has advanced - use current time, reset counter
    return getHlc(syncKey);
  }

  const value = (wall << WALL_SHIFT) | (counter << 16) | deviceHash;
  return { value, wall, counter, deviceHash };
}

/**
 * Convert HLC value to human-readable string for debugging.
 */
export function hlcToString(hlc: HlcTimestamp | number): string {
  const value = typeof hlc === "number" ? hlc : hlc.value;
  const wall = value >> WALL_SHIFT;
  const counter = (value >> 16) & MAX_COUNTER;
  const deviceHash = value & 0xffff;
  return `HLC(${new Date(wall).toISOString()}, c=${counter}, d=${deviceHash.toString(16).padStart(4, "0")})`;
}

/**
 * Parse a combined HLC value back to components.
 */
export function parseHlc(value: number): HlcTimestamp {
  const wall = value >> WALL_SHIFT;
  const counter = (value >> 16) & MAX_COUNTER;
  const deviceHash = value & 0xffff;
  return { value, wall, counter, deviceHash };
}
