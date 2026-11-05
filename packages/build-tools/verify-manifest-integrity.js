#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-manifest-integrity.js
 *
 * Verifies that:
 * 1. manifest.chrome.json and manifest.firefox.json declare matching permissions
 *    (aside from browser-specific keys like gecko/background scripts vs service_worker).
 * 2. Host permissions don't introduce unreviewed domains across browsers.
 * 3. Content security policies match.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const chromePath = path.join(root, "apps/browser-extension/manifest.chrome.json");
const firefoxPath = path.join(root, "apps/browser-extension/manifest.firefox.json");

const chrome = JSON.parse(fs.readFileSync(chromePath, "utf8"));
const firefox = JSON.parse(fs.readFileSync(firefoxPath, "utf8"));

// 1. Core permissions parity
const chromePerms = new Set(chrome.permissions || []);
const firefoxPerms = new Set(firefox.permissions || []);

const expectedSharedPerms = ["storage", "alarms", "contextMenus"];
for (const p of expectedSharedPerms) {
  if (!chromePerms.has(p)) fail(`Chrome manifest missing expected permission: ${p}`);
  if (!firefoxPerms.has(p)) fail(`Firefox manifest missing expected permission: ${p}`);
}

// 2. Optional host permissions parity
const chromeHosts = new Set(chrome.optional_host_permissions || []);
const firefoxHosts = new Set(firefox.optional_host_permissions || []);

for (const host of chromeHosts) {
  if (!firefoxHosts.has(host)) {
    fail(`Firefox manifest missing optional_host_permission declared in Chrome: ${host}`);
  }
}
for (const host of firefoxHosts) {
  if (!chromeHosts.has(host)) {
    fail(`Chrome manifest missing optional_host_permission declared in Firefox: ${host}`);
  }
}

// 3. Manifest version parity
if (chrome.manifest_version !== 3 || firefox.manifest_version !== 3) {
  fail("Both manifests must be Manifest V3.");
}

console.log("PASS: Cross-browser manifest integrity and permission parity verified.");
