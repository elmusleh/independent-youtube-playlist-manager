#!/usr/bin/env node
/**
 * sync-version.mjs
 * Reads the canonical version from apps/browser-extension/manifest.chrome.json and propagates
 * it to apps/browser-extension/manifest.firefox.json and package.json.
 *
 * The Edge manifest is generated from manifest.chrome.json at build time, so it needs no
 * separate version sync.
 *
 * Usage:
 *   node packages/build-tools/sync-version.mjs            # sync from chrome manifest
 *   node packages/build-tools/sync-version.mjs --set 2.12.25  # set new version everywhere
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { format, resolveConfig } from "prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

async function writeJson(filePath, data) {
  const config = await resolveConfig(filePath);
  const text = await format(JSON.stringify(data, null, 2), { ...config, filepath: filePath });
  writeFileSync(filePath, text, "utf-8");
}

const chromeManifestPath = resolve(root, "apps/browser-extension/manifest.chrome.json");
const firefoxManifestPath = resolve(root, "apps/browser-extension/manifest.firefox.json");
const packageJsonPath = resolve(root, "package.json");
const playlistEditorPackageJsonPath = resolve(
  root,
  "apps/browser-extension/playlist-manager/package.json"
);
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
await writeJson(chromeManifestPath, chromeManifest);
console.log(`  apps/browser-extension/manifest.chrome.json -> ${canonicalVersion}`);

// Update Firefox manifest
const firefoxManifest = readJson(firefoxManifestPath);
const firefoxPrev = firefoxManifest.version;
firefoxManifest.version = canonicalVersion;
await writeJson(firefoxManifestPath, firefoxManifest);
console.log(
  `  apps/browser-extension/manifest.firefox.json -> ${canonicalVersion} (was ${firefoxPrev})`
);

// Update package.json (root)
const pkg = readJson(packageJsonPath);
const pkgPrev = pkg.version;
pkg.version = canonicalVersion;
await writeJson(packageJsonPath, pkg);
console.log(`  package.json -> ${canonicalVersion} (was ${pkgPrev})`);

// Update playlist-manager package.json
const pePkg = readJson(playlistEditorPackageJsonPath);
const pePkgPrev = pePkg.version;
pePkg.version = canonicalVersion;
await writeJson(playlistEditorPackageJsonPath, pePkg);
console.log(
  `  apps/browser-extension/playlist-manager/package.json -> ${canonicalVersion} (was ${pePkgPrev})`
);

// Update web-portal package.json
const wpPkg = readJson(webPortalPackageJsonPath);
const wpPkgPrev = wpPkg.version;
wpPkg.version = canonicalVersion;
await writeJson(webPortalPackageJsonPath, wpPkg);
console.log(`  apps/web-portal/package.json -> ${canonicalVersion} (was ${wpPkgPrev})`);

// Keep npm ci metadata aligned with the manifest and package versions.
for (const directory of [".", "apps/browser-extension/playlist-manager", "apps/web-portal"]) {
  const lockPath = resolve(root, directory, "package-lock.json");
  const lock = readJson(lockPath);
  lock.version = canonicalVersion;
  if (lock.packages?.[""]) lock.packages[""].version = canonicalVersion;
  await writeJson(lockPath, lock);
}

console.log(`\nAll files synced to version ${canonicalVersion}\n`);
