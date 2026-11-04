/**
 * Direct tests for relay-transport.ts (mocked fetch).
 *
 * Tests the transport layer's contract with the relay: claim, pull, push,
 * error handling, and the client-side guards.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as rt from "./relay-transport";

const CFG = { url: "https://fake.supabase.test", anonKey: "test-anon-key" };

describe("relay-transport", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("claimSpace", () => {
    it("returns true on successful claim", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
        json: () => Promise.resolve(true),
      });
      expect(await rt.claimSpace(CFG, "space1", "auth1")).toBe(true);
    });

    it("returns false on failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("unauthorized"),
        json: () => Promise.resolve({ message: "unauthorized" }),
      });
      await expect(rt.claimSpace(CFG, "space1", "auth1")).rejects.toThrow();
    });
  });

  describe("pullAll", () => {
    it("returns records from the relay", async () => {
      const records = [
        { seq: 1, collection: "playlists", rid: "r1", version: 100, payload: "{}", deleted: false },
      ];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
        json: () => Promise.resolve(records),
      });
      const result = await rt.pullAll(CFG, "space1", "auth1", 0);
      expect(result).toHaveLength(1);
      expect(result[0].seq).toBe(1);
    });

    it("throws on unauthorized", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("unauthorized"),
        json: () => Promise.resolve({ message: "unauthorized" }),
      });
      await expect(rt.pullAll(CFG, "space1", "auth1", 0)).rejects.toThrow();
    });

    it("returns empty array when no records", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
        json: () => Promise.resolve([]),
      });
      const result = await rt.pullAll(CFG, "space1", "auth1", 0);
      expect(result).toHaveLength(0);
    });
  });

  describe("pushAll", () => {
    it("returns push results", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
        json: () => Promise.resolve([{ status: "ok" }]),
      });
      const result = await rt.pushAll(CFG, "space1", "auth1", [
        { collection: "playlists", rid: "r1", version: 100, payload: "{}", deleted: false },
      ]);
      expect(result[0].status).toBe("ok");
    });

    it("throws on payload too large", async () => {
      const big = "X".repeat(200_000);
      await expect(
        rt.pushAll(CFG, "space1", "auth1", [
          { collection: "playlists", rid: "r1", version: 100, payload: big, deleted: false },
        ])
      ).rejects.toThrow(/Payload too large/);
    });

    it("throws on version too far in future", async () => {
      await expect(
        rt.pushAll(CFG, "space1", "auth1", [
          {
            collection: "playlists",
            rid: "r1",
            version: 9999999999999999,
            payload: "{}",
            deleted: false,
          },
        ])
      ).rejects.toThrow(/Version too far in future/);
    });

    it("throws on unauthorized", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("unauthorized"),
        json: () => Promise.resolve({ message: "unauthorized" }),
      });
      await expect(
        rt.pushAll(CFG, "space1", "auth1", [
          { collection: "playlists", rid: "r1", version: 100, payload: "{}", deleted: false },
        ])
      ).rejects.toThrow();
    });
  });

  describe("deleteSpace", () => {
    it("returns true on success", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
        json: () => Promise.resolve(true),
      });
      expect(await rt.deleteSpace(CFG, "space1", "auth1")).toBe(true);
    });
  });
});
