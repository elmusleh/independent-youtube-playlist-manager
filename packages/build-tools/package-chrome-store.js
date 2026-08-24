/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "../..");
const chromeDir = path.join(root, "dist/chrome");
const tmpDir = path.join(root, "dist/.store-chrome");
const manifestPath = path.join(chromeDir, "manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error("ERROR: dist/chrome/manifest.json not found. Run `npm run build` first.");
  process.exit(1);
}

// Read the built manifest and strip the `key` field.
// The `key` field is required for local unpacked loading (locks the extension ID),
// but the Chrome Web Store rejects manifests that contain it.
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!manifest.key) {
  console.warn('WARN: manifest has no "key" field — nothing to strip.');
}
delete manifest.key;

// Build the store ZIP from a clean copy so the dev build (dist/chrome) keeps its key.
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.cpSync(chromeDir, tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

execSync(`cd ${tmpDir} && zip -r -FS ../independent-youtube-playlist-manager-chrome.zip .`, {
  cwd: root,
  stdio: "inherit",
});

fs.rmSync(tmpDir, { recursive: true, force: true });
// // console.log('OK: Store-ready Chrome ZIP written with "key" stripped.');
