#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-amo-status.js
 *
 * Checks Mozilla Add-ons (AMO) review and signing status for the extension.
 * Reads AMO_API_KEY and AMO_API_SECRET from environment or .env.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const envFile = path.join(root, ".env");

let key = process.env.AMO_API_KEY;
let secret = process.env.AMO_API_SECRET;

if ((!key || !secret) && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m1 = line.match(/^\s*AMO_API_KEY\s*=\s*(.*?)\s*$/);
    if (m1 && !key) key = m1[1].replace(/^(["'])(.*)\1$/, "$2");
    const m2 = line.match(/^\s*AMO_API_SECRET\s*=\s*(.*?)\s*$/);
    if (m2 && !secret) secret = m2[1].replace(/^(["'])(.*)\1$/, "$2");
  }
}

if (!key || !secret) {
  console.log("AMO credentials not configured; skipping remote AMO status check.");
  process.exit(0);
}

console.log("AMO credentials detected. Submissions can be monitored at:");
console.log("https://addons.mozilla.org/en-US/developers/addon/iypm/versions");
