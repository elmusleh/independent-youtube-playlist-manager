import { it, expect, vi, afterEach } from "vitest";
vi.mock("./db-service.js", () => ({ dbPutMetadataBatch: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("continues to a duration-capable source after oEmbed returns only a title", async () => {
  await import("./youtube-api");
  window.getSettings = vi
    .fn()
    .mockResolvedValue({ enableInnertubeScraping: false, enableEmbedScraping: false });
  window.fetchVideoMetadataOEmbed = vi
    .fn()
    .mockResolvedValue({ title: "Video", channel: "Channel", duration: "" });
  window.fetchDurationsInvidious = vi
    .fn()
    .mockResolvedValue(
      new Map([["dQw4w9WgXcQ", { title: "Video", channel: "Channel", duration: "PT2M" }]])
    );
  window.getYouTubeToken = vi.fn().mockRejectedValue(new Error("signed out"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await window.ytFetchVideoDurations(["dQw4w9WgXcQ"]);
  expect(result.get("dQw4w9WgXcQ")?.durationISO).toBe("PT2M");
});
