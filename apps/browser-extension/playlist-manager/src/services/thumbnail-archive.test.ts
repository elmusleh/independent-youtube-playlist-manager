import { expect, it, vi, beforeEach, afterEach } from "vitest";
const images = vi.hoisted(() => new Map<string, string>());
vi.mock("idb-keyval", () => ({
  createStore: () => ({}),
  get: async (id: string) => images.get(id),
  set: async (id: string, data: string) => images.set(id, data),
  clear: async () => images.clear(),
  entries: async () => [...images.entries()],
}));
import {
  archiveThumbnail,
  readArchivedThumbnail,
  restoreThumbnails,
  clearArchivedThumbnails,
  validThumbnail,
} from "./thumbnail-archive";
beforeEach(() => images.clear());
afterEach(() => vi.unstubAllGlobals());
it("serves a preserved image without contacting YouTube, even when the video is deleted", async () => {
  images.set("dQw4w9WgXcQ", "data:image/jpeg;base64,YWJj");
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  expect(await archiveThumbnail("dQw4w9WgXcQ")).toBe("data:image/jpeg;base64,YWJj");
  expect(network).not.toHaveBeenCalled();
});
it("does not download without the optional host permission", async () => {
  vi.stubGlobal("browser", { permissions: { contains: async () => false } });
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  expect(await archiveThumbnail("dQw4w9WgXcQ")).toBeUndefined();
  expect(network).not.toHaveBeenCalled();
});
it("archives image bytes, preserves them on restore, and supports explicit deletion", async () => {
  vi.stubGlobal("browser", { permissions: { contains: async () => true } });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      blob: async () => new Blob(["abc"], { type: "image/jpeg" }),
    })
  );
  const saved = await archiveThumbnail("dQw4w9WgXcQ");
  expect(saved).toMatch(/^data:image\/jpeg;base64,/);
  await restoreThumbnails({ dQw4w9WgXcQ: "data:image/jpeg;base64,ZGVm" });
  expect(await readArchivedThumbnail("dQw4w9WgXcQ")).toBe(saved);
  await clearArchivedThumbnails();
  expect(await readArchivedThumbnail("dQw4w9WgXcQ")).toBeUndefined();
});
it("rejects active content and oversized images in imported backups", async () => {
  expect(validThumbnail("data:image/svg+xml;base64,YWJj")).toBe(false);
  expect(validThumbnail("https://untrusted.invalid/image.png")).toBe(false);
  expect(validThumbnail("data:image/jpeg;base64," + "A".repeat(800000))).toBe(false);
  await expect(restoreThumbnails({ bad: "data:image/jpeg;base64,YWJj" })).rejects.toThrow();
});
