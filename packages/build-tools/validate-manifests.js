/* eslint-disable no-console */
const fs = require("fs");
const pathModule = require("path");

let errors = 0;

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
  if (
    manifest.manifest_version !== 3 ||
    manifest.version !== JSON.parse(fs.readFileSync("package.json", "utf8")).version
  ) {
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

try {
  validate("dist/chrome/manifest.json", true, false);
  validate("dist/firefox/manifest.json", false, true);
} catch {
  //   console.error('Validation error:', e_inner instanceof Error ? e_inner.message : String(e_inner));
  process.exit(1);
}

if (errors) {
  //   console.error(`\n${errors} validation error(s) found.`);
  process.exit(1);
}

// // console.log('OK: Both manifests are correct.');
