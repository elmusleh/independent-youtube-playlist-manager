#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-css-bundle.js
 *
 * Automated quality gate enforcing CSS bundling rules:
 * 1. Disallows `@import` inside Svelte `<style>` blocks (Rollup does not inline them;
 *    browsers ignore mid-bundle @imports).
 * 2. Checks generated bundle.css (if built) has zero stray @import statements.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const svelteSrc = path.join(root, "apps/browser-extension/playlist-manager/src");

let hasErrors = false;

function scanDirectory(dir, filterFn) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(scanDirectory(fullPath, filterFn));
    } else if (filterFn(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

// 1. Scan all .svelte files for @import in <style>
const svelteFiles = scanDirectory(svelteSrc, (f) => f.endsWith(".svelte"));

for (const file of svelteFiles) {
  const content = fs.readFileSync(file, "utf8");
  const styleMatch = content.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/gi);
  if (!styleMatch) continue;

  for (const block of styleMatch) {
    const lines = block.split("\n");
    lines.forEach((line) => {
      if (line.match(/^\s*@import\s+["'].*?["'];?/)) {
        const relPath = path.relative(root, file);
        console.error(
          `\x1b[31m[CSS RULE VIOLATION]\x1b[0m ${relPath} contains "@import":\n  ${line.trim()}`
        );
        console.error(
          `  -> Rule: Svelte components must NEVER use "@import" inside <style> blocks.`
        );
        console.error(
          `  -> Solution: Global stylesheets must be imported in src/main.ts, or write styles directly.`
        );
        hasErrors = true;
      }
    });
  }
}

// 2. Scan generated bundle.css (if it exists)
const bundlePaths = [
  path.join(root, "apps/browser-extension/editor/bundle.css"),
  path.join(root, "dist/chrome/editor/bundle.css"),
  path.join(root, "dist/firefox/editor/bundle.css"),
  path.join(root, "dist/edge/editor/bundle.css"),
];

for (const bundlePath of bundlePaths) {
  if (fs.existsSync(bundlePath)) {
    const content = fs.readFileSync(bundlePath, "utf8");
    const importLines = content.split("\n").filter((l) => l.trim().startsWith("@import"));
    if (importLines.length > 0) {
      const relPath = path.relative(root, bundlePath);
      console.error(
        `\x1b[31m[CSS BUNDLE VIOLATION]\x1b[0m ${relPath} contains ${importLines.length} stray @import statement(s):`
      );
      importLines.forEach((l) => console.error(`  ${l.trim()}`));
      console.error(`  -> Browsers drop @import declarations that appear after other CSS rules.`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  console.error(
    `\n\x1b[31mCSS bundle verification failed. See AGENTS.md for styling architecture rules.\x1b[0m\n`
  );
  process.exit(1);
} else {
  console.log(`\x1b[32m✔ CSS bundle & component style verification passed.\x1b[0m`);
}
