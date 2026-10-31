import { expect, it } from "vitest";
import { menuModel } from "../../../background/context-menu-model.js";
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
  expect(items.find((item) => item.id === "yph:scopes").enabled).toBe(false);
});
it("uses the configured favorite and latest cached destination without substituting", () => {
  const playlists = [
    { id: "PLremote", title: "Remote", timestamp: 20 },
    { id: "local-a", title: "Local", timestamp: 10 },
  ];
  expect(resolveDestination("latest", {}, playlists).id).toBe("PLremote");
  expect(resolveDestination("favorite", { watchLaterPlaylistId: "missing" }, playlists)).toBeNull();
});
