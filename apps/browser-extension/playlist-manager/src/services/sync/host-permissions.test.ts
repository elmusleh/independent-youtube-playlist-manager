import { describe, expect, it, vi } from "vitest";
import { requestSyncHostPermission, syncHostPermissionPattern } from "./host-permissions";

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
  it("requests the exact origin when it has not already been granted", async () => {
    const permissions = {
      contains: vi.fn().mockResolvedValue(false),
      request: vi.fn().mockResolvedValue(true),
    };

    await expect(
      requestSyncHostPermission("https://project.example.com", permissions)
    ).resolves.toBe(true);
    expect(permissions.contains).toHaveBeenCalledWith({
      origins: ["https://project.example.com/*"],
    });
    expect(permissions.request).toHaveBeenCalledWith({
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
});
