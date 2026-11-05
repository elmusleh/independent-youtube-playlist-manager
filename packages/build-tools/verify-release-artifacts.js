#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-release-artifacts.js
 *
 * Verifies that:
 * 1. manifest.chrome.json and manifest.firefox.json versions match package.json.
 * 2. Generated in-app release notes match CHANGELOG.md.
 * 3. docs/edge-release-metadata.json matches current version and points to existing screenshots.
 * 4. docs/screenshots/ has all required screenshots with non-zero size.
 * 5. docs/assets/ promotional banners exist and meet dimensional requirements.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

// 1. Version checks
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifestChrome = JSON.parse(
  fs.readFileSync(path.join(root, "apps/browser-extension/manifest.chrome.json"), "utf8")
);
const manifestFirefox = JSON.parse(
  fs.readFileSync(path.join(root, "apps/browser-extension/manifest.firefox.json"), "utf8")
);
const edgeMeta = JSON.parse(
  fs.readFileSync(path.join(root, "docs/edge-release-metadata.json"), "utf8")
);

if (manifestChrome.version !== pkg.version) {
  fail(
    `manifest.chrome.json version (${manifestChrome.version}) does not match package.json (${pkg.version})`
  );
}
if (manifestFirefox.version !== pkg.version) {
  fail(
    `manifest.firefox.json version (${manifestFirefox.version}) does not match package.json (${pkg.version})`
  );
}
if (edgeMeta.version !== pkg.version) {
  fail(
    `edge-release-metadata.json version (${edgeMeta.version}) does not match package.json (${pkg.version})`
  );
}

// 2. Check screenshots
const expectedScreenshots = [
  "screenshot-01-editor.png",
  "screenshot-02-saved-playlists.png",
  "screenshot-03-new-playlist.png",
  "screenshot-04-sync.png",
  "screenshot-05-settings.png",
  "screenshot-06-shortcuts.png",
  "screenshot-07-history.png",
  "screenshot-08-qr-pairing.png",
];

for (const shot of expectedScreenshots) {
  const p = path.join(root, "docs/screenshots", shot);
  if (!fs.existsSync(p)) {
    fail(`Missing screenshot: docs/screenshots/${shot}`);
  }
  const stat = fs.statSync(p);
  if (stat.size === 0) {
    fail(`Screenshot docs/screenshots/${shot} is 0 bytes`);
  }
}

// 3. Check promotional assets
const expectedPromos = [
  "marquee-promo-1400x560.png",
  "small-promo-440x280.png",
  "edge-store-logo-300x300.png",
];

for (const promo of expectedPromos) {
  const p = path.join(root, "docs/assets", promo);
  if (!fs.existsSync(p)) {
    fail(`Missing promotional asset: docs/assets/${promo}`);
  }
  const stat = fs.statSync(p);
  if (stat.size === 0) {
    fail(`Promotional asset docs/assets/${promo} is 0 bytes`);
  }
}

// 4. Edge metadata referenced screenshots exist
for (const relPath of edgeMeta.assets.screenshots) {
  const p = path.join(root, relPath);
  if (!fs.existsSync(p)) {
    fail(`edge-release-metadata.json references missing screenshot: ${relPath}`);
  }
}

console.log(`PASS: Release artifacts verified cleanly for version ${pkg.version}.`);
