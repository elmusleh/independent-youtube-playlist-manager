#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-vercel-config.js
 *
 * Guards the one Vercel mistake that takes production down without running a single
 * build step.
 *
 * `rootDirectory` is a Vercel *project setting*, not a `vercel.json` property. The
 * project-config schema declares `additionalProperties: false`, so including it makes
 * every deployment fail at config parse time:
 *
 *   The `vercel.json` schema validation failed with the following message:
 *   should NOT have additional property `rootDirectory`
 *
 * The portal lives in `apps/web-portal`, and that directory is configured in the Vercel
 * project settings (Settings → Build & Development Settings → Root Directory), not here.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const FORBIDDEN_KEYS = ["rootDirectory"];
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "test-results",
  "playwright-report",
]);

function findConfigs(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      findConfigs(path.join(dir, entry.name), found);
    } else if (entry.name === "vercel.json") {
      found.push(path.join(dir, entry.name));
    }
  }
  return found;
}

function main() {
  const configs = findConfigs(root);
  const problems = [];

  for (const config of configs) {
    const relative = path.relative(root, config);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(config, "utf8"));
    } catch (error) {
      problems.push(`${relative}: invalid JSON (${error.message})`);
      continue;
    }

    for (const key of FORBIDDEN_KEYS) {
      if (key in parsed) {
        problems.push(
          `${relative}: "${key}" is a Vercel project setting, not a vercel.json property ` +
            `(the schema rejects unknown keys). Remove it and set Project → Settings → ` +
            `Build & Development Settings → Root Directory = apps/web-portal instead.`
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error("✖ Vercel config verification failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✔ Vercel config verification passed (${configs.length} config(s) checked).`);
}

main();
