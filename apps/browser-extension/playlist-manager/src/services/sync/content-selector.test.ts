import { describe, expect, it } from "vitest";
import {
  DEFAULT_SYNC_SELECTION,
  SYNC_CATEGORIES,
  categoriesInPayload,
  isCategoryEnabled,
  selectSyncContent,
} from "./content-selector";

const source = {
  playlists: [{ id: "local-1" }],
  metadata: { dQw4w9WgXcQ: { durationISO: "PT3M33S" } },
  thumbnails: { dQw4w9WgXcQ: "data:image/jpeg;base64,AAA" },
  history: { dQw4w9WgXcQ: { t: 12 } },
  settings: { themeChoice: "dark" },
};

describe("sync content selection", () => {
  it("includes everything but thumbnails by default", () => {
    const payload = selectSyncContent(source);
    expect(payload.includedCategories).toEqual(["playlists", "metadata", "history", "settings"]);
    expect(payload.thumbnails).toBeUndefined();
  });

  it("drops a category the user disabled", () => {
    const payload = selectSyncContent(source, { ...DEFAULT_SYNC_SELECTION, metadata: false });
    expect(payload.metadata).toBeUndefined();
    expect(payload.includedCategories).not.toContain("metadata");
  });

  it("restores a category when re-enabled", () => {
    const payload = selectSyncContent(source, { ...DEFAULT_SYNC_SELECTION, metadata: true });
    expect(payload.metadata).toEqual(source.metadata);
    expect(payload.includedCategories).toContain("metadata");
  });

  it("records only categories that were both enabled and present", () => {
    const payload = selectSyncContent({ playlists: [] }, DEFAULT_SYNC_SELECTION);
    expect(payload.includedCategories).toEqual(["playlists"]);
    expect(payload.settings).toBeUndefined();
  });

  it("keeps empty but present values (empty playlist list is meaningful)", () => {
    const payload = selectSyncContent({ playlists: [] }, DEFAULT_SYNC_SELECTION);
    expect(payload.playlists).toEqual([]);
  });

  it("never mutates the caller's data", () => {
    const copy = structuredClone(source);
    selectSyncContent(source, { ...DEFAULT_SYNC_SELECTION, thumbnails: true });
    expect(source).toEqual(copy);
  });

  it("treats a missing toggle as the default", () => {
    expect(isCategoryEnabled({}, "thumbnails")).toBe(false);
    expect(isCategoryEnabled({}, "playlists")).toBe(true);
    expect(isCategoryEnabled({ playlists: false }, "playlists")).toBe(false);
  });

  it("reads categories from older payloads without an include list", () => {
    const legacy = { playlists: [], settings: {} } as never;
    expect(categoriesInPayload(legacy)).toEqual(["playlists", "settings"]);
    expect(categoriesInPayload(undefined)).toEqual([]);
  });

  it("covers every declared category", () => {
    const payload = selectSyncContent(source, {
      playlists: true,
      metadata: true,
      thumbnails: true,
      history: true,
      settings: true,
    });
    expect(payload.includedCategories).toEqual([...SYNC_CATEGORIES]);
  });
});
