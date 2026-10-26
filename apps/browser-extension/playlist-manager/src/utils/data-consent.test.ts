import { afterEach, expect, it, vi } from "vitest";
import {
  ACCOUNT_DATA,
  hasDataConsent,
  requestDataConsent,
  requireDataConsent,
} from "./data-consent";

function firefox(granted: string[] = []) {
  const api = {
    runtime: {
      getManifest: () => ({
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { optional: [...ACCOUNT_DATA, "searchTerms"] },
          },
        },
      }),
    },
    permissions: {
      getAll: vi.fn().mockResolvedValue({ data_collection: granted }),
      request: vi.fn().mockResolvedValue(true),
    },
  };
  vi.stubGlobal("browser", api);
  return api;
}
afterEach(() => vi.unstubAllGlobals());

it("leaves Chrome account and search flows unchanged", async () => {
  vi.stubGlobal("browser", undefined);
  vi.stubGlobal("chrome", { runtime: { getManifest: () => ({ manifest_version: 3 }) } });
  expect(await hasDataConsent(ACCOUNT_DATA)).toBe(true);
  await expect(requestDataConsent(["searchTerms"])).resolves.toBeUndefined();
});
it("blocks background access without prompting or trusting a partial grant", async () => {
  const api = firefox(["authenticationInfo"]);
  expect(await hasDataConsent(ACCOUNT_DATA)).toBe(false);
  await expect(requireDataConsent(ACCOUNT_DATA)).rejects.toThrow("Data permission");
  expect(api.permissions.request).not.toHaveBeenCalled();
});
it("requests only the feature's declared optional data, synchronously in the action", async () => {
  const api = firefox();
  const pending = requestDataConsent(["searchTerms"]);
  expect(api.permissions.request).toHaveBeenCalledWith({ data_collection: ["searchTerms"] });
  await pending;
});
it("reports declined permission and continues blocking access", async () => {
  const api = firefox();
  api.permissions.request.mockResolvedValue(false);
  await expect(requestDataConsent(ACCOUNT_DATA)).rejects.toThrow("Permission declined");
  expect(await hasDataConsent(ACCOUNT_DATA)).toBe(false);
});
it("recognizes grants and notices revocation on the next request", async () => {
  const api = firefox(ACCOUNT_DATA);
  await expect(requireDataConsent(ACCOUNT_DATA)).resolves.toBeUndefined();
  api.permissions.getAll.mockResolvedValue({ data_collection: [] });
  await expect(requireDataConsent(ACCOUNT_DATA)).rejects.toThrow("Data permission");
});
it("fails closed if permission checks are unavailable or fail", async () => {
  const api = firefox();
  api.permissions.getAll.mockRejectedValue(new Error("unavailable"));
  expect(await hasDataConsent(ACCOUNT_DATA)).toBe(false);
  api.permissions.getAll.mockResolvedValue({} as any);
  expect(await hasDataConsent(ACCOUNT_DATA)).toBe(false);
});
