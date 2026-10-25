import { afterEach, expect, it, vi } from "vitest";
import html from "../../../popup/popup.html?raw";
import { handleChannelImport } from "../../../popup/channel.js";
import { preparePageImport, getPageImportTab, importQuantity } from "../../../popup/page-import.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  document.body.innerHTML = "";
});
function setup() {
  document.body.innerHTML = html;
  window.logSystemEvent = vi.fn();
  window.videoService = { parseYoutubeId: vi.fn() };
  window.getSettings = vi
    .fn()
    .mockResolvedValue({ themeChoice: "light", defaultQuickAddTarget: "latest" });
  window.getPlaylists = vi.fn().mockResolvedValue([]);
  window.isSignedIn = vi.fn().mockResolvedValue(false);
  window.savePlaylist = vi.fn().mockResolvedValue("local-import");
  vi.spyOn(window, "close").mockImplementation(() => {});
  const tab = { id: 7, url: "https://example.org/article", title: "Article" };
  const api = {
    tabs: {
      query: vi.fn().mockResolvedValue([tab]),
      get: vi.fn().mockResolvedValue(tab),
      create: vi.fn(),
    },
    scripting: { executeScript: vi.fn().mockResolvedValue([{ result: null }]) },
    notifications: { create: vi.fn() },
    runtime: { getURL: (path) => "chrome-extension://test" + path },
  };
  vi.stubGlobal("browser", api);
  return api;
}
it("opens Import from Page on an ordinary webpage without channel metadata", async () => {
  const api = setup();
  await import("../../../popup/popup.js");
  await vi.waitFor(() =>
    expect(document.getElementById("import-channel").onclick).toBeTypeOf("function")
  );
  await document.getElementById("import-channel").onclick();
  expect(document.getElementById("channel-page").style.display).toBe("block");
  expect(api.notifications.create).not.toHaveBeenCalled();
});
it("honors zero as unlimited rather than silently limiting the import to 25", async () => {
  const api = setup();
  document.getElementById("input-quantity").value = "0";
  await preparePageImport();
  const ids = Array.from({ length: 40 }, (_, i) => `vid${String(i).padStart(8, "0")}`);
  api.scripting.executeScript.mockResolvedValue([
    { result: { links: ids.map((id) => ({ id })), count: 40, title: "Article" } },
  ]);
  const service = { generatePlaylist: vi.fn().mockResolvedValue({ id: "local-import" }) };
  await handleChannelImport(service);
  expect(service.generatePlaylist).toHaveBeenCalledWith(ids);
});
it("keeps the selected source when focus changes, but rejects navigation and closure", async () => {
  const api = setup();
  await preparePageImport();
  api.tabs.query.mockResolvedValue([{ id: 9, url: "https://other.example" }]);
  expect((await getPageImportTab()).id).toBe(7);
  api.tabs.get.mockResolvedValue({ id: 7, url: "https://example.org/changed" });
  await expect(getPageImportTab()).rejects.toThrow("page changed");
  api.tabs.get.mockRejectedValue(new Error("closed"));
  await expect(getPageImportTab()).rejects.toThrow("page was closed");
});
it("rejects protected browser pages before script injection", async () => {
  const api = setup();
  api.tabs.query.mockResolvedValue([{ id: 7, url: "chrome://settings" }]);
  await expect(preparePageImport()).rejects.toThrow("cannot be scanned");
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
});
it("reports permission failures and allows retry without creating a playlist", async () => {
  const api = setup();
  await preparePageImport();
  api.scripting.executeScript.mockRejectedValue(new Error("Cannot access contents of url"));
  const service = { generatePlaylist: vi.fn() };
  await handleChannelImport(service);
  expect(document.getElementById("page-import-error").textContent).toContain("toolbar button");
  expect(document.getElementById("confirm-import").disabled).toBe(false);
  expect(service.generatePlaylist).not.toHaveBeenCalled();
});
it("rejects invalid limits instead of substituting an unexpected default", () => {
  for (const input of ["", "-1", "1.5", "1001", "no"])
    expect(() => importQuantity(input)).toThrow();
  expect(importQuantity("0")).toBe(0);
  expect(importQuantity("1000")).toBe(1000);
});
it("reports an empty scan without saving an empty playlist", async () => {
  const api = setup();
  await preparePageImport();
  api.scripting.executeScript.mockResolvedValue([
    { result: { links: [], count: 0, title: "No videos" } },
  ]);
  const service = { generatePlaylist: vi.fn() };
  await handleChannelImport(service);
  expect(document.getElementById("page-import-error").textContent).toContain("No YouTube videos");
  expect(service.generatePlaylist).not.toHaveBeenCalled();
});
it("retains the channel extractor and supports reversing a limited import", async () => {
  const api = setup();
  const channel = { id: 7, url: "https://www.youtube.com/@example/videos", title: "Channel" };
  api.tabs.query.mockResolvedValue([channel]);
  api.tabs.get.mockResolvedValue(channel);
  await preparePageImport();
  document.getElementById("input-quantity").value = "2";
  document.getElementById("select-order").value = "oldest";
  api.scripting.executeScript
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { result: [{ id: "abcdefghijk" }, { id: "dQw4w9WgXcQ" }, { id: "zyxwvutsrqp" }] },
    ]);
  const service = { generatePlaylist: vi.fn().mockResolvedValue({ id: "local-import" }) };
  await handleChannelImport(service);
  expect(service.generatePlaylist).toHaveBeenCalledWith(["dQw4w9WgXcQ", "abcdefghijk"]);
  expect(api.scripting.executeScript.mock.calls[1][0].files).toEqual([
    "/content-scripts/injectors/get-channel-video-ids.js",
  ]);
});
