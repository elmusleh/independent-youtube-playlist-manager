import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isDataApiPaused,
  markDataApiFailure,
  markDataApiSuccess,
  readDataApiHealth,
  resetDataApiHealth,
} from "./data-api-health";

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  (globalThis as any).browser = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (value: Record<string, unknown>) => {
          Object.assign(store, value);
        }),
      },
    },
  };
});

afterEach(() => {
  delete (globalThis as any).browser;
});

describe("data API health", () => {
  it("defaults to unknown when no health is stored", async () => {
    await expect(readDataApiHealth()).resolves.toMatchObject({ state: "unknown" });
    await expect(isDataApiPaused()).resolves.toBe(false);
  });

  it("pauses after a quota failure and clears on success", async () => {
    const health = await markDataApiFailure("quotaExceeded", 403, "Daily quota exceeded");
    expect(health.state).toBe("quota_exceeded");
    expect(health.blockedUntil).toBeGreaterThan(Date.now());
    await expect(isDataApiPaused()).resolves.toBe(true);

    const reset = await markDataApiSuccess();
    expect(reset).toMatchObject({ state: "ok", blockedUntil: 0 });
    await expect(isDataApiPaused()).resolves.toBe(false);
  });

  it("resets to unknown when the key changes", async () => {
    await markDataApiFailure("quotaExceeded", 403, "Daily quota exceeded");
    await resetDataApiHealth();
    await expect(readDataApiHealth()).resolves.toMatchObject({ state: "unknown", blockedUntil: 0 });
  });

  it("classifies rate limits and invalid keys", async () => {
    await expect(markDataApiFailure("rateLimitExceeded", 403, "Slow down")).resolves.toMatchObject({
      state: "rate_limited",
    });
    await expect(markDataApiFailure("keyInvalid", 400, "Bad key")).resolves.toMatchObject({
      state: "invalid",
    });
  });
});
