#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-visual-baselines.js
 *
 * Cross-checks the committed visual baselines against the view/theme/size matrix in
 * tests/visual/views-matrix.js. Both directions:
 *
 *  1. every matrix combination must have a baseline on disk (a forgotten
 *     `--update-snapshots` only fails later, in the heavy test-web job), and
 *  2. every baseline on disk must map back to a matrix combination (a deleted route
 *     otherwise leaves an orphaned PNG that silently stops testing anything).
 *
 * Runs in `npm run check` — no extension build required, it only reads committed files.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const snapshotDir = path.join(root, "tests/visual/views.spec.ts-snapshots");
const { ROUTES, THEMES, SIZES } = require(path.join(root, "tests/visual/views-matrix.js"));

function main() {
  const files = fs.existsSync(snapshotDir)
    ? fs.readdirSync(snapshotDir).filter((name) => name.endsWith(".png"))
    : [];

  // Playwright names a snapshot `${route.id}-${theme}-${size.id}-${project}-${platform}.png`,
  // so the stable prefix we control is `${route.id}-${theme}-${size.id}`.
  const prefixes = [];
  for (const route of ROUTES) {
    for (const theme of THEMES) {
      for (const size of SIZES) {
        prefixes.push(`${route.id}-${theme}-${size.id}`);
      }
    }
  }

  const problems = [];

  for (const prefix of prefixes) {
    if (!files.some((file) => file.startsWith(`${prefix}-`))) {
      problems.push(
        `Missing baseline for "${prefix}" (expected ${prefix}-<project>-<platform>.png under tests/visual/views.spec.ts-snapshots/). ` +
          "Run `npm run test:visual -- --update-snapshots`."
      );
    }
  }

  for (const file of files) {
    if (!prefixes.some((prefix) => file.startsWith(`${prefix}-`))) {
      problems.push(
        `Orphaned baseline "${file}" — no route/theme/size in tests/visual/views-matrix.js produces it. ` +
          "Delete it or update the matrix."
      );
    }
  }

  if (problems.length > 0) {
    console.error("✖ Visual baseline verification failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✔ Visual baselines verified (${files.length} files, ${prefixes.length} expected).`);
}

main();
