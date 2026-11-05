import { describe, expect, it } from "vitest";
import { isSyncableSetting, mergeSettings } from "./settings";

describe("sync v2 settings merge", () => {
  it("keeps locally changed syncable keys", () => {
    const base: any = { themeChoice: "light", defaultPageSize: 20 };
    const local: any = { themeChoice: "dark", defaultPageSize: 20 };
    const remote: any = { themeChoice: "light", defaultPageSize: 20 };
    const { merged } = mergeSettings(local, remote, base);
    expect((merged as any).themeChoice).toBe("dark");
  });

  it("keeps keys present on only one side when syncable", () => {
    const base: any = {};
    const local: any = { themeChoice: "dark" };
    const remote: any = { metadataPageSize: 50 };
    const { merged } = mergeSettings(local, remote, base);
    expect((merged as any).themeChoice).toBe("dark");
    expect((merged as any).metadataPageSize).toBe(50);
  });

  it("isSyncableSetting filters device-local keys", () => {
    expect(isSyncableSetting("favoritePlaylistIds")).toBe(true);
    expect(isSyncableSetting("watchLaterPlaylistId")).toBe(true);
    expect(isSyncableSetting("themeChoice")).toBe(true);
    expect(isSyncableSetting("defaultPageSize")).toBe(true);
    expect(isSyncableSetting("yt_auth_token_cache")).toBe(false);
    expect(isSyncableSetting("yph_sync_config")).toBe(false);
    expect(isSyncableSetting("custom_yt_credentials")).toBe(false);
  });

  it("applies remote changes when local still matches base", () => {
    const base: any = { themeChoice: "dark" };
    const local: any = { themeChoice: "dark" };
    const remote: any = { themeChoice: "light" };
    const { merged } = mergeSettings(local, remote, base);
    expect(merged.themeChoice).toBe("light");
  });

  it("merges concurrent favoritePlaylistIds additions in 3-way merge mode", () => {
    const base: any = { favoritePlaylistIds: ["local-1"] };
    const local: any = { favoritePlaylistIds: ["local-1", "local-2"] };
    const remote: any = { favoritePlaylistIds: ["local-1", "local-3"] };
    const { merged } = mergeSettings(local, remote, base, { strategy: "merge" });
    expect(merged.favoritePlaylistIds).toEqual(["local-1", "local-3", "local-2"]);
  });
});
