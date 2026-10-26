/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "../..");
const edgeDir = path.join(root, "dist/edge");
const tmpDir = path.join(root, "dist/.store-edge");
const manifestPath = path.join(edgeDir, "manifest.json");

if (!fs.existsSync(manifestPath) || !fs.existsSync(path.join(edgeDir, "editor/main.js"))) {
  console.error("ERROR: dist/edge build not found. Run `npm run build` first.");
  process.exit(1);
}

// Edge Add-ons rejects Chrome/Firefox-specific fields. The build already
// strips them, so this is a defensive guard for manually prepared builds.
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const field of ["key", "browser_specific_settings"]) {
  if (field in manifest) {
    console.warn(`WARN: manifest has "${field}" — removing for Edge store submission.`);
    delete manifest[field];
  }
}

// Build the store ZIP from a clean copy.
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.cpSync(edgeDir, tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

execFileSync("zip", ["-r", "-FS", "../independent-youtube-playlist-manager-edge.zip", "."], {
  cwd: tmpDir,
  stdio: "inherit",
});

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(
  "OK: Store-ready Edge ZIP written to dist/independent-youtube-playlist-manager-edge.zip"
);
