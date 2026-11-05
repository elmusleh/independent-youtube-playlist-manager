import { describe, it, expect, vi } from "vitest";
import { purgeRemoteSyncSpace } from "./purge-remote";
import { DEFAULT_SYNC_CONFIG } from "./sync-config";
import * as relayTransport from "./relay-transport";

describe("purgeRemoteSyncSpace", () => {
  it("fails if no sync key is present", async () => {
    const res = await purgeRemoteSyncSpace({ ...DEFAULT_SYNC_CONFIG, syncKey: null });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No sync key/);
  });

  it("calls deleteSpace and succeeds when relay returns true", async () => {
    vi.spyOn(relayTransport, "deleteSpace").mockResolvedValue(true);

    const res = await purgeRemoteSyncSpace({
      ...DEFAULT_SYNC_CONFIG,
      syncKey: "ABCDE-FGHJK-MNPQR-STVWX",
      backends: ["relay"],
    });

    expect(res.ok).toBe(true);
    expect(relayTransport.deleteSpace).toHaveBeenCalled();
  });

  it("handles relay error gracefully", async () => {
    vi.spyOn(relayTransport, "deleteSpace").mockRejectedValue(new Error("Network timeout"));

    const res = await purgeRemoteSyncSpace({
      ...DEFAULT_SYNC_CONFIG,
      syncKey: "ABCDE-FGHJK-MNPQR-STVWX",
      backends: ["relay"],
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Network timeout/);
  });
});
