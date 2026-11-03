import { expect, it } from "vitest";
import { menuModel, staleMenuIds } from "../../../background/context-menu-model.js";
import { resolveDestination } from "../../../shared/quick-add.js";
it("keeps the native tree bounded regardless of saved playlist count", () => {
  const destinations = Array.from({ length: 14000 }, (_, index) => ({
    id: `local-${index}`,
    title: `Playlist ${index}`,
  }));
  expect(menuModel({}, destinations).length).toBe(menuModel({}, []).length);
  // Fixed structure: 3 destinations × 7 scopes + 3 destination parents + root items = 32
  expect(menuModel({}, destinations).length).toBe(32);
});
it("honors the master and independent destination switches", () => {
  expect(menuModel({ disableContextMenu: true }, [])).toEqual([]);
  const items = menuModel({ disableContextBuilder: true, disableContextSaved: true }, []);
  expect(items.some((item) => item.id.startsWith("yph:destination:"))).toBe(false);
  expect(items.map((item) => item.id)).toEqual(["yphContextRoot", "yph:settings"]);
});
it("hides the saved branch when saved destinations are disabled", () => {
  const items = menuModel({ disableContextSaved: true }, []);
  const ids = items.map((item) => item.id);
  expect(ids).not.toContain("yph:saved");
  expect(ids).not.toContain("yph:save-playlist");
  expect(ids).not.toContain("yph:import");
  expect(ids).not.toContain("yph:destination:favorite");
  expect(ids).not.toContain("yph:destination:latest");
  expect(ids).not.toContain("yph:destination:new");
  // No scope items either
  expect(ids.some((id) => id.startsWith("yph:scope:"))).toBe(false);
  expect(ids).toEqual(["yphContextRoot", "yph:settings"]);
});
it("shows three destination scope menus when saved is enabled", () => {
  const items = menuModel({ disableContextSaved: false }, []);
  const ids = items.map((item) => item.id);
  // Each destination gets its own top-level item with scope submenu
  expect(ids).toContain("yph:destination:favorite");
  expect(ids).toContain("yph:destination:latest");
  expect(ids).toContain("yph:destination:new");
  // Each has 7 scope children
  expect(ids.filter((id) => id.startsWith("yph:scope:favorite:")).length).toBe(7);
  expect(ids.filter((id) => id.startsWith("yph:scope:latest:")).length).toBe(7);
  expect(ids.filter((id) => id.startsWith("yph:scope:new:")).length).toBe(7);
});
it("destination items have correct labels", () => {
  const items = menuModel({ disableContextSaved: false }, []);
  const fav = items.find((item) => item.id === "yph:destination:favorite");
  const lat = items.find((item) => item.id === "yph:destination:latest");
  const neu = items.find((item) => item.id === "yph:destination:new");
  expect(fav.title).toBe("Add YouTube tabs to Favorite playlist");
  expect(lat.title).toBe("Add YouTube tabs to Latest playlist");
  expect(neu.title).toBe("Add YouTube tabs to Create new playlist");
});
it("never labels the scope submenu with a dynamic destination", () => {
  const items = menuModel({ disableContextSaved: false, defaultQuickAddTarget: "latest" }, [
    { id: "local-a", title: "Chocolate", timestamp: 5 },
  ]);
  // Scope items should have static titles (no playlist names)
  const scopeItems = items.filter((item) => item.id.startsWith("yph:scope:"));
  for (const scopeItem of scopeItems) {
    expect(scopeItem.title).not.toContain("Chocolate");
  }
});
it("uses the configured favorite and latest cached destination without substituting", () => {
  const playlists = [
    { id: "PLremote", title: "Remote", timestamp: 20 },
    { id: "local-a", title: "Local", timestamp: 10 },
  ];
  expect(resolveDestination("latest", {}, playlists).id).toBe("PLremote");
  expect(resolveDestination("favorite", { watchLaterPlaylistId: "missing" }, playlists)).toBeNull();
});
it("removes every previously created id that is no longer desired", () => {
  const desired = [{ id: "yphContextRoot" }, { id: "yph:settings" }];
  const previous = ["yphContextRoot", "yph:saved", "yph:scopes", "yph:import", "yph:settings"];
  expect(staleMenuIds(desired, previous)).toEqual(["yph:saved", "yph:scopes", "yph:import"]);
  expect(staleMenuIds([], previous)).toEqual(previous);
  expect(staleMenuIds(desired, [])).toEqual([]);
});
