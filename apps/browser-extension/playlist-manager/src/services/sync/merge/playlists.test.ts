import { describe, expect, it } from "vitest";
import { mergePlaylists } from "./playlists";

describe("sync v2 playlist merge", () => {
  it("keeps a playlist added on one side", () => {
    const base: any[] = [];
    const local: any[] = [
      { id: "p1", title: "A", videos: [], createdAt: 1, updatedAt: 1, revision: 1 },
    ];
    const remote: any[] = [];
    const { merged, conflicts } = mergePlaylists(local, remote, base);
    expect(merged.map((p) => p.id)).toContain("p1");
    expect(conflicts).toHaveLength(0);
  });

  it("applies a deletion from one side", () => {
    const p = { id: "p1", title: "A", videos: [], createdAt: 1, updatedAt: 1, revision: 1 };
    const base = [p];
    const local: any[] = [];
    const remote = [p];
    const { merged } = mergePlaylists(local, remote, base);
    // Deletion wins only if both sides... here local deleted, remote unchanged → deleted wins.
    expect(merged.map((x) => x.id)).not.toContain("p1");
  });

  it("merges concurrent video additions from both sides", () => {
    const base = [
      {
        id: "p1",
        title: "A",
        videos: [{ videoId: "v1" }],
        createdAt: 1,
        updatedAt: 1,
        revision: 1,
      },
    ];
    const local = [
      {
        id: "p1",
        title: "A",
        videos: [{ videoId: "v1" }, { videoId: "v2" }],
        createdAt: 1,
        updatedAt: 2,
        revision: 2,
      },
    ];
    const remote = [
      {
        id: "p1",
        title: "A",
        videos: [{ videoId: "v1" }, { videoId: "v3" }],
        createdAt: 1,
        updatedAt: 2,
        revision: 2,
      },
    ];
    const { merged } = mergePlaylists(local, remote, base);
    const ids = merged[0].videos.map((v: any) => v.videoId).sort();
    expect(ids).toEqual(["v1", "v2", "v3"]);
  });

  it("removes a video deleted on one side", () => {
    const base = [
      {
        id: "p1",
        title: "A",
        videos: [{ videoId: "v1" }, { videoId: "v2" }],
        createdAt: 1,
        updatedAt: 1,
        revision: 1,
      },
    ];
    const local = [
      {
        id: "p1",
        title: "A",
        videos: [{ videoId: "v1" }],
        createdAt: 1,
        updatedAt: 2,
        revision: 2,
      },
    ]; // v2 removed
    const remote = [
      {
        id: "p1",
        title: "A",
        videos: [{ videoId: "v1" }, { videoId: "v2" }],
        createdAt: 1,
        updatedAt: 2,
        revision: 2,
      },
    ];
    const { merged } = mergePlaylists(local, remote, base);
    const ids = merged[0].videos.map((v: any) => v.videoId);
    expect(ids).toEqual(["v1"]);
  });

  it("keeps the latest title (LWW)", () => {
    const base = [{ id: "p1", title: "Old", videos: [], createdAt: 1, updatedAt: 1, revision: 1 }];
    const local = [
      { id: "p1", title: "LocalTitle", videos: [], createdAt: 1, updatedAt: 2, revision: 2 },
    ];
    const remote = [
      { id: "p1", title: "RemoteTitle", videos: [], createdAt: 1, updatedAt: 3, revision: 3 },
    ];
    const { merged } = mergePlaylists(local, remote, base);
    expect(merged[0].title).toBe("RemoteTitle");
  });

  it("returns an empty merged list when everything is deleted on both sides", () => {
    const p = { id: "p1", title: "A", videos: [], createdAt: 1, updatedAt: 1, revision: 1 };
    const { merged } = mergePlaylists([], [], [p]);
    expect(merged).toHaveLength(0);
  });

  it("handles edits to different playlists independently", () => {
    const base = [
      { id: "p1", title: "A", videos: [], createdAt: 1, updatedAt: 1, revision: 1 },
      { id: "p2", title: "B", videos: [], createdAt: 1, updatedAt: 1, revision: 1 },
    ];
    const local = [{ id: "p1", title: "A2", videos: [], createdAt: 1, updatedAt: 2, revision: 2 }];
    const remote = [{ id: "p2", title: "B2", videos: [], createdAt: 1, updatedAt: 2, revision: 2 }];
    const { merged } = mergePlaylists(local, remote, base);
    expect(merged.find((p) => p.id === "p1")?.title).toBe("A2");
    expect(merged.find((p) => p.id === "p2")?.title).toBe("B2");
  });

  it("merges real IYPM string[] video ID lists and ISO timestamps without corrupting items", () => {
    const base = [
      {
        id: "local-1",
        title: "Music",
        videos: ["dQw4w9WgXcQ", "9bZkp7q19f0"],
        updatedAt: "2026-11-04T20:00:00.000Z",
        revision: 1,
      },
    ];
    const local = [
      {
        id: "local-1",
        title: "Music",
        videos: ["dQw4w9WgXcQ", "3JZ_D3ELwOQ"], // removed 9bZkp7q19f0, added 3JZ_D3ELwOQ
        updatedAt: "2026-11-04T21:00:00.000Z",
        revision: 2,
      },
    ];
    const remote = [
      {
        id: "local-1",
        title: "Music Mix",
        videos: ["dQw4w9WgXcQ", "9bZkp7q19f0", "kJQP7kiw5Fk"], // renamed + added kJQP7kiw5Fk
        updatedAt: "2026-11-04T20:30:00.000Z",
        revision: 2,
      },
    ];

    const { merged } = mergePlaylists(local, remote, base);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Music Mix");
    expect(merged[0].videos.every((v) => typeof v === "string")).toBe(true);
    expect(merged[0].videos).toEqual(["dQw4w9WgXcQ", "3JZ_D3ELwOQ", "kJQP7kiw5Fk"]);
    expect(typeof merged[0].updatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(String(merged[0].updatedAt)))).toBe(false);
  });

  it("supports last-write-wins strategy when configured", () => {
    const base = [{ id: "local-1", title: "Base", videos: ["v1"], updatedAt: 10, revision: 1 }];
    const local = [
      { id: "local-1", title: "Local", videos: ["v1", "v2"], updatedAt: 20, revision: 2 },
    ];
    const remote = [
      { id: "local-1", title: "Remote", videos: ["v1", "v3"], updatedAt: 30, revision: 2 },
    ];
    const { merged, conflicts } = mergePlaylists(local, remote, base, { strategy: "lww" });
    expect(merged[0].title).toBe("Remote");
    expect(merged[0].videos).toEqual(["v1", "v3"]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resolution).toBe("remote");
  });
});
