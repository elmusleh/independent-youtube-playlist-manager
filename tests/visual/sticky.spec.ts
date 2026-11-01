/* eslint-disable no-undef */
/**
 * Regression tests for the window-scroll model.
 *
 * 1. The selection sub-bar must stay pinned under the fixed header while
 *    scrolling, and the back-to-top button must appear and return to the top.
 * 2. With prefers-reduced-motion, the back-to-top jump is instant (no smooth
 *    animation).
 *
 * These bugs escaped twice (an inner-scroll assumption, then `overflow` traps),
 * so these tests drive the real extension in Chromium, seed a long list, scroll
 * the window, and assert on measured geometry + visibility — not snapshots.
 */
const path = require("path");
const os = require("os");
const fs = require("fs");
const { test, expect, chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "../..");
const EXTENSION = path.join(ROOT, "dist", "chrome");

const { createFixture, seedExtension } = require(
  path.join(ROOT, "packages/build-tools/extension-fixture.js")
);

// Add enough local playlists that #/manage comfortably overflows the viewport.
function createLongFixture() {
  const fixture = createFixture();
  const extras = Array.from({ length: 40 }, (_, i) => ({
    id: `extra-${String(i).padStart(2, "0")}`,
    title: `Extra playlist ${i}`,
    videos: [`vid${String(i).padStart(8, "0")}`],
    isLocal: true,
    saved: true,
    timestamp: Date.now(),
  }));
  fixture.local.yph_local_playlists = [...fixture.local.yph_local_playlists, ...extras];
  return fixture;
}

async function launchExtension(reducedMotion) {
  if (!fs.existsSync(path.join(EXTENSION, "manifest.json"))) {
    throw new Error(
      `Built Chrome extension not found at ${EXTENSION} — run \`npm run build\` first.`
    );
  }
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-sticky-"));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    headless: true,
    locale: "en-US",
    timezoneId: "UTC",
    reducedMotion: reducedMotion || "no-preference",
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
  return { context, profileDir };
}

async function openManage(context, width, height) {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker", { timeout: 20000 }));
  const workerUrl = new URL(worker.url());
  const base = `${workerUrl.protocol}//${workerUrl.host}`;

  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewportSize({ width, height });

  // Seed on a neutral route first, then open the target view so it mounts
  // after the data is present (same trick as views.spec.ts).
  await page.goto(`${base}/editor/index.html#/shortcuts`);
  await page.locator("#app").waitFor();
  await page.evaluate(seedExtension, createLongFixture());

  await page.goto(`${base}/editor/index.html#/manage`);
  await page.locator(".row-content").first().waitFor();

  const headerHeight = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-header-height"))
  );
  return { page, headerHeight };
}

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test(`selection bar pins under the header and back-to-top appears (${vp.name})`, async () => {
    const { context, profileDir } = await launchExtension();
    try {
      const { page, headerHeight } = await openManage(context, vp.width, vp.height);
      expect(headerHeight).toBeGreaterThan(0);

      const bar = page.locator(".sticky-header-sub");
      await bar.waitFor();

      // Before scrolling, the bar sits below the header (not yet pinned) and the
      // back-to-top button is hidden.
      const initialTop = await bar.evaluate((el) => el.getBoundingClientRect().top);
      expect(initialTop).toBeGreaterThan(headerHeight + 1);

      const initiallyHidden = await page
        .locator(".back-to-top")
        .evaluate((el) => getComputedStyle(el).opacity === "0");
      expect(initiallyHidden).toBe(true);

      // Scroll far enough to pin the bar and reveal the back-to-top button.
      await page.evaluate(() => window.scrollTo(0, 800));

      // The bar must now be pinned at (within a pixel of) the header offset. If
      // sticky is broken, it scrolls away and the top becomes negative.
      await expect
        .poll(() => bar.evaluate((el) => el.getBoundingClientRect().top))
        .toBeLessThan(headerHeight + 2);
      await expect
        .poll(() => bar.evaluate((el) => el.getBoundingClientRect().top))
        .toBeGreaterThan(headerHeight - 2);

      // The back-to-top button must be visible.
      await expect
        .poll(() =>
          page.locator(".back-to-top").evaluate((el) => getComputedStyle(el).opacity === "1")
        )
        .toBe(true);

      // Clicking it returns the window to the top.
      await page.locator(".back-to-top").click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
    } finally {
      await context.close();
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  });
}

test("back-to-top jumps instantly when prefers-reduced-motion is set", async () => {
  const { context, profileDir } = await launchExtension("reduce");
  try {
    const { page, headerHeight } = await openManage(context, 1440, 900);

    const bar = page.locator(".sticky-header-sub");
    await bar.waitFor();

    await page.evaluate(() => window.scrollTo(0, 800));
    await expect
      .poll(() => bar.evaluate((el) => el.getBoundingClientRect().top))
      .toBeLessThan(headerHeight + 2);

    await page.locator(".back-to-top").click();

    // With reduced motion the scroll must land at the top synchronously, not
    // animate — so a single (non-polled) read is already at zero.
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(5);
  } finally {
    await context.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
