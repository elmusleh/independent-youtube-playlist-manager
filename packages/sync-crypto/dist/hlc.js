// packages/sync-crypto/src/hlc.ts
// Hybrid Logical Clock (HLC) for causality + total ordering
import { HLC_MAX_COUNTER } from "./constants.js";
import { computeRecordId } from "./keys.js";
let cachedDeviceKey = null;
let cachedDeviceHash = null;
async function getDeviceHash(syncKey, deviceId = "hlc-device-id") {
    const cacheKey = `${syncKey}|${deviceId}`;
    if (cachedDeviceKey === cacheKey && cachedDeviceHash !== null)
        return cachedDeviceHash;
    const recordId = await computeRecordId(syncKey, "device", deviceId);
    cachedDeviceKey = cacheKey;
    cachedDeviceHash = parseInt(recordId.slice(0, 4), 16) & 0xffff;
    return cachedDeviceHash;
}
function toTimestamp(wall, counter, deviceHash, value) {
    return { value: value ?? wall, wall, counter, deviceHash };
}
export async function getHlc(syncKey, lastHlc, deviceId) {
    const deviceHash = await getDeviceHash(syncKey, deviceId);
    const wall = Date.now();
    let counter = 0;
    let value = wall;
    if (lastHlc) {
        if (wall === lastHlc.wall) {
            counter = lastHlc.counter + 1;
            if (counter > HLC_MAX_COUNTER) {
                while (Date.now() === wall) {
                    await new Promise((r) => setTimeout(r, 0));
                }
                return getHlc(syncKey, lastHlc, deviceId);
            }
            value = Math.max(wall, (lastHlc.value ?? wall) + 1);
        }
        else if (wall > lastHlc.wall) {
            counter = 0;
            value = wall;
        }
        else {
            counter = lastHlc.counter + 1;
            if (counter > HLC_MAX_COUNTER) {
                throw new Error("HLC counter overflow with clock regression");
            }
            value = (lastHlc.value ?? lastHlc.wall) + 1;
            return toTimestamp(lastHlc.wall, counter, deviceHash, value);
        }
    }
    return toTimestamp(wall, counter, deviceHash, value);
}
export function compareHlc(a, b) {
    const aWall = typeof a === "number" ? a : a.wall;
    const bWall = typeof b === "number" ? b : b.wall;
    if (aWall !== bWall)
        return aWall < bWall ? -1 : 1;
    const aCounter = typeof a === "number" ? 0 : a.counter;
    const bCounter = typeof b === "number" ? 0 : b.counter;
    if (aCounter !== bCounter)
        return aCounter < bCounter ? -1 : 1;
    const aDevice = typeof a === "number" ? 0 : a.deviceHash;
    const bDevice = typeof b === "number" ? 0 : b.deviceHash;
    if (aDevice !== bDevice)
        return aDevice < bDevice ? -1 : 1;
    return 0;
}
export function isNewer(a, b) {
    return compareHlc(a, b) > 0;
}
export async function receiveHlc(syncKey, remoteHlc, localHlc) {
    const remoteWall = typeof remoteHlc === "number" ? remoteHlc : remoteHlc.wall;
    const remoteCounter = typeof remoteHlc === "number" ? 0 : remoteHlc.counter;
    const localWall = localHlc?.wall ?? 0;
    const localCounter = localHlc?.counter ?? 0;
    const deviceHash = await getDeviceHash(syncKey);
    const now = Date.now();
    const maxWall = Math.max(localWall, remoteWall);
    if (maxWall > now) {
        const counter = (maxWall === remoteWall ? remoteCounter : localCounter) + 1;
        if (counter > HLC_MAX_COUNTER) {
            while (Date.now() <= maxWall) {
                await new Promise((r) => setTimeout(r, 0));
            }
            return getHlc(syncKey, localHlc);
        }
        return toTimestamp(maxWall, counter, deviceHash);
    }
    if (maxWall === now) {
        const counter = Math.max(localCounter, remoteCounter) + 1;
        if (counter > HLC_MAX_COUNTER) {
            while (Date.now() === now) {
                await new Promise((r) => setTimeout(r, 0));
            }
            return getHlc(syncKey, localHlc);
        }
        return toTimestamp(now, counter, deviceHash);
    }
    return getHlc(syncKey);
}
export function hlcToString(hlc) {
    const wall = typeof hlc === "number" ? hlc : hlc.wall;
    const counter = typeof hlc === "number" ? 0 : hlc.counter;
    const deviceHash = typeof hlc === "number" ? 0 : hlc.deviceHash;
    return ("HLC(" +
        new Date(wall).toISOString() +
        ", c=" +
        counter +
        ", d=" +
        deviceHash.toString(16).padStart(4, "0") +
        ")");
}
export function parseHlc(value) {
    return { value, wall: value, counter: 0, deviceHash: 0 };
}
