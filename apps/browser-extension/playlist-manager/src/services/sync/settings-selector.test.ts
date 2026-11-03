import { describe, expect, it } from "vitest";
import { selectSyncableSettings } from "./settings-selector";

describe("selectSyncableSettings", () => {
  it("keeps known preferences and drops local credentials and data", () => {
    const syncConfig = { syncKey: "secret", supabaseKey: "private" };
    const history = { video1: { watchedAt: 123 } };
    const selected = selectSyncableSettings({
      themeChoice: "dark",
      defaultPageSize: 50,
      yph_sync_config: syncConfig,
      yph_supabase_config: { key: "private" },
      local_yt_history: history,
      apiKey: "private",
      authToken: "private",
    });

    expect(selected).toEqual({ themeChoice: "dark", defaultPageSize: 50 });
    expect(JSON.stringify(selected)).not.toContain("secret");
    expect(JSON.stringify(selected)).not.toContain("watchedAt");
  });

  it("ignores non-object inputs", () => {
    expect(selectSyncableSettings(null)).toEqual({});
    expect(selectSyncableSettings([])).toEqual({});
    expect(selectSyncableSettings("themeChoice=dark")).toEqual({});
  });
});
