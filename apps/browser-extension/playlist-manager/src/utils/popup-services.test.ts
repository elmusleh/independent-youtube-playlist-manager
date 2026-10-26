import { afterEach, expect, it, vi } from "vitest";
import { isYoutubeVideoTab, getAllVideoTabsAcrossWindows } from "../../../popup/tabs.js";
import { scrapeMetadataFromTabs } from "../../../popup/scrape-tabs.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).videoService;
});
it("collects mobile, Shorts, and shortened video URLs while rejecting lookalikes", async () => {
  const tabs = [
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
  ].map((url, id) => ({ url, id }));
  for (const tab of tabs) expect(isYoutubeVideoTab(tab)).toBe(true);
  for (const url of [
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=bad",
    "https://www.youtube.com/playlist?list=test",
    "invalid",
  ])
    expect(isYoutubeVideoTab({ url })).toBe(false);
  vi.stubGlobal("browser", {
    tabs: { query: vi.fn().mockResolvedValue([...tabs, { url: "about:blank" }]) },
  });
  expect(await getAllVideoTabsAcrossWindows()).toEqual(tabs);
});
it("writes scraped metadata through the shared IndexedDB service", async () => {
  const cacheMetadata = vi.fn().mockResolvedValue(undefined);
  (window as any).videoService = { cacheMetadata };
  const storageSet = vi.fn();
  vi.stubGlobal("browser", {
    scripting: {
      executeScript: vi.fn().mockResolvedValue([
        {
          result: {
            videoId: "dQw4w9WgXcQ",
            title: "Video",
            channel: "Channel",
            durationISO: "PT2M",
          },
        },
      ]),
    },
    storage: { local: { set: storageSet } },
  });
  await scrapeMetadataFromTabs([{ id: 1, url: "https://m.youtube.com/watch?v=dQw4w9WgXcQ" }]);
  expect(cacheMetadata).toHaveBeenCalledWith(
    expect.objectContaining({
      dQw4w9WgXcQ: expect.objectContaining({ title: "Video", durationSeconds: 120 }),
    })
  );
  expect(storageSet).not.toHaveBeenCalled();
});
