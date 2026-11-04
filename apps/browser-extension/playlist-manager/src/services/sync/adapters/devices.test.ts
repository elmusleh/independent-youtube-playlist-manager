import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyRemoteDevices, type DeviceRecord } from "./devices";
import { computeRecordId, deriveKeys } from "../keys";
import { encryptRecord, RECORD_VERSION } from "../record-codec";
import { clearAllShadows, getShadow, setShadow } from "../shadow-store";

const SYNC_KEY = "ABCDEFGHIJKLMNOPQRST";
const BASE_DEVICE: DeviceRecord = {
  deviceId: "retired-device",
  platform: "test",
  userAgent: "test-agent",
  lastSeen: 100,
};

describe("device adapter tombstones", () => {
  beforeEach(async () => clearAllShadows());
  afterEach(async () => clearAllShadows());

  it("removes a remotely deleted device only after persisting the updated list", async () => {
    await setShadow("devices", BASE_DEVICE.deviceId, BASE_DEVICE, 100, "local");
    const rid = await computeRecordId(SYNC_KEY, "devices", BASE_DEVICE.deviceId);
    const encrypted = await encryptRecord(
      {
        v: RECORD_VERSION,
        collection: "devices",
        id: rid,
        hlc: 200,
        deleted: true,
        data: BASE_DEVICE,
      },
      await deriveKeys(SYNC_KEY)
    );
    let saved: DeviceRecord[] = [BASE_DEVICE];
    const result = await applyRemoteDevices(
      {
        syncKey: SYNC_KEY,
        localDeviceId: "local-device",
        platform: "test",
        librarySnapshot: async () => ({ devices: saved }),
        saveDevices: async (devices) => {
          saved = devices;
        },
      },
      [{ rid, payload: JSON.stringify(encrypted), deleted: true, version: 200 }]
    );

    expect(result.failed).toEqual([]);
    expect(saved).toEqual([]);
    expect(await getShadow("devices", BASE_DEVICE.deviceId)).toBeNull();
  });
});
