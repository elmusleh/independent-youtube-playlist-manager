import { describe, expect, it, vi } from "vitest";
import {
  checkSyncHostPermission,
  requestSyncHostPermission,
  syncHostPermissionPattern,
} from "./host-permissions";

describe("syncHostPermissionPattern", () => {
  it("requests only the configured HTTPS origin", () => {
    expect(syncHostPermissionPattern("https://project.example.com/path/")).toBe(
      "https://project.example.com/*"
    );
  });

  it("rejects non-HTTPS and credential-bearing URLs", () => {
    expect(syncHostPermissionPattern("http://project.example.com")).toBeNull();
    expect(syncHostPermissionPattern("https://user:pass@project.example.com")).toBeNull();
    expect(syncHostPermissionPattern("not a URL")).toBeNull();
  });
});

describe("requestSyncHostPermission", () => {
  it("invokes permissions.request synchronously before any await (Firefox user-gesture rule)", async () => {
    let gestureActive = true;
    const permissions = {
      contains: vi.fn(async () => {
        gestureActive = false;
        return false;
      }),
      request: vi.fn(async () => {
        if (!gestureActive) {
          throw new Error("permissions.request may only be called from a user input handler");
        }
        return true;
      }),
    };

    const pending = requestSyncHostPermission("https://project.example.com", permissions);
    // Must have been called synchronously in the same tick before any microtask!
    expect(permissions.request).toHaveBeenCalledWith({
      origins: ["https://project.example.com/*"],
    });
    gestureActive = false;
    await expect(pending).resolves.toBe(true);
  });

  it("falls back to permissions.contains if request throws outside a user gesture", async () => {
    const permissions = {
      contains: vi.fn().mockResolvedValue(true),
      request: vi
        .fn()
        .mockRejectedValue(
          new Error("permissions.request may only be called from a user input handler")
        ),
    };

    await expect(
      requestSyncHostPermission("https://project.example.com", permissions)
    ).resolves.toBe(true);
    expect(permissions.contains).toHaveBeenCalledWith({
      origins: ["https://project.example.com/*"],
    });
  });

  it("does not request access for invalid endpoints", async () => {
    const permissions = {
      contains: vi.fn(),
      request: vi.fn(),
    };

    await expect(
      requestSyncHostPermission("http://project.example.com", permissions)
    ).resolves.toBe(false);
    expect(permissions.request).not.toHaveBeenCalled();
  });

  it("passively checks existing host permission via checkSyncHostPermission", async () => {
    const permissions = {
      contains: vi.fn().mockResolvedValue(true),
      request: vi.fn(),
    };
    await expect(checkSyncHostPermission("https://project.example.com", permissions)).resolves.toBe(
      true
    );
    expect(permissions.request).not.toHaveBeenCalled();
  });
});
