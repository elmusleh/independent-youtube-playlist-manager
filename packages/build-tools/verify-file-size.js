#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-file-size.js
 *
 * Enforces the AGENTS.md "no file over 350 lines" rule for source files.
 * Existing offenders are allowlisted by exact repo-relative path so legacy debt
 * does not fail the gate, but any new file over the limit (or any allowlisted
 * file moved/renamed) will fail.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const MAX_LINES = 350;

const scanRoots = [
  "apps/browser-extension/playlist-manager/src",
  "apps/browser-extension/background",
  "apps/browser-extension/popup",
  "packages/build-tools",
];

const extensions = new Set([".js", ".ts", ".svelte"]);

const legacyAllowlist = new Set([
  "apps/browser-extension/playlist-manager/src/views/Manage.svelte",
  "apps/browser-extension/playlist-manager/src/components/PlaylistEditor.svelte",
  "apps/browser-extension/playlist-manager/src/services/youtube-api.ts",
  "apps/browser-extension/playlist-manager/src/services/storage-service.ts",
  "apps/browser-extension/playlist-manager/src/views/History.svelte",
  "apps/browser-extension/playlist-manager/src/views/DeveloperSetup.svelte",
  "apps/browser-extension/playlist-manager/src/components/ReleaseNotesModal.svelte",
  "apps/browser-extension/playlist-manager/src/components/PlaylistVideo.svelte",
  "apps/browser-extension/playlist-manager/src/components/Header.svelte",
  "apps/browser-extension/playlist-manager/src/components/ProfileDropdown.svelte",
  "apps/browser-extension/playlist-manager/src/services/video-service.ts",
  "apps/browser-extension/playlist-manager/src/components/ViewHeader.svelte",
  "apps/browser-extension/playlist-manager/src/components/editor/PlaylistModals.svelte",
  "apps/browser-extension/playlist-manager/src/components/Sidebar.svelte",
  "apps/browser-extension/playlist-manager/src/services/backup-service.ts",
  "apps/browser-extension/playlist-manager/src/services/youtube-auth.ts",
  "apps/browser-extension/playlist-manager/src/services/db-service.ts",
  "apps/browser-extension/playlist-manager/src/views/Shortcuts.svelte",
  "apps/browser-extension/playlist-manager/src/components/editor/EditorToolbar.svelte",
  "apps/browser-extension/playlist-manager/src/services/supabase-sync.ts",
  "apps/browser-extension/playlist-manager/src/components/editor/MultiSortModal.svelte",
  "apps/browser-extension/playlist-manager/src/components/manage/ManageModals.svelte",
  // Deleted in the UI refactor (#31); kept here so this gate stays green on either
  // merge order and disappears once that lands.
  "apps/browser-extension/playlist-manager/src/views/Saved-refactored.svelte",
]);

function isExcluded(relativePath) {
  const base = path.basename(relativePath);
  if (base.includes(".test.") || base.includes(".spec.")) return true;
  return false;
}

function walk(absoluteDir, files) {
  if (!fs.existsSync(absoluteDir)) return;
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, files);
    } else if (extensions.has(path.extname(entry.name))) {
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      if (!isExcluded(relativePath)) files.push({ absolutePath, relativePath });
    }
  }
}

function countLines(content) {
  const lines = content.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

const files = [];
for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot), files);
}

const violations = [];
const allowlisted = [];

for (const { absolutePath, relativePath } of files) {
  const lineCount = countLines(fs.readFileSync(absolutePath, "utf8"));
  if (lineCount <= MAX_LINES) continue;

  if (legacyAllowlist.has(relativePath)) {
    allowlisted.push({ relativePath, lineCount });
  } else {
    violations.push({ relativePath, lineCount });
  }
}

for (const { relativePath, lineCount } of allowlisted) {
  console.log(`\x1b[33m[ALLOWLISTED]\x1b[0m ${relativePath}: ${lineCount} lines (existing debt)`);
}

if (violations.length > 0) {
  for (const { relativePath, lineCount } of violations) {
    console.error(
      `\x1b[31m[FILE SIZE] ${relativePath} has ${lineCount} lines (limit ${MAX_LINES}).\x1b[0m`
    );
  }
  console.error(
    `\n\x1b[31mFile-size verification failed. Split new files under ${MAX_LINES} lines; legacy files must be added by exact path to the allowlist.\x1b[0m\n`
  );
  process.exit(1);
}

console.log(
  `\n\x1b[32m✔ File-size verification passed (${files.length} files scanned, ${allowlisted.length} allowlisted legacy files).\x1b[0m`
);
