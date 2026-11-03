import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSettings,
  invalidateSettingsCache,
  getPlaylists,
  invalidatePlaylistsCache,
  isBuilderEnabled,
  isSavedEnabled,
  hasFavorite,
  hasSavedPlaylists,
  buildDestinationLabel,
  buildScopesLabel,
} from "../../../background/menu-state.js";
import { getDefaultQuickAddSettings } from "../../../shared/quick-add.js";
import { DestinationType } from "../../../shared/quick-add.js";

describe("menu-state", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      getSettings: vi.fn(),
      getPlaylists: vi.fn(),
    });
    invalidateSettingsCache();
    invalidatePlaylistsCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getSettings", () => {
    it("returns cached settings when available", async () => {
      window.getSettings.mockResolvedValue({ disableContextBuilder: true });
      const first = await getSettings();
      const second = await getSettings();
      expect(first).toEqual({ disableContextBuilder: true });
      expect(second).toBe(first);
      expect(window.getSettings).toHaveBeenCalledTimes(1);
    });

    it("falls back to defaults when window.getSettings is unavailable", async () => {
      delete window.getSettings;
      const settings = await getSettings();
      expect(settings).toEqual(getDefaultQuickAddSettings());
    });

    it("invalidateSettingsCache clears the cache", async () => {
      window.getSettings.mockResolvedValue({ disableContextBuilder: true });
      await getSettings();
      invalidateSettingsCache();
      window.getSettings.mockResolvedValue({ disableContextBuilder: false });
      const settings = await getSettings();
      expect(settings).toEqual({ disableContextBuilder: false });
      expect(window.getSettings).toHaveBeenCalledTimes(2);
    });
  });

  describe("getPlaylists", () => {
    it("returns cached playlists when available", async () => {
      window.getPlaylists.mockResolvedValue([{ id: "pl1", title: "Playlist 1" }]);
      const first = await getPlaylists();
      const second = await getPlaylists();
      expect(first).toEqual([{ id: "pl1", title: "Playlist 1" }]);
      expect(second).toBe(first);
      expect(window.getPlaylists).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when window.getPlaylists is unavailable", async () => {
      delete window.getPlaylists;
      const playlists = await getPlaylists();
      expect(playlists).toEqual([]);
    });

    it("invalidatePlaylistsCache clears the cache", async () => {
      window.getPlaylists.mockResolvedValue([{ id: "pl1" }]);
      await getPlaylists();
      invalidatePlaylistsCache();
      window.getPlaylists.mockResolvedValue([{ id: "pl2" }]);
      const playlists = await getPlaylists();
      expect(playlists).toEqual([{ id: "pl2" }]);
    });
  });

  describe("isBuilderEnabled", () => {
    it("returns true when builder is not disabled", () => {
      expect(isBuilderEnabled({})).toBe(true);
      expect(isBuilderEnabled({ disableContextBuilder: false })).toBe(true);
    });

    it("returns false when builder is disabled", () => {
      expect(isBuilderEnabled({ disableContextBuilder: true })).toBe(false);
    });
  });

  describe("isSavedEnabled", () => {
    it("returns true when saved is not disabled", () => {
      expect(isSavedEnabled({})).toBe(true);
    });

    it("returns false when saved is disabled", () => {
      expect(isSavedEnabled({ disableContextSaved: true })).toBe(false);
    });
  });

  describe("hasFavorite", () => {
    it("returns true when watchLaterPlaylistId is set", () => {
      expect(hasFavorite({ watchLaterPlaylistId: "PL123" })).toBe(true);
    });

    it("returns false when watchLaterPlaylistId is not set", () => {
      expect(hasFavorite({})).toBe(false);
      expect(hasFavorite({ watchLaterPlaylistId: "" })).toBe(false);
    });
  });

  describe("hasSavedPlaylists", () => {
    it("returns true when playlists exist", async () => {
      window.getPlaylists.mockResolvedValue([{ id: "pl1" }]);
      expect(await hasSavedPlaylists()).toBe(true);
    });

    it("returns false when no playlists", async () => {
      window.getPlaylists.mockResolvedValue([]);
      expect(await hasSavedPlaylists()).toBe(false);
    });
  });

  describe("buildDestinationLabel", () => {
    it("returns a label string", () => {
      const label = buildDestinationLabel({});
      expect(label).toMatch(/^Destination: /);
    });
  });

  describe("buildScopesLabel", () => {
    it("returns a scopes label string", () => {
      const label = buildScopesLabel({});
      expect(label).toMatch(/^Add YouTube tabs to /);
    });
  });
});
