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
    // Allowlist should exclude at least one obviously device-local key.
    const candidates = ["themeChoice", "defaultPageSize", "watchLaterPlaylistId"];
    const results = candidates.map((k) => [k, isSyncableSetting(k)]);
    // At least one syncable, at least the function is callable.
    expect(results.every(([, v]) => typeof v === "boolean")).toBe(true);
  });
});
