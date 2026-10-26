import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./db-service.js", () => ({
  dbGetMetadata: db.get,
  dbGetMetadataBatch: vi.fn(),
  dbPutMetadata: vi.fn(),
  dbPutMetadataBatch: vi.fn(),
  dbDeleteMetadata: vi.fn(),
  dbClearMetadata: vi.fn(),
  dbGetStats: vi.fn(),
}));
beforeEach(async () => {
  vi.stubGlobal("browser", {
    runtime: { sendMessage: vi.fn() },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  });
  window.isoToSecs = () => 90;
  window.ytFetchVideoDurations = vi
    .fn()
    .mockResolvedValue(
      new Map([
        [
          "dQw4w9WgXcQ",
          { title: "Video", channel: "Channel", durationISO: "PT1M30S", durationSeconds: 90 },
        ],
      ])
    );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Video", author_name: "Channel" }),
    })
  );
  db.get.mockResolvedValue({
    title: "Video",
    channel: "Channel",
    durationISO: "",
    durationSeconds: 0,
  });
  await import("./video-service");
});
it("does not treat title-only cached import metadata as complete", async () => {
  expect(await window.videoService.shouldSkipFetch("dQw4w9WgXcQ")).toBe(false);
});
it("enriches a cached title with duration from normalized engine results", async () => {
  const video = await window.videoService.fetchVideo("dQw4w9WgXcQ");
  expect(video.durationISO).toBe("PT1M30S");
});
