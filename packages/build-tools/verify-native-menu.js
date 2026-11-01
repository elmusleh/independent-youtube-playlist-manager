/* global chrome */
/**
 * Native context-menu verification gate.
 *
 * Native menus belong to the browser, not the page: Playwright and CDP can neither read
 * nor drive them. This gate therefore runs a headed Chrome on a private X display, opens
 * the real menu, and asserts twice:
 *
 *   1. registration - the ids the extension created equal `menuModel(settings)`;
 *   2. pixels       - the labels OCR'd from the actual menu contain/omit what the
 *                     settings require.
 *
 * Usage:
 *   npm run test:native-menu                # verify; screenshots -> dist/verification
 *   npm run test:native-menu -- --record    # also refresh docs/testing evidence
 *   IYPM_REQUIRE_NATIVE_MENU=1 ...          # no X11 is a failure, not a skip
 *   IYPM_NATIVE_DISPLAY=:99 ...             # reuse an existing display
 */
"use strict";

const { chromium } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { acquireDisplay, have, xdo, hoverRow } = require("./native-menu/display.js");
const { findRow, brandedRow, readPanel } = require("./native-menu/ocr.js");
const {
  FIXTURE,
  SCOPES,
  PARENT_PROBES,
  SUBMENU_PROBES,
  BASE_SETTINGS,
  VARIANTS,
} = require("./native-menu/variants.js");

const root = path.resolve(__dirname, "../..");
const extension = path.join(root, "dist/chrome");
const output = path.join(root, "dist/verification/native-menu");
const EXTENSION_ID = "dapjjdcnolpmfcnobilphjfpkmmokgid";

const failures = [];

function say(line) {
  process.stdout.write(`${line}\n`);
}

/** Newest .js/.ts/.svelte source mtime under `dir`, ignoring build output and deps. */
function newestSource(dir, since) {
  let newest = null;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", "editor", ".git"].includes(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!/\.(js|ts|svelte)$/.test(entry.name)) continue;
      const { mtimeMs } = fs.statSync(full);
      if (mtimeMs > since && (!newest || mtimeMs > newest.mtime)) {
        newest = { file: full, mtime: mtimeMs };
      }
    }
  };
  walk(dir);
  return newest ? newest.file : null;
}

/** Refuse to verify pixels from a build older than the source. */
function preflight() {
  if (!fs.existsSync(path.join(extension, "manifest.json"))) {
    say("FAIL: dist/chrome/manifest.json is missing - run `npm run build` first.");
    process.exit(1);
  }
  const built = fs.statSync(path.join(extension, "manifest.json")).mtimeMs;
  const newer = newestSource(path.join(root, "apps/browser-extension"), built);
  if (newer) {
    say(
      `FAIL: ${path.relative(root, newer)} is newer than dist/chrome - run \`npm run build\` first.`
    );
    process.exit(1);
  }
  return ["ffmpeg", "tesseract", "xdotool"].find((bin) => !have(bin));
}

function skip(reason) {
  if (process.env.IYPM_REQUIRE_NATIVE_MENU === "1") {
    say(`FAIL: ${reason} (IYPM_REQUIRE_NATIVE_MENU=1)`);
    process.exit(1);
  }
  say(`SKIP: native menu requires X11 - ${reason}`);
}

function expectText(name, text, variant) {
  const lower = text.toLowerCase();
  for (const wanted of variant.present) {
    if (!lower.includes(wanted.toLowerCase())) {
      failures.push(`${name}: menu is missing "${wanted}" | OCR: ${text.slice(0, 200)}`);
    }
  }
  for (const unwanted of variant.absent) {
    if (lower.includes(unwanted.toLowerCase())) {
      failures.push(`${name}: menu still shows "${unwanted}" | OCR: ${text.slice(0, 200)}`);
    }
  }
}

async function expectedIds(settings) {
  const model = await import(
    `file://${path.join(root, "apps/browser-extension/background/context-menu-model.js")}`
  );
  return model
    .menuModel(settings, [])
    .map((item) => item.id)
    .sort();
}

async function readIds(admin) {
  const stored = await admin.evaluate(() => chrome.storage.local.get("yph_context_menu_ids"));
  return (stored.yph_context_menu_ids || []).slice().sort();
}

/** Write settings, then wait for reconciliation to reach the expected id set. */
async function settle(admin, settings) {
  const expected = await expectedIds(settings);
  await admin.evaluate((s) => chrome.storage.sync.set(s), settings);
  let actual = [];
  for (let attempt = 0; attempt < 25; attempt += 1) {
    actual = await readIds(admin);
    if (JSON.stringify(actual) === JSON.stringify(expected)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return { expected, actual };
}

async function openMenu(page, selector) {
  // A right-click through CDP does open the native menu, and Playwright hit-tests the
  // element itself - unlike hand-computed screen coordinates, which land beside an inline
  // <a> and silently produce a page-context menu. Only hover needs OS-level input.
  await page.click(selector, { button: "right" });
  await new Promise((r) => setTimeout(r, 800));
}

/** Read the branded submenu and, for the default variant, the scope submenu under it. */
async function readSubmenus(display, variant, parent) {
  const row = brandedRow(parent.rows);
  if (!row) {
    failures.push(`${variant.name}: no "Playlist Manager" row | OCR: ${parent.text.slice(0, 160)}`);
    return parent.text;
  }
  await hoverRow(display, row);
  const sub = readPanel(display, path.join(output, `${variant.name}.png`), SUBMENU_PROBES);
  if (variant.name !== "default") return sub.text;

  const scopeRow = findRow(sub.rows, ["Add YouTube tabs to"]);
  if (!scopeRow) {
    failures.push(`default: no "Add YouTube tabs to" row | OCR: ${sub.text.slice(0, 160)}`);
    return sub.text;
  }
  await hoverRow(display, scopeRow);
  const scopes = readPanel(display, path.join(output, "default-scopes.png"), SCOPES);
  for (const label of SCOPES) {
    if (!scopes.text.toLowerCase().includes(label.toLowerCase())) {
      failures.push(`default: scope submenu is missing "${label}"`);
    }
  }
  return sub.text;
}

async function runVariant(display, page, admin, variant) {
  const before = failures.length;
  const settings = { ...BASE_SETTINGS, ...variant.settings };
  const { expected, actual } = await settle(admin, settings);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter((id) => !actual.includes(id));
    const extra = actual.filter((id) => !expected.includes(id));
    failures.push(
      `${variant.name}: registered ids differ - missing [${missing.join(", ")}] extra [${extra.join(", ")}]`
    );
  }

  // Menus (and submenus) are separate popup windows: close every level and click on
  // neutral page space, otherwise the next right-click just dismisses the old menu.
  for (let level = 0; level < 3; level += 1) xdo(display, "key", "Escape");
  await page.mouse.click(900, 700);
  await new Promise((r) => setTimeout(r, 250));
  await openMenu(page, variant.target);

  const probes = variant.parentProbes || PARENT_PROBES;
  const parent = readPanel(display, path.join(output, `${variant.name}-parent.png`), probes);
  const menuText = variant.topLevelOnly
    ? parent.text
    : await readSubmenus(display, variant, parent);
  expectText(variant.name, menuText, variant);

  for (let level = 0; level < 2; level += 1) xdo(display, "key", "Escape");
  await new Promise((r) => setTimeout(r, 250));
  return { name: variant.name, ids: actual.length, ok: failures.length === before };
}

function recordEvidence() {
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = path.join(root, "docs/testing", `native-menu-chromium-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of [
    "default",
    "saved-off",
    "builder-off",
    "menu-off",
    "link-context",
    "default-scopes",
  ]) {
    const source = path.join(output, `${name}.png`);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(dir, `${name}.png`));
  }
  say(`recorded evidence -> ${path.relative(root, dir)}`);
}

async function main() {
  const record = process.argv.includes("--record");
  const missingBin = preflight();
  if (missingBin) {
    skip(`${missingBin} is required`);
    return;
  }
  const displayHandle = await acquireDisplay();
  if (!displayHandle) {
    skip("no X display available (install Xvfb or set IYPM_NATIVE_DISPLAY)");
    return;
  }
  const { display, stop } = displayHandle;
  fs.mkdirSync(output, { recursive: true });

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(FIXTURE);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const pageUrl = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-native-"));
  let context;
  const verified = [];

  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: false,
      viewport: null,
      env: { ...process.env, DISPLAY: display },
      args: [
        "--no-sandbox",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-position=0,0",
        "--window-size=1200,900",
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 20000 }));
    const url = new URL(worker.url());
    const origin = `${url.protocol}//${url.host}`;
    if (!origin.includes(EXTENSION_ID)) {
      failures.push(`extension id mismatch: ${origin} (expected ${EXTENSION_ID})`);
    }

    const admin = await context.newPage();
    await admin.goto(`${origin}/editor/index.html`);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(pageUrl);
    await page.locator("#p").waitFor();

    for (const variant of VARIANTS) {
      const result = await runVariant(display, page, admin, variant);
      verified.push(result);
      say(`${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.ids} registered ids`);
    }
    if (record) recordEvidence();
  } finally {
    if (context) await context.close().catch(() => {});
    server.close();
    stop();
  }

  if (failures.length) {
    say("");
    for (const failure of failures) say(`FAIL ${failure}`);
    say(`\n${failures.length} native-menu check(s) failed.`);
    process.exit(1);
  }
  say(`\nPASS: ${verified.length} native-menu variants verified (registration + visible rows).`);
}

main().catch((error) => {
  say(`FAIL: ${error.message}`);
  process.exit(1);
});
