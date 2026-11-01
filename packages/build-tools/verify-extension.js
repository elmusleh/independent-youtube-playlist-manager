/* eslint-disable no-console */
/* global document, innerWidth, window */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createFixture, seedExtension, routes, sizes } = require("./extension-fixture.js");

const root = path.resolve(__dirname, "../..");
const output = path.join(root, "dist/verification");
const extension = path.join(root, "dist/chrome");

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-chrome-test-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const errors = [];
  const report = { browser: "Chromium", routeChecks: [], interactions: [] };
  try {
    // External providers are excluded from deterministic UI regression tests.
    await context.route("https://**/*", (route) => {
      if (route.request().resourceType() === "image")
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#555"/></svg>',
        });
      return route.abort();
    });
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 20000 }));
    const workerUrl = new URL(worker.url());
    const base = `${workerUrl.protocol}//${workerUrl.host}`;
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());
    const visit = async (route) => {
      await page.goto(`${base}/editor/index.html#${route}`);
      await page.locator("#app").waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".skeleton-grid, .skeleton-shimmer")
      );
      if (["/playlist?id=local-release", "/favorite", "/playlist-builder"].includes(route)) {
        try {
          await page.locator(".playlist-video").first().waitFor();
        } catch (error) {
          throw new Error(`${route}: ${await page.locator("body").innerText()}`, { cause: error });
        }
      }
    };
    await visit("/saved");
    await page.evaluate(() => window.getPlaylists());
    await page.evaluate(seedExtension, createFixture());
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const route of routes) {
        await visit(route);
        const bounds = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: innerWidth,
        }));
        assert(bounds.content <= bounds.viewport + 1, `${route} overflows at ${width}px`);
        assert(await page.locator("main").count(), `${route} has no main content`);
        report.routeChecks.push({ route, width, height, passed: true });
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: path.join(output, `chrome-${width}-${route.split("?")[0].slice(1)}.png`),
            fullPage: true,
          });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await visit("/playlist?id=local-release");
    assert.equal(await page.locator(".playlist-video").count(), 10);
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('[aria-current="page"]')?.textContent === "2"
    );
    // Mobile header exposes a search trigger; desktop has the input directly.
    const searchBox = page.getByRole("textbox", { name: "Search", exact: true });
    if (!(await searchBox.isVisible())) {
      await page.getByRole("button", { name: "Search", exact: true }).first().click();
    }
    await searchBox.fill("vid00000000");
    await page.waitForFunction(() => document.querySelectorAll(".playlist-video").length === 1);
    assert.equal(await page.getByRole("navigation", { name: "Pagination" }).count(), 0);
    await searchBox.fill("");
    await page.waitForFunction(() => document.querySelectorAll(".playlist-video").length === 10);
    report.interactions.push("Pagination and filtered page clamping");

    const opener = page.getByRole("button", { name: "Add videos from URLs or IDs", exact: true });
    await opener.click();
    const dialog = page.locator("dialog[open]");
    await dialog.waitFor();
    const box = await dialog.boundingBox();
    assert(
      box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845,
      "Import dialog is clipped"
    );
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert(
        await page.evaluate(() => !!document.activeElement?.closest("dialog[open]")),
        "Focus escaped the modal"
      );
    }
    await page.screenshot({ path: path.join(output, "chrome-mobile-import-dialog.png") });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    assert(
      await opener.evaluate((element) => element === document.activeElement),
      "Dialog did not restore focus"
    );
    report.interactions.push("Native dialog bounds, Tab containment, Escape, focus restoration");

    // Backdrop click dismisses a dismissible dialog and restores focus.
    await opener.click();
    await dialog.waitFor();
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    assert(
      await opener.evaluate((element) => element === document.activeElement),
      "Backdrop click did not restore focus"
    );

    // A press that begins inside and ends on the backdrop must not dismiss.
    await opener.click();
    await dialog.waitFor();
    const dragBox = await dialog.boundingBox();
    await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(5, 5);
    await page.mouse.up();
    assert.equal(
      await page.locator("dialog[open]").count(),
      1,
      "Inside-press drag dismissed the dialog"
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    report.interactions.push("Backdrop click dismisses; inside-press drag does not");

    await page.getByRole("button", { name: "Delete video", exact: true }).first().click();
    await page.getByRole("button", { name: "Cancel", exact: true }).waitFor();
    assert(
      await page
        .getByRole("button", { name: "Cancel", exact: true })
        .evaluate((element) => element === document.activeElement),
      "Destructive dialog did not focus Cancel"
    );
    // Backdrop click on a small confirmation dialog cancels (does not confirm).
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    assert.equal(
      await page.locator(".playlist-video").count(),
      10,
      "Backdrop click confirmed the deletion instead of cancelling"
    );
    await page.getByRole("button", { name: "Delete video", exact: true }).first().click();
    await page.getByRole("button", { name: "Cancel", exact: true }).waitFor();
    const pageCount = context.pages().length;
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    assert.equal(context.pages().length, pageCount, "Nested keyboard activation opened a video");
    await page.getByRole("button", { name: "Delete video", exact: true }).first().click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByRole("button", { name: /Undo/ }).first().click();
    await page.waitForFunction(() => document.querySelector(".count-badge")?.textContent === "205");
    report.interactions.push("Safe confirmation focus, deletion, Undo, nested keyboard activation");

    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation" }).waitFor();
    await page
      .getByRole("dialog", { name: "Navigation" })
      .getByRole("link", { name: "Watch History" })
      .click();
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    report.interactions.push("Mobile drawer route selection and dismissal");

    await visit("/settings");
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Export complete database and metadata cache as JSON",
        exact: true,
      })
      .click();
    const download = await downloaded;
    const backup = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.equal(backup.schemaVersion, 2);
    assert.equal(backup.data.playlists.length, 2);
    assert.equal(Object.keys(backup.data.videoMetadata).length, 205);
    report.interactions.push("Full backup export contains playlists and shared metadata");

    // The Manage view's bulk bar lives in a subBar snippet that must be passed into
    // StickyHeader; declaring it outside the component renders nothing.
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit("/manage");
    assert(
      await page.getByRole("checkbox", { name: "Select all playlists", exact: true }).count(),
      "Manage bulk selection bar is not rendered (subBar snippet missing from StickyHeader)"
    );
    report.interactions.push("Manage bulk selection bar renders");

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 600 });
      await page.goto(`${base}/popup/popup.html`);
      await page.locator("#open-playlists").waitFor();
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        "Popup overflows"
      );
    }
    report.interactions.push("Toolbar popup layout at 320, 390 and 768px");
    assert.deepEqual(errors, [], "Runtime errors were observed");
    fs.writeFileSync(path.join(output, "chromium-report.json"), JSON.stringify(report, null, 2));
    console.log(
      `PASS: ${report.routeChecks.length} real-extension route/viewport checks; ${report.interactions.length} interaction groups; no runtime errors.`
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
