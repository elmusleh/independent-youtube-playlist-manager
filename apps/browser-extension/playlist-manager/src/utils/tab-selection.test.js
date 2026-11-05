import { expect, it } from "vitest";
import { parseYouTubeVideoId, tabsForScope, youtubeTabs } from "../../../shared/tab-selection.js";

const video = "abcdefghijk";
it.each([
  `https://www.youtube.com/watch?v=${video}`,
  `https://m.youtube.com/watch?v=${video}`,
  `https://youtu.be/${video}`,
  `https://www.youtube.com/shorts/${video}`,
  `https://www.youtube.com/embed/${video}`,
  `https://www.youtube.com/live/${video}`,
])("accepts supported video URL %s", (url) => {
  expect(parseYouTubeVideoId(url)).toBe(video);
});
it.each([
  `ftp://youtube.com/watch?v=${video}`,
  `https://youtube.com.evil.test/watch?v=${video}`,
  "https://youtube.com/watch?v=bad",
  `https://youtu.be/${video}/extra`,
  `https://youtube.com/embed/${video}extra`,
])("rejects invalid video URL %s", (url) => {
  expect(parseYouTubeVideoId(url)).toBeNull();
});
const anchor = { id: 5, windowId: 20, index: 1, highlighted: false };
const tabs = [
  { id: 1, windowId: 10, index: 1, highlighted: true },
  { id: 2, windowId: 20, index: 0, highlighted: true },
  anchor,
  { id: 3, windowId: 10, index: 0 },
  { id: 4, windowId: 20, index: 2 },
  { id: 6, windowId: 20, index: 3, incognito: true },
];
it.each([
  ["current", [5]],
  ["selected", [5]],
  ["left", [2]],
  ["right", [4]],
  ["window", [2, 5, 4]],
  ["other", [2, 4]],
  ["all", [2, 5, 4, 3, 1]],
])("resolves %s from an inactive anchor", (scope, ids) => {
  expect(tabsForScope(scope, anchor, tabs).map((tab) => tab.id)).toEqual(ids);
});
it("selects highlighted tabs only in the anchor window", () => {
  const selected = { ...anchor, highlighted: true };
  expect(
    tabsForScope(
      "selected",
      selected,
      tabs.map((tab) => (tab.id === 5 ? selected : tab))
    ).map((tab) => tab.id)
  ).toEqual([2, 5]);
});
it("rejects private anchors, missing anchors and unknown scopes", () => {
  expect(tabsForScope("all", { ...anchor, incognito: true }, tabs)).toEqual([]);
  expect(tabsForScope("all", undefined, tabs)).toEqual([]);
  expect(tabsForScope("invalid", anchor, tabs)).toEqual([]);
});
it("deduplicates valid IDs without capturing private tabs", () => {
  const url = `https://youtu.be/${video}`;
  expect(
    youtubeTabs([
      { id: 1, url, incognito: true },
      { id: 2, url },
      { id: 3, url },
    ]).map((item) => item.tab.id)
  ).toEqual([2]);
});
