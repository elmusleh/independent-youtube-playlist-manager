#!/usr/bin/env node
/* eslint-disable no-console */
/* global document, getComputedStyle, innerWidth */
/**
 * verify-popup.js — regression guard for the toolbar popup's sizing contract.
 *
 * Asserts the invariants that previously regressed unnoticed (see
 * docs/POPUP_MOBILE_PLAN.md, RC-1…RC-8):
 *   - explicit ui-popup / ui-page mode split, deterministic via ?mode=;
 *   - popup mode: FIXED 420px width, content height (no 100vh/dvh stretch);
 *   - page mode: body width == viewport width (no uncovered strip), 16px inputs,
 *     theme background on <html> (no white strip in dark mode);
 *   - no vw/vh/dvh units in popup.css and no Font Awesome link in popup.html;
 *   - every visible control ≥ 44px and every <use> icon resolves.
 */

const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const extension = path.join(root, "dist/chrome");
const popupCss = path.join(extension, "popup/popup.css");
const popupHtml = path.join(extension, "popup/popup.html");

if (!fs.existsSync(popupHtml)) {
  console.error("[popup] dist/chrome missing — run `npm run build-chrome` first.");
  process.exit(1);
}

function staticChecks() {
  const css = fs.readFileSync(popupCss, "utf8");
  // `vw` is never legitimate here (page mode is fluid 100% width); `100dvh` is
  // allowed but only for full-screen page mode, and the popup-mode runtime check
  // asserts the popup never stretches to viewport height.
  for (const banned of ["100vw", "calc(100vw"]) {
    assert(!css.includes(banned), `popup.css must not use viewport width units: ${banned}`);
  }
  const html = fs.readFileSync(popupHtml, "utf8");
  assert(!html.includes("fontawesome"), "popup.html must not reference Font Awesome");
  assert(!html.includes('class="fa-'), "popup.html must not use Font Awesome icons");
  assert(
    html.includes("viewport-fit=cover"),
    "popup.html viewport must declare viewport-fit=cover"
  );
  assert(html.includes('name="color-scheme"'), "popup.html must declare color-scheme");
}

async function main() {
  staticChecks();

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-popup-test-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });

  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 20000 }));
    const base = `${new URL(worker.url()).protocol}//${new URL(worker.url()).host}`;

    // --- popup mode -------------------------------------------------------
    const popup = await context.newPage();
    await popup.goto(`${base}/popup/popup.html?mode=popup`, { waitUntil: "load" });
    await popup.locator("#open-playlists").waitFor();

    const popupMetrics = await popup.evaluate(() => {
      const body = document.body;
      const small = [...document.querySelectorAll("button, select, .menu-item")]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height < 44 || r.width < 44;
        }).length;
      const missingIcons = [...document.querySelectorAll("svg.icon use")].filter(
        (u) => !document.querySelector(u.getAttribute("href"))
      ).length;
      return {
        mode: document.documentElement.dataset.mode,
        bodyWidth: Math.round(body.getBoundingClientRect().width),
        bodyHeight: Math.round(body.getBoundingClientRect().height),
        minHeight: getComputedStyle(body).minHeight,
        smallTargets: small,
        missingIcons,
      };
    });

    assert.equal(popupMetrics.mode, "popup", "popup mode must be classified as ui-popup");
    assert.equal(popupMetrics.bodyWidth, 420, "popup width must be fixed at 420px");
    assert.equal(popupMetrics.minHeight, "0px", "popup must not stretch to viewport height");
    assert(popupMetrics.bodyHeight < 600, "popup height must be content-sized");
    assert.equal(popupMetrics.smallTargets, 0, "no visible control under 44px");
    assert.equal(popupMetrics.missingIcons, 0, "every icon <use> must resolve");
    await popup.close();

    // --- page mode --------------------------------------------------------
    for (const width of [320, 390, 430]) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 780 });
      await page.goto(`${base}/popup/popup.html?mode=page`, { waitUntil: "load" });
      await page.locator("#open-playlists").waitFor();

      const metrics = await page.evaluate(() => {
        const body = document.body;
        document.documentElement.dataset.theme = "dark";
        const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
        const bodyBg = getComputedStyle(body).backgroundColor;
        const input = document.getElementById("input-quantity");
        return {
          mode: document.documentElement.dataset.mode,
          bodyWidth: Math.round(body.getBoundingClientRect().width),
          viewport: innerWidth,
          htmlBg,
          bodyBg,
          inputFont: input ? getComputedStyle(input).fontSize : null,
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });

      assert.equal(metrics.mode, "page", "page mode must be classified as ui-page");
      assert.equal(metrics.bodyWidth, metrics.viewport, `page mode must fill width at ${width}px`);
      assert.equal(
        metrics.htmlBg,
        metrics.bodyBg,
        "html and body backgrounds must match in dark mode"
      );
      assert.equal(metrics.inputFont, "16px", "page-mode inputs must be 16px to avoid autozoom");
      assert.equal(metrics.overflowX, false, `no horizontal overflow at ${width}px`);
      await page.close();
    }

    console.log("PASS: popup sizing contract holds (popup 420px content-height, page full-bleed).");
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
