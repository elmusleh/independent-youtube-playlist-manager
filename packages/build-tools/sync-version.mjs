#!/usr/bin/env node
/**
 * sync-version.mjs
 * Reads the canonical version from apps/browser-extension/manifest.chrome.json and propagates
 * it to apps/browser-extension/manifest.firefox.json and package.json.
 *
 * Usage:
 *   node packages/build-tools/sync-version.mjs            # sync from chrome manifest
 *   node packages/build-tools/sync-version.mjs --set 2.12.25  # set new version everywhere
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

const chromeManifestPath = resolve(root, "apps/browser-extension/manifest.chrome.json");
const firefoxManifestPath = resolve(root, "apps/browser-extension/manifest.firefox.json");
const packageJsonPath = resolve(root, "package.json");
const playlistEditorPackageJsonPath = resolve(root, "apps/browser-extension/playlist-editor/package.json");
const webPortalPackageJsonPath = resolve(root, "apps/web-portal/package.json");

const args = process.argv.slice(2);
const setIndex = args.indexOf("--set");

const chromeManifest = readJson(chromeManifestPath);
let canonicalVersion = chromeManifest.version;

if (setIndex !== -1 && args[setIndex + 1]) {
  canonicalVersion = args[setIndex + 1];
  if (!/^\d+\.\d+\.\d+$/.test(canonicalVersion)) {
    console.error(`ERROR: Invalid version format: ${canonicalVersion}. Expected x.y.z`);
    process.exit(1);
  }
  console.log(`Setting new canonical version: ${canonicalVersion}`);
}

console.log(`\nSyncing version: ${canonicalVersion}\n`);

// Update Chrome manifest
chromeManifest.version = canonicalVersion;
writeJson(chromeManifestPath, chromeManifest);
console.log(`  apps/browser-extension/manifest.chrome.json -> ${canonicalVersion}`);

// Update Firefox manifest
const firefoxManifest = readJson(firefoxManifestPath);
const firefoxPrev = firefoxManifest.version;
firefoxManifest.version = canonicalVersion;
writeJson(firefoxManifestPath, firefoxManifest);
console.log(`  apps/browser-extension/manifest.firefox.json -> ${canonicalVersion} (was ${firefoxPrev})`);

// Update package.json (root)
const pkg = readJson(packageJsonPath);
const pkgPrev = pkg.version;
pkg.version = canonicalVersion;
writeJson(packageJsonPath, pkg);
console.log(`  package.json -> ${canonicalVersion} (was ${pkgPrev})`);

// Update playlist-editor package.json
const pePkg = readJson(playlistEditorPackageJsonPath);
const pePkgPrev = pePkg.version;
pePkg.version = canonicalVersion;
writeJson(playlistEditorPackageJsonPath, pePkg);
console.log(`  apps/browser-extension/playlist-editor/package.json -> ${canonicalVersion} (was ${pePkgPrev})`);

// Update web-portal package.json
const wpPkg = readJson(webPortalPackageJsonPath);
const wpPkgPrev = wpPkg.version;
wpPkg.version = canonicalVersion;
writeJson(webPortalPackageJsonPath, wpPkg);
console.log(`  apps/web-portal/package.json -> ${canonicalVersion} (was ${wpPkgPrev})`);

console.log(`\nAll files synced to version ${canonicalVersion}\n`);
