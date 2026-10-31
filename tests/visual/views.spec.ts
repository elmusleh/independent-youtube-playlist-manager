/* eslint-disable no-undef */
/**
 * Visual regression baselines for the extension SPA's primary views.
 *
 * Guards the layouts that the structural E2E (verify-extension.js) only checks for
 * horizontal overflow: card ordering, column balance, spacing and alignment. Four views
 * (Settings, Saved, Manage, History) x two widths (mobile / desktop) x two themes
 * (light / dark) keep it bounded while still catching a re-introduced layout regression.
 *
 * Determinism pins:
 *  - system font normalised to DejaVu Sans (present on Ubuntu desktops and the CI runner);
 *  - theme pinned via `colorScheme` (fresh profile -> `data-theme` follows it);
 *  - locale + timezone pinned so date labels ("11/14/2023", "November 2023") are stable;
 *  - fixture timestamps fixed to a constant epoch (date grouping/labels must not drift);
 *  - animations off (`reducedMotion: "reduce"`); external images stubbed.
 *
 * Baselines are Linux-specific (DejaVu Sans). Regenerate ONLY after an intentional visual
 * change and only after naming what moved the pixels: `npm run test:visual -- --update-snapshots`.
 * See tests/visual/README.md.
 */
const path = require("path");
const os = require("os");
const fs = require("fs");
const { test, expect, chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "../..");
const EXTENSION = path.join(ROOT, "dist", "chrome");

// Shared with packages/build-tools/verify-extension.js — never reads a real profile.
const { createFixture, seedExtension } = require(
  path.join(ROOT, "packages/build-tools/extension-fixture.js")
);

// The view/width/theme matrix is the single source of truth, shared with
// packages/build-tools/verify-visual-baselines.js so the guard can never drift from the spec.
const { ROUTES, THEMES, SIZES } = require("./views-matrix.js");

// A fixed epoch so date grouping/labels are stable no matter when the suite runs.
// 2023-11-14T22:13:20Z is comfortably older than any plausible "now".
const FIXED_NOW = 1700000000000;

function createDeterministicFixture() {
  const fixture = createFixture();
  fixture.local.yph_local_playlists.forEach((p) => (p.timestamp = FIXED_NOW));
  Object.values(fixture.local.local_yt_history).forEach((h) => (h.lastWatchedAt = FIXED_NOW));
  return fixture;
}

async function launchExtensionContext(colorScheme) {
  if (!fs.existsSync(path.join(EXTENSION, "manifest.json"))) {
    throw new Error(
      `Built Chrome extension not found at ${EXTENSION} — run \`npm run build\` first.`
    );
  }
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-visual-"));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    headless: true,
    colorScheme,
    locale: "en-US",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
  return { context, profileDir };
}

async function openView(context, width, height, hash, ready) {
  // Deterministic render: stub external images exactly like verify-extension.js.
  await context.route("https://**/*", (route) => {
    if (route.request().resourceType() === "image") {
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#555"/></svg>',
      });
    }
    return route.abort();
  });

  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker", { timeout: 20000 }));
  const workerUrl = new URL(worker.url());
  const base = `${workerUrl.protocol}//${workerUrl.host}`;

  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width, height });

  // Seed on a neutral route first (one that is never a snapshot target), then open the
  // target view so it always mounts *after* the data is present. Seeding on the target
  // route itself would be a no-op for the router (same hash) and leave the view empty.
  await page.goto(`${base}/editor/index.html#/shortcuts`);
  await page.locator("#app").waitFor();
  await page.evaluate(seedExtension, createDeterministicFixture());

  await page.goto(`${base}/editor/index.html#${hash}`);
  await page.locator(ready).first().waitFor();

  // Pin the text font before capturing. The app's stack (`-apple-system, "Segoe UI", Roboto,
  // Ubuntu, Cantarell, ...`) resolves differently on a desktop vs the CI runner (Ubuntu/Cantarell
  // present or not). DejaVu Sans is the default sans-serif on Ubuntu and is present both locally
  // and on the GitHub runner, so pinning it removes the one input that makes baselines
  // non-portable across Linux hosts. Font Awesome icons are inline SVG (svelte-fa), untouched.
  await page.addStyleTag({
    content: 'body, body * { font-family: "DejaVu Sans", sans-serif !important; }',
  });

  // Let async card content (account playlists, metadata) settle, then confirm the theme.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  return { page, base, errors };
}

for (const route of ROUTES) {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      test(`${route.id} renders consistently (${theme} theme, ${size.id})`, async () => {
        const { context, profileDir } = await launchExtensionContext(theme);
        try {
          const { page, errors } = await openView(
            context,
            size.width,
            size.height,
            route.hash,
            route.ready
          );

          // The theme must actually be applied before we capture it.
          await expect
            .poll(() => page.evaluate(() => document.documentElement.dataset.theme), {
              message: "data-theme should settle to the emulated color scheme",
            })
            .toBe(theme);

          await expect(page.locator(route.shot)).toHaveScreenshot(
            `${route.id}-${theme}-${size.id}.png`
          );
          expect(errors, "Runtime page errors were observed").toEqual([]);
        } finally {
          await context.close();
          fs.rmSync(profileDir, { recursive: true, force: true });
        }
      });
    }
  }
}
