import { describe, it, expect } from "vitest";
import { getPlaylistCategory } from "./playlist-category";

describe("getPlaylistCategory", () => {
  it("marks local playlists", () => {
    expect(getPlaylistCategory({ id: "abc", isLocal: true })).toBe("local");
    expect(getPlaylistCategory({ id: "local-123" })).toBe("local");
  });

  it("marks virtual playlists", () => {
    expect(getPlaylistCategory({ id: "LIKED" })).toBe("liked");
    expect(getPlaylistCategory({ id: "UPLOADS" })).toBe("uploaded");
  });

  it("marks tagged vs account playlists", () => {
    expect(getPlaylistCategory({ id: "yt-1", isTagged: true })).toBe("youtube");
    expect(getPlaylistCategory({ id: "yt-2", isTagged: false })).toBe("account");
  });
});
