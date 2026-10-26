/* eslint-disable no-console */
const fs = require("node:fs");
const pathModule = require("node:path");
const { isDeepStrictEqual } = require("node:util");

let errors = 0;
const packageVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;

function validate(path, shouldHaveKey, shouldHaveScripts) {
  const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
  const directory = pathModule.dirname(path);
  const entryFiles = [
    "editor/index.html",
    "editor/main.js",
    "editor/bundle.css",
    manifest.action?.default_popup,
    manifest.background?.service_worker,
    ...(manifest.background?.scripts || []),
    ...Object.values(manifest.icons || {}),
    ...(manifest.content_scripts || []).flatMap((script) => script.js || []),
  ].filter(Boolean);
  for (const file of entryFiles) {
    if (!fs.existsSync(pathModule.join(directory, file))) {
      console.error(`FAIL: ${path} references missing ${file}`);
      errors++;
    }
  }
  if (manifest.manifest_version !== 3 || manifest.version !== packageVersion) {
    console.error(`FAIL: ${path} has an inconsistent version`);
    errors++;
  }
  if (manifest.permissions?.includes("bookmarks")) {
    console.error(`FAIL: ${path} requests unused bookmarks permission`);
    errors++;
  }

  if (shouldHaveKey && !manifest.key) {
    console.error(`FAIL: ${path} missing "key" (extension ID will be dynamic)`);
    errors++;
  }
  if (!shouldHaveKey && manifest.key) {
    console.error(`FAIL: ${path} should NOT have "key"`);
    errors++;
  }

  const hasScripts = manifest.background?.scripts !== undefined;
  if (shouldHaveScripts && !hasScripts) {
    console.error(`FAIL: ${path} missing "background.scripts"`);
    errors++;
  }
  if (!shouldHaveScripts && hasScripts) {
    console.error(`FAIL: ${path} should NOT have "background.scripts"`);
    errors++;
  }
}

function validateEdgeMatchesChrome() {
  const chromeManifest = JSON.parse(fs.readFileSync("dist/chrome/manifest.json", "utf8"));
  const edgeManifest = JSON.parse(fs.readFileSync("dist/edge/manifest.json", "utf8"));

  const expectedEdge = JSON.parse(JSON.stringify(chromeManifest));
  delete expectedEdge.key;
  delete expectedEdge.browser_specific_settings;

  if (edgeManifest.browser_specific_settings) {
    console.error(
      'FAIL: dist/edge/manifest.json must NOT contain "browser_specific_settings" (Firefox-only)'
    );
    errors++;
  }

  if (!isDeepStrictEqual(edgeManifest, expectedEdge)) {
    console.error(
      "FAIL: dist/edge/manifest.json must exactly match dist/chrome/manifest.json minus key and browser_specific_settings"
    );
    errors++;
  }
}

try {
  validate("dist/chrome/manifest.json", true, false);
  validate("dist/firefox/manifest.json", false, true);
  validate("dist/edge/manifest.json", false, false);
  validateEdgeMatchesChrome();
} catch (error) {
  console.error(`FAIL: manifest validation crashed: ${error.message}`);
  process.exit(1);
}

if (errors) {
  process.exit(1);
}

// console.log('OK: All manifests are correct.');
