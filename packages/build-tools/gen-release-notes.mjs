#!/usr/bin/env node
/**
 * gen-release-notes.mjs
 *
 * Generates the extension's in-app release notes from CHANGELOG.md.
 *
 * The modal used to carry a hand-copied history; it had drifted so far that the
 * page showed a 2020 entry for 1.2.0 alongside the real one. The changelog is now
 * the single source of truth and this script derives the data the UI renders.
 *
 * Usage:
 *   node packages/build-tools/gen-release-notes.mjs           # write the file
 *   node packages/build-tools/gen-release-notes.mjs --check   # fail if stale
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format as formatWithPrettier, resolveConfig } from "prettier";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHANGELOG = path.join(root, "CHANGELOG.md");
const OUTPUT = path.join(
  root,
  "apps/browser-extension/playlist-manager/src/generated/release-notes.ts"
);

const SKIP_VERSIONS = new Set(["Unreleased"]);

/** Flattens the inline markdown the changelog uses into plain display text. */
function toPlainText(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** -> bold
    .replace(/`([^`]+)`/g, "$1") // `code` -> code
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses Keep-a-Changelog markdown into the structure the modal renders.
 * Nested bullets are folded into their parent as extra sentences, because the
 * modal has no nested list styling of its own.
 */
function parseChangelog(markdown) {
  const entries = [];
  let entry = null;
  let section = null;

  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\r$/, "");

    const versionHeading = line.match(/^##\s+\[([^\]]+)\](?:\s*-\s*(.+))?\s*$/);
    if (versionHeading) {
      entry = {
        version: versionHeading[1].trim(),
        date: (versionHeading[2] || "").trim(),
        sections: [],
      };
      section = null;
      entries.push(entry);
      continue;
    }

    if (/^##\s+/.test(line)) {
      entry = null;
      section = null;
      continue;
    }

    const sectionHeading = line.match(/^###\s+(.+?)\s*$/);
    if (sectionHeading && entry) {
      section = { heading: sectionHeading[1].trim(), items: [] };
      entry.sections.push(section);
      continue;
    }

    if (!entry || !section) continue;

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      section.items.push(toPlainText(bullet[1]));
      continue;
    }

    // Wrapped or nested line belonging to the previous bullet.
    if (section.items.length > 0 && /^\s+\S/.test(line)) {
      const last = section.items.length - 1;
      section.items[last] = `${section.items[last]} ${toPlainText(line)}`.trim();
    }
  }

  return entries
    .filter((entry) => !SKIP_VERSIONS.has(entry.version))
    .filter((entry) => entry.sections.some((section) => section.items.length > 0));
}

function render(entries) {
  const body = entries
    .map((entry) => {
      const sections = entry.sections
        .filter((section) => section.items.length > 0)
        .map(
          (section) =>
            `      {\n        heading: ${JSON.stringify(section.heading)},\n        items: ${JSON.stringify(
              section.items,
              null,
              10
            ).replace(/\n\s*/g, "\n          ")},\n      },`
        )
        .join("\n");

      return `  {\n    version: ${JSON.stringify(entry.version)},\n    date: ${JSON.stringify(
        entry.date
      )},\n    sections: [\n${sections}\n    ],\n  },`;
    })
    .join("\n");

  return `// AUTO-GENERATED from CHANGELOG.md by packages/build-tools/gen-release-notes.mjs.
// Do not edit by hand. Run \`npm run release-notes\` after editing the changelog.

export type ReleaseNoteSection = { heading: string; items: string[] };

export type ReleaseNoteEntry = { version: string; date: string; sections: ReleaseNoteSection[] };

export const releaseNotes: ReleaseNoteEntry[] = [
${body}
];
`;
}

/**
 * Extracts one version's markdown verbatim, for the GitHub Release body, so the
 * release page and the changelog can never disagree.
 */
function extractVersionMarkdown(markdown, version) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) =>
    new RegExp(`^##\\s+\\[${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`).test(line)
  );
  if (start === -1) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }
  // Drop the bracketed heading (the release page already shows the version) and any
  // trailing blank lines, then rewrite "## [1.2.0] - date" as a readable header.
  const heading = lines[start].replace(/^##\s+/, "").trim();
  const body = lines
    .slice(start + 1, end)
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  return `## ${heading}\n\n${body}\n`;
}

async function main() {
  const check = process.argv.includes("--check");
  const bodyIndex = process.argv.indexOf("--release-body");
  const outIndex = process.argv.indexOf("--out");
  const markdown = fs.readFileSync(CHANGELOG, "utf8");

  if (bodyIndex !== -1) {
    const requested = (process.argv[bodyIndex + 1] || "").replace(/^v/, "");
    const target = requested || parseChangelog(markdown)[0]?.version;
    const section = target ? extractVersionMarkdown(markdown, target) : null;
    if (!section) {
      console.error(`No changelog section found for version "${target || "(none)"}".`);
      process.exitCode = 1;
      return;
    }
    const out = outIndex !== -1 ? process.argv[outIndex + 1] : "release-notes.md";
    fs.writeFileSync(out, section);
    console.log(`Wrote release body for ${target} to ${out}.`);
    return;
  }

  const entries = parseChangelog(markdown);

  if (entries.length === 0) {
    console.error("No release entries parsed from CHANGELOG.md — refusing to write an empty file.");
    process.exitCode = 1;
    return;
  }

  // Format with the repo's prettier config so `format:check` agrees with the output.
  const next = await formatWithPrettier(render(entries), {
    ...(await resolveConfig(OUTPUT)),
    filepath: OUTPUT,
  });
  const previous = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";

  if (check) {
    if (previous !== next) {
      console.error(
        "generated/release-notes.ts is stale. Run `npm run release-notes` and commit the result."
      );
      process.exitCode = 1;
      return;
    }
    console.log(`Release notes in sync (${entries.length} versions).`);
    return;
  }

  if (previous === next) {
    console.log(`Release notes already current (${entries.length} versions).`);
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, next);
  console.log(`Wrote ${entries.length} versions to ${path.relative(root, OUTPUT)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
