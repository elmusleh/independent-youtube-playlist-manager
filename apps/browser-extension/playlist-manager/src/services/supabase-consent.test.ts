import { afterEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => sdk);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

function firefox(granted: string[] = []) {
  const api = {
    runtime: {
      getManifest: () => ({
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: {
              optional: ["authenticationInfo", "personallyIdentifyingInfo"],
            },
          },
        },
      }),
    },
    permissions: {
      getAll: vi.fn().mockResolvedValue({ data_collection: granted }),
      request: vi.fn().mockResolvedValue(false),
    },
  };
  vi.stubGlobal("browser", api);
  return api;
}

it("does not initialize the SDK or refresh persisted sessions before consent", async () => {
  firefox();
  const { getSession, getSupabaseClient } = await import("./supabase-client");
  expect(await getSession()).toBeNull();
  await expect(getSupabaseClient()).rejects.toThrow("Data permission");
  expect(sdk.createClient).not.toHaveBeenCalled();
});

it("a declined sign-in cannot pass credentials to the SDK", async () => {
  const api = firefox();
  const { loginWithEmail } = await import("./supabase-client");
  await expect(loginWithEmail("test@example.invalid", "test-only")).rejects.toThrow(
    "Permission declined"
  );
  expect(api.permissions.request).toHaveBeenCalledOnce();
  expect(sdk.createClient).not.toHaveBeenCalled();
});

it("guards SDK network requests again after consent is revoked", async () => {
  const api = firefox(["authenticationInfo", "personallyIdentifyingInfo"]);
  sdk.createClient.mockReturnValue({});
  const network = vi.fn().mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", network);
  const { getSupabaseClient } = await import("./supabase-client");
  await getSupabaseClient();
  const guardedFetch = sdk.createClient.mock.calls[0][2].global.fetch;
  await guardedFetch("https://example.invalid");
  expect(network).toHaveBeenCalledOnce();
  api.permissions.getAll.mockResolvedValue({ data_collection: [] });
  await expect(guardedFetch("https://example.invalid")).rejects.toThrow("Data permission");
  expect(network).toHaveBeenCalledOnce();
});
