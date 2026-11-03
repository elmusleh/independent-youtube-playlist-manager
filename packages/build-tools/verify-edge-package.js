/* eslint-disable no-console */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..", "..");
const edgeDir = path.join(root, "dist", "edge");
const zipPath = path.join(root, "dist", "independent-youtube-playlist-manager-edge.zip");
const manifestPath = path.join(edgeDir, "manifest.json");

let failed = false;
function fail(msg) {
  console.error("FAIL:", msg);
  failed = true;
}
function ok(msg) {
  console.log("OK:  ", msg);
}

if (!fs.existsSync(manifestPath)) {
  console.error("ERROR: dist/edge/manifest.json not found. Run `npm run build` first.");
  process.exit(1);
}
if (!fs.existsSync(zipPath)) {
  console.error("ERROR: Edge store ZIP not found. Run `npm run pack:edge` first.");
  process.exit(1);
}

const sourceManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// Read the zip's manifest without extracting to disk.
const zipListing = execFileSync("unzip", ["-p", zipPath, "manifest.json"], {
  encoding: "utf8",
});
const zipManifest = JSON.parse(zipListing);

// 1. Version must agree.
if (zipManifest.version !== sourceManifest.version) {
  fail(`version mismatch: zip=${zipManifest.version} vs dist/edge=${sourceManifest.version}`);
} else {
  ok(`version ${zipManifest.version}`);
}

// 2. short_name must be Edge-legal (<= 12 chars) and identical.
const shortName = zipManifest.short_name;
if (typeof shortName !== "string" || shortName.length === 0) {
  fail("zip manifest has no short_name");
} else if (shortName.length > 12) {
  fail(`short_name "${shortName}" is ${shortName.length} chars; Edge maximum is 12`);
} else if (shortName !== sourceManifest.short_name) {
  fail(`short_name mismatch: zip="${shortName}" vs dist/edge="${sourceManifest.short_name}"`);
} else {
  ok(`short_name "${shortName}" (${shortName.length} chars, <= 12)`);
}

// 3. Name must agree.
if (zipManifest.name !== sourceManifest.name) {
  fail(`name mismatch: zip="${zipManifest.name}" vs dist/edge="${sourceManifest.name}"`);
} else {
  ok(`name "${zipManifest.name}"`);
}

// 4. Chrome-only / Firefox-only fields must be absent.
for (const field of ["key", "browser_specific_settings", "update_url"]) {
  if (field in zipManifest) {
    fail(`zip manifest still contains forbidden field "${field}"`);
  }
}
if (!failed) ok("no forbidden fields (key, browser_specific_settings, update_url)");

// 5. Permissions must agree.
const srcPerms = JSON.stringify(sourceManifest.permissions || []);
const zipPerms = JSON.stringify(zipManifest.permissions || []);
if (srcPerms !== zipPerms) {
  fail("permissions differ between dist/edge and the zip");
} else {
  ok(`permissions: ${(zipManifest.permissions || []).join(", ")}`);
}

// 6. Required runtime directories must be present in the zip.
const zipNames = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const requiredDirs = ["editor/", "background/", "content-scripts/", "popup/", "shared/", "assets/"];
for (const dir of requiredDirs) {
  const present = zipNames.some((n) => n === dir || n.startsWith(dir));
  if (!present) fail(`zip is missing required directory "${dir}"`);
  else ok(`directory present: ${dir}`);
}

// 7. No source maps shipped.
const mapFiles = zipNames.filter((n) => n.endsWith(".map"));
if (mapFiles.length > 0) {
  fail(`zip contains ${mapFiles.length} .map file(s)`);
} else {
  ok("no .map files");
}

if (failed) {
  console.error(
    "\nEdge package verification FAILED. Rebuild with `npm run build && npm run pack:edge` and retry."
  );
  process.exit(1);
}
console.log("\nEdge package verification PASSED.");
