import { afterEach, describe, expect, it, vi } from "vitest";
import type { SyncStatus } from "./sync-engine";
import { registerSyncEngine } from "./sync-engine-registration";

const status: SyncStatus = {
  phase: "idle",
  lastRunAt: null,
  lastError: null,
  lastSummary: "ready",
  pendingCount: 0,
  incomingCount: 0,
  failedCount: 0,
  pushedCount: 0,
  pulledCount: 0,
  startedAt: null,
  estimatedMs: null,
  categoryProgress: {
    playlists: { processed: 0, applied: 0, total: 0 },
    settings: { processed: 0, applied: 0, total: 0 },
    history: { processed: 0, applied: 0, total: 0 },
    devices: { processed: 0, applied: 0, total: 0 },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sync engine runtime registration", () => {
  it("routes runtime commands to the supplied engine handlers", async () => {
    let onMessage:
      ((request: any, sender: any, sendResponse: (value: unknown) => void) => unknown) | null =
      null;
    const runOnce = vi.fn().mockResolvedValue(status);
    const getStatus = vi.fn().mockReturnValue(status);
    const browserApi = {
      runtime: {
        onStartup: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((listener) => {
            onMessage = listener;
          }),
        },
      },
      storage: {
        local: { get: vi.fn().mockResolvedValue({}) },
        onChanged: { addListener: vi.fn() },
      },
      alarms: {
        clear: vi.fn(),
        create: vi.fn(),
        onAlarm: { addListener: vi.fn() },
      },
    };
    vi.stubGlobal("browser", browserApi);

    registerSyncEngine({
      runOnce,
      scheduleRun: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getStatus,
      isRunning: () => false,
    });

    expect((globalThis as any).window.syncEngine.runOnce).toBe(runOnce);
    expect(browserApi.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    const sendResponse = vi.fn();
    expect((onMessage as any)?.({ cmd: "sync-status" }, {}, sendResponse)).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith(status);
    expect((onMessage as any)?.({ cmd: "sync-now" }, {}, sendResponse)).toBe(true);
    await Promise.resolve();
    expect(runOnce).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenLastCalledWith(status);
  });

  it("returns a native Promise in Firefox MV3 when browser.runtime.getBrowserInfo exists", async () => {
    let onMessage: any = null;
    const runOnce = vi.fn().mockResolvedValue(status);
    vi.stubGlobal("browser", {
      runtime: {
        getBrowserInfo: vi.fn(),
        onStartup: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((listener) => {
            onMessage = listener;
          }),
        },
      },
      storage: {
        local: { get: vi.fn().mockResolvedValue({}) },
        onChanged: { addListener: vi.fn() },
      },
    });

    registerSyncEngine({
      runOnce,
      scheduleRun: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getStatus: () => status,
      isRunning: () => false,
    });

    const returned = onMessage({ cmd: "sync-now" }, {}, vi.fn());
    expect(returned).toBeInstanceOf(Promise);
    await expect(returned).resolves.toEqual(status);
  });
});
