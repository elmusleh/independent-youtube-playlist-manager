/* eslint-disable no-console */
/* global window, browser, document, indexedDB, getComputedStyle */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createFixture, seedExtension } = require("./extension-fixture");

async function main() {
  const extension = path.resolve("dist/chrome");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-issues-"));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: "chromium",
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    await context.route("https://**/*", (route) => route.abort());
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
    const url = worker.url().split("/background/")[0] + "/editor/index.html";
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(url + "#/saved");
    await page.waitForFunction(() => typeof window.getPlaylists === "function");
    await page.evaluate(() => window.getPlaylists());
    await page.evaluate(seedExtension, createFixture());
    await page.evaluate(() => localStorage.setItem("yph-theme-choice", "dark"));
    const boot = await context.newPage();
    await boot.route("**/editor/main.js", (route) =>
      route.fulfill({ body: "", contentType: "application/javascript" })
    );
    await boot.goto(url);
    assert.equal(await boot.evaluate(() => document.documentElement.dataset.theme), "dark");
    assert.equal(
      await boot.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
      "rgb(15, 15, 15)"
    );
    await boot.screenshot({ path: "dist/verification/issue-13-dark-before-app.png" });
    await boot.close();

    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=";
    await page.evaluate(async (data) => {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open("yph_thumbnail_archive_v1", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("images");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("images", "readwrite");
          tx.objectStore("images").put(data, "vid00000000");
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => reject(tx.error);
        };
      });
      await browser.storage.sync.set({ autoFetchMetadata: true });
      await window.videoService.cacheMetadata({
        dQw4w9WgXcQ: { title: "Imported title", channel: "Channel" },
      });
    }, png);
    await page.goto(url + "#/playlist?id=local-release");
    await page.locator(".playlist-video").first().waitFor();
    await page.waitForFunction(() =>
      document.querySelector(".playlist-video img")?.getAttribute("src")?.startsWith("data:image/")
    );
    await page.waitForFunction(
      () => document.querySelector(".playlist-video img")?.naturalWidth > 0
    );
    await page.evaluate(() => {
      window.ytFetchVideoDurations = async (ids) =>
        new Map(
          ids.map((videoId) => [
            videoId,
            {
              videoId,
              title: "Imported title",
              channel: "Channel",
              durationISO: "PT2M3S",
              durationSeconds: 123,
            },
          ])
        );
    });
    await page.getByRole("button", { name: "Add videos from URLs or IDs", exact: true }).click();
    await page.locator("dialog[open] textarea").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "Import Video(s)", exact: true })
      .click();
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    // The imported item is at the end of 206 videos: page 21 at size 10.
    await page.getByRole("button", { name: "Page 21", exact: true }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".duration-badge")].some((node) => node.textContent === "2:03")
    );
    await page.screenshot({ path: "dist/verification/issue-14-import-duration.png" });
    await page.goto(url + "#/settings");
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Export complete database and metadata cache as JSON",
        exact: true,
      })
      .click();
    const downloaded = await downloading;
    const backup = JSON.parse(fs.readFileSync(await downloaded.path(), "utf8"));
    assert.equal(backup.data.thumbnails.vid00000000, png);
    console.log(
      "PASS: dark theme before app initialization; archived thumbnail offline and exported; partial import duration badge; first/last pagination."
    );
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
