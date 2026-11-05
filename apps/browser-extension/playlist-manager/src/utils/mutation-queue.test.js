import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueuePlaylistMutation,
  getPlaylistsRevision,
} from "../../../background/mutation-queue.js";

describe("mutation-queue", () => {
  beforeEach(() => {
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getPlaylistsRevision", () => {
    it("returns 0 when no revision stored", async () => {
      browser.storage.local.get.mockResolvedValue({});
      expect(await getPlaylistsRevision()).toBe(0);
    });

    it("returns stored revision", async () => {
      browser.storage.local.get.mockResolvedValue({ yph_playlists_revision: 5 });
      expect(await getPlaylistsRevision()).toBe(5);
    });
  });

  describe("enqueuePlaylistMutation", () => {
    it("executes mutation and increments revision on success", async () => {
      browser.storage.local.get.mockResolvedValue({ yph_playlists_revision: 0 });
      browser.storage.local.set.mockResolvedValue(undefined);

      const mutationFn = vi.fn().mockResolvedValue("result");
      const result = await enqueuePlaylistMutation(mutationFn, 0);

      expect(result).toBe("result");
      expect(mutationFn).toHaveBeenCalledOnce();
      expect(browser.storage.local.set).toHaveBeenCalledWith({ yph_playlists_revision: 1 });
    });

    it("rejects on stale revision", async () => {
      browser.storage.local.get.mockResolvedValue({ yph_playlists_revision: 5 });

      const mutationFn = vi.fn().mockResolvedValue("result");
      await expect(enqueuePlaylistMutation(mutationFn, 3)).rejects.toThrow("Stale revision");
      expect(mutationFn).not.toHaveBeenCalled();
    });

    it("rejects when mutation throws", async () => {
      browser.storage.local.get.mockResolvedValue({ yph_playlists_revision: 0 });

      const mutationFn = vi.fn().mockRejectedValue(new Error("boom"));
      await expect(enqueuePlaylistMutation(mutationFn, 0)).rejects.toThrow("boom");
    });

    it("serializes concurrent mutations", async () => {
      let revision = 0;
      browser.storage.local.get.mockImplementation(() =>
        Promise.resolve({ yph_playlists_revision: revision })
      );
      browser.storage.local.set.mockImplementation((data) => {
        revision = data.yph_playlists_revision;
        return Promise.resolve();
      });

      const results = [];
      const p1 = enqueuePlaylistMutation(async () => {
        results.push("first");
        return "first";
      }, 0);
      const p2 = enqueuePlaylistMutation(async () => {
        results.push("second");
        return "second";
      }, 1);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe("first");
      expect(r2).toBe("second");
      expect(results).toEqual(["first", "second"]);
    });
  });
});
