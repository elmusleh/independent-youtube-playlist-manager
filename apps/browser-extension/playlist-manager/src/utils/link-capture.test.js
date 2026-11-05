import { expect, it } from "vitest";
import { linkCaptureVideoId } from "../../../shared/link-capture.js";

const video = "abcdefghijk";
const watch = `https://www.youtube.com/watch?v=${video}`;

it("captures the clicked YouTube video link", () => {
  expect(
    linkCaptureVideoId("link", { linkUrl: `https://youtu.be/${video}` }, "https://example.com")
  ).toBe(video);
  expect(linkCaptureVideoId("link", { linkUrl: watch }, "https://example.com")).toBe(video);
});

it("never substitutes the current page for a YouTube link that is not a video", () => {
  // Real click data always carries pageUrl and srcUrl, so a link must not fall
  // through to either: right-clicking a channel, playlist or search link on a
  // watch page must not capture the video that happens to be open.
  const click = (linkUrl) => ({ linkUrl, pageUrl: watch, srcUrl: "blob:https://x/1" });
  expect(linkCaptureVideoId("link", click("https://www.youtube.com/@somebody"), watch)).toBeNull();
  expect(
    linkCaptureVideoId(
      "link",
      click("https://www.youtube.com/playlist?list=PLabcdefghijklmnop"),
      watch
    )
  ).toBeNull();
  expect(linkCaptureVideoId("link", click("https://example.com/x"), watch)).toBeNull();
});

it("falls back to the page for page, video and image contexts", () => {
  expect(linkCaptureVideoId("video", { srcUrl: "blob:https://www.youtube.com/1234" }, watch)).toBe(
    video
  );
  expect(linkCaptureVideoId("image", { srcUrl: "https://i.ytimg.com/vi/x/hq.jpg" }, watch)).toBe(
    video
  );
  expect(linkCaptureVideoId("page", {}, watch)).toBe(video);
  expect(linkCaptureVideoId("frame", { pageUrl: watch }, undefined)).toBe(video);
});

it("returns null when no context yields a video", () => {
  expect(linkCaptureVideoId("page", {}, "https://example.com")).toBeNull();
  expect(linkCaptureVideoId("link", { pageUrl: watch }, watch)).toBeNull();
  expect(linkCaptureVideoId("video", { srcUrl: "blob:x" }, undefined)).toBeNull();
});
