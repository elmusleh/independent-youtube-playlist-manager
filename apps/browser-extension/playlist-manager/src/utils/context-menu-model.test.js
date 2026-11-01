import { expect, it } from "vitest";
import { menuModel, staleMenuIds } from "../../../background/context-menu-model.js";
import { resolveDestination } from "../../../shared/quick-add.js";
it("keeps the native tree bounded regardless of saved playlist count", () => {
  const destinations = Array.from({ length: 14000 }, (_, index) => ({
    id: `local-${index}`,
    title: `Playlist ${index}`,
  }));
  expect(menuModel({}, destinations).length).toBe(menuModel({}, []).length);
  expect(menuModel({}, destinations).length).toBeLessThan(25);
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
  expect(ids).not.toContain("yph:destination:latest");
  expect(ids).toContain("yph:destination:builder");
  const scopes = items.find((item) => item.id === "yph:scopes");
  expect(scopes.title).toBe("Add YouTube tabs to Playlist Builder");
  expect(scopes.enabled).not.toBe(false);
});
it("hides the builder destination when only builder is disabled", () => {
  const items = menuModel({ disableContextBuilder: true, defaultQuickAddTarget: "builder" }, [
    { id: "local-a", title: "Local list", timestamp: 1 },
  ]);
  const ids = items.map((item) => item.id);
  expect(ids).not.toContain("yph:destination:builder");
  expect(ids).toContain("yph:saved");
  expect(items.find((item) => item.id === "yph:scopes").enabled).not.toBe(false);
});
it("never labels the scope submenu with a disabled destination", () => {
  const items = menuModel({ disableContextSaved: true, defaultQuickAddTarget: "latest" }, [
    { id: "local-a", title: "Chocolate", timestamp: 5 },
  ]);
  const scopes = items.find((item) => item.id === "yph:scopes");
  expect(scopes.title).not.toContain("Chocolate");
  expect(scopes.title).toBe("Add YouTube tabs to Playlist Builder");
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
