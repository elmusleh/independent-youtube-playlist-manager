import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { libraryFixture } from "../test-support/library-fixture";
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const source = { id: 7, windowId: 2, url: "https://example.org/article" };
async function setup() {
  const fixture = await libraryFixture();
  fixture.api.tabs.get.mockResolvedValue(source);
  fixture.api.scripting.executeScript.mockResolvedValue([
    { result: { links: [{ id: "abcdefghijk" }] } },
  ]);
  const imports = await import("../../../background/capture-import.js");
  return { ...fixture, ...imports };
}
it("uses the captured top-frame source before opening the review page", async () => {
  const { scanPage, api } = await setup();
  await scanPage(source);
  expect(api.scripting.executeScript).toHaveBeenCalledWith({
    target: { tabId: 7, frameIds: [0] },
    files: ["/content-scripts/injectors/scrape-youtube-links.js"],
  });
  expect(api.scripting.executeScript.mock.invocationCallOrder[0]).toBeLessThan(
    api.tabs.create.mock.invocationCallOrder[0]
  );
});
it("rejects navigation before injection, rather than scanning another page", async () => {
  const { scanPage, api } = await setup();
  api.tabs.get.mockResolvedValue({ ...source, url: "https://example.org/other" });
  await expect(scanPage(source)).rejects.toThrow(/changed/);
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
});
it("rejects navigation during scanning and never opens a successful review", async () => {
  const { scanPage, api } = await setup();
  api.tabs.get.mockResolvedValueOnce(source).mockResolvedValueOnce({ ...source, windowId: 8 });
  await expect(scanPage(source)).rejects.toThrow(/changed/);
  expect(api.tabs.create).not.toHaveBeenCalled();
});
it("explains lost activeTab access without requesting broader host permissions", async () => {
  const { scanPage, api } = await setup();
  api.scripting.executeScript.mockRejectedValue(new Error("Cannot access contents of url"));
  await expect(scanPage(source)).rejects.toThrow(/Protected pages|permissions/);
  expect(api.tabs.create).not.toHaveBeenCalled();
});
it("rejects private and protected sources without executing scripts", async () => {
  const { scanPage, api } = await setup();
  await expect(scanPage({ ...source, incognito: true })).rejects.toThrow(/private/);
  await expect(scanPage({ ...source, url: "chrome://settings" })).rejects.toThrow(/HTTP/);
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
});
it("validates options and preserves zero as unlimited for channel scrolling", async () => {
  const { scanPage, scanExistingJob, api } = await setup();
  const channel = { ...source, url: "https://www.youtube.com/@channel/videos" };
  api.tabs.get.mockResolvedValue(channel);
  const job = await scanPage(channel);
  await expect(scanExistingJob(job.id, -1)).rejects.toThrow(/quantity/);
  api.scripting.executeScript
    .mockResolvedValueOnce([{ result: null }])
    .mockResolvedValueOnce([{ result: [{ id: "abcdefghijk" }] }]);
  await scanExistingJob(job.id, 0);
  expect(api.scripting.executeScript).toHaveBeenCalledWith(
    expect.objectContaining({ args: [0], target: { tabId: 7, frameIds: [0] } })
  );
});
it("forwards scraped title, channel and duration to the page metadata cache", async () => {
  const { cacheScrapedMetadata } = await setup();
  const cache = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("videoService", { cacheScrapedMetadata: cache });
  const count = await cacheScrapedMetadata([
    { id: "abcdefghijk", title: "  Track  ", channel: "Chan", durationLabel: "1:02:03" },
    { id: "", title: "no id, must be ignored" },
    { id: "zzzzzzzzzzz", durationLabel: "not a duration" },
  ]);
  expect(count).toBe(1);
  expect(cache).toHaveBeenCalledTimes(1);
  expect(cache.mock.calls[0][0]).toEqual({
    abcdefghijk: expect.objectContaining({
      videoId: "abcdefghijk",
      title: "Track",
      channel: "Chan",
      durationISO: "PT1H2M3S",
      durationSeconds: 3723,
      isLive: false,
    }),
  });
});
it("does not throw when the page service is absent from the worker", async () => {
  const { cacheScrapedMetadata } = await setup();
  vi.stubGlobal("videoService", undefined);
  await expect(cacheScrapedMetadata([{ id: "abcdefghijk", title: "T" }])).resolves.toBe(1);
});
