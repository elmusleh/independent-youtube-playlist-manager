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

/**
 * Legacy files allowed over MAX_LINES with exact ratchet limits.
 * If an allowlisted file grows beyond its recorded line count, verification fails.
 */
const legacyAllowlist = new Map([
  ["apps/browser-extension/playlist-manager/src/views/Manage.svelte", 2144],
  ["apps/browser-extension/playlist-manager/src/components/PlaylistEditor.svelte", 1930],
  ["apps/browser-extension/playlist-manager/src/services/youtube-api.ts", 1770],
  ["apps/browser-extension/playlist-manager/src/services/storage-service.ts", 1230],
  ["apps/browser-extension/playlist-manager/src/views/History.svelte", 746],
  ["apps/browser-extension/playlist-manager/src/views/DeveloperSetup.svelte", 743],
  // Data Manager view: async scan/refresh/retry coordination plus the embedded
  // repair queue. Split the action layer before it grows further.
  ["apps/browser-extension/playlist-manager/src/views/MetadataManager.svelte", 437],
  ["apps/browser-extension/playlist-manager/src/components/ReleaseNotesModal.svelte", 350],
  ["apps/browser-extension/playlist-manager/src/components/PlaylistVideo.svelte", 648],
  ["apps/browser-extension/playlist-manager/src/components/Header.svelte", 488],
  ["apps/browser-extension/playlist-manager/src/components/ProfileDropdown.svelte", 475],
  ["apps/browser-extension/playlist-manager/src/services/video-service.ts", 623],
  ["apps/browser-extension/playlist-manager/src/components/ViewHeader.svelte", 529],
  ["apps/browser-extension/playlist-manager/src/components/editor/PlaylistModals.svelte", 465],
  ["apps/browser-extension/playlist-manager/src/components/Sidebar.svelte", 784],
  ["apps/browser-extension/playlist-manager/src/components/FavoritesManager.svelte", 484],
  ["apps/browser-extension/playlist-manager/src/services/backup-service.ts", 350],
  ["apps/browser-extension/playlist-manager/src/services/youtube-auth.ts", 391],
  ["apps/browser-extension/playlist-manager/src/views/Shortcuts.svelte", 371],
  ["apps/browser-extension/playlist-manager/src/components/editor/EditorToolbar.svelte", 397],
  ["apps/browser-extension/playlist-manager/src/components/editor/MultiSortModal.svelte", 358],
  ["apps/browser-extension/playlist-manager/src/components/manage/ManageModals.svelte", 360],
  ["apps/browser-extension/playlist-manager/src/views/Saved-refactored.svelte", 350],
  ["apps/browser-extension/playlist-manager/src/views/Sync.svelte", 663],
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
    const maxAllowed = legacyAllowlist.get(relativePath);
    if (lineCount > maxAllowed) {
      violations.push({
        relativePath,
        lineCount,
        maxAllowed,
        isGrowth: true,
      });
    } else {
      allowlisted.push({ relativePath, lineCount, maxAllowed });
    }
  } else {
    violations.push({ relativePath, lineCount, maxAllowed: MAX_LINES, isGrowth: false });
  }
}

for (const { relativePath, lineCount, maxAllowed } of allowlisted) {
  console.log(
    `\x1b[33m[ALLOWLISTED]\x1b[0m ${relativePath}: ${lineCount} lines (ratchet limit: ${maxAllowed})`
  );
}

if (violations.length > 0) {
  for (const { relativePath, lineCount, maxAllowed, isGrowth } of violations) {
    if (isGrowth) {
      console.error(
        `\x1b[31m[FILE SIZE RATCHET] ${relativePath} grew to ${lineCount} lines (allowed max: ${maxAllowed}). Refactor or ratchet downwards, do not expand.\x1b[0m`
      );
    } else {
      console.error(
        `\x1b[31m[FILE SIZE] ${relativePath} has ${lineCount} lines (limit ${MAX_LINES}).\x1b[0m`
      );
    }
  }
  console.error(
    `\n\x1b[31mFile-size verification failed. Split new files under ${MAX_LINES} lines; allowlisted files cannot grow beyond their recorded ratchet cap.\x1b[0m\n`
  );
  process.exit(1);
}

console.log(
  `\n\x1b[32m✔ File-size verification passed (${files.length} files scanned, ${allowlisted.length} allowlisted legacy files).\x1b[0m`
);
