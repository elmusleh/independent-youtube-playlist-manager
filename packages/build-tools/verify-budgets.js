#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-budgets.js
 *
 * Enforces generous initial bundle-size ceilings for the built Chrome extension.
 * Ceilings are expressed in bytes so the check never relies on rounded KB output.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

const budgets = [
  { artifact: "dist/chrome/editor/main.js", maxBytes: 380 * 1024 },
  // 175 KiB → 180 KiB (UI polish pass): the confirmation-dialog theming, import
  // textarea, back-to-top FAB and theme-picker icons added ~2.4 KiB of legitimate
  // component CSS. Raised deliberately rather than trimming real UI styles.
  { artifact: "dist/chrome/editor/bundle.css", maxBytes: 180 * 1024 },
  { artifact: "dist/chrome/popup/popup.css", maxBytes: 22 * 1024 },
  { artifact: "dist/chrome/background/background.js", maxBytes: 16 * 1024 },
];

function formatSize(bytes) {
  return `${bytes} bytes (${(bytes / 1024).toFixed(1)} KiB)`;
}

let failed = false;

for (const { artifact, maxBytes } of budgets) {
  const absolutePath = path.join(root, artifact);
  if (!fs.existsSync(absolutePath)) {
    console.error(`\x1b[31m[BUDGET] Missing artifact:\x1b[0m ${artifact}`);
    console.error(`  Run the build first; expected artifact not found at ${artifact}.`);
    failed = true;
    continue;
  }

  const { size } = fs.statSync(absolutePath);
  const status = size <= maxBytes ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  const headroom = maxBytes - size;
  const headroomLabel =
    headroom >= 0 ? `${formatSize(headroom)} under` : `${formatSize(-headroom)} over`;

  console.log(
    `[${status}] ${artifact}: ${formatSize(size)} / ${formatSize(maxBytes)} (${headroomLabel})`
  );

  if (size > maxBytes) {
    console.error(
      `\x1b[31m[BUDGET] ${artifact} exceeds its ceiling by ${formatSize(size - maxBytes)}.\x1b[0m`
    );
    failed = true;
  }
}

if (failed) {
  console.error(
    "\n\x1b[31mBundle budget verification failed. Reduce the artifact or raise the ceiling deliberately.\x1b[0m\n"
  );
  process.exit(1);
}

console.log("\n\x1b[32m✔ All bundle budgets passed.\x1b[0m");
