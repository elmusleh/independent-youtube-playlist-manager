#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-portal-assets.js
 *
 * Keeps the web portal's shipped images small enough to be worth downloading.
 *
 * The portal used to ship a 1437x1082 / 2.0 MB PNG as both the favicon and a 28 px
 * logo. Nothing measured image weight, so `/_next/image?url=%2Ficon.png&w=128` happily
 * transferred 2,018,306 bytes: Next's optimizer passes the source through unchanged at
 * that size, and the "optimized" URL therefore loads slower than the plain file.
 *
 * This gate fails when a served image exceeds its budget. Regenerate with
 * `npm run assets:portal`; the budgets are deliberately generous (2-4x the committed
 * size) so quality tweaks do not trip them, while a re-added print-resolution original
 * does.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const portal = path.join(root, "apps/web-portal");

const KiB = 1024;

// Per-file budgets. A file not listed here falls back to DEFAULT_BUDGET.
const BUDGETS = {
  "public/logo.webp": 25 * KiB,
  "public/icon.png": 60 * KiB,
  "public/og-image.png": 140 * KiB,
  "src/app/icon.png": 30 * KiB,
};

const DEFAULT_BUDGET = 150 * KiB;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);

function formatSize(bytes) {
  return `${bytes} bytes (${(bytes / KiB).toFixed(1)} KiB)`;
}

function collectServedImages() {
  const found = [];
  const publicDir = path.join(portal, "public");

  if (!fs.existsSync(publicDir)) {
    console.error(`\x1b[31m[ASSETS] Missing directory:\x1b[0m ${path.relative(root, publicDir)}`);
    process.exit(1);
  }

  for (const entry of fs.readdirSync(publicDir, { withFileTypes: true })) {
    if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      found.push(`public/${entry.name}`);
    }
  }

  // Next's metadata routes: src/app/icon.png and friends are served as /icon.png.
  const appDir = path.join(portal, "src/app");
  if (fs.existsSync(appDir)) {
    for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
      const isMetadataImage = /^(icon|apple-icon|opengraph-image|twitter-image)/.test(entry.name);
      if (entry.isFile() && isMetadataImage && IMAGE_EXTENSIONS.has(path.extname(entry.name))) {
        found.push(`src/app/${entry.name}`);
      }
    }
  }

  return found.sort();
}

let failed = false;

const images = collectServedImages();

for (const relativePath of images) {
  const budget = BUDGETS[relativePath] ?? DEFAULT_BUDGET;
  const size = fs.statSync(path.join(portal, relativePath)).size;

  if (size > budget) {
    console.error(
      `\x1b[31m[ASSETS] ${relativePath} is ${formatSize(size)} — budget is ${formatSize(budget)}\x1b[0m`
    );
    console.error("  Serve a resized derivative, not a full-resolution original.");
    console.error("  Move the original to apps/web-portal/assets/ and run: npm run assets:portal");
    failed = true;
  } else {
    console.log(
      `\x1b[32m[ASSETS]\x1b[0m ${relativePath} — ${formatSize(size)} (≤ ${formatSize(budget)})`
    );
  }
}

const total = images.reduce(
  (sum, relativePath) => sum + fs.statSync(path.join(portal, relativePath)).size,
  0
);
console.log(`[ASSETS] ${images.length} served image(s), ${formatSize(total)} total`);

if (failed) {
  process.exit(1);
}
