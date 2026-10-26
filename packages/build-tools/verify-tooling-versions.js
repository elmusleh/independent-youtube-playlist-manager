#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-tooling-versions.js
 *
 * The repo has no npm workspaces: root, apps/web-portal and the playlist manager each
 * install their own tree. Playwright browsers, however, live in ONE shared cache
 * (~/.cache/ms-playwright) keyed by the Playwright version — so two trees resolving
 * different Playwright versions silently share a cache that can only satisfy one of them.
 *
 * CI installs browsers from apps/web-portal only. When root's Playwright drifted ahead
 * (a Dependabot bump of the root group), the extension suite died with:
 *
 *   browserType.launchPersistentContext: Executable doesn't exist at
 *   /home/runner/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
 *
 * …which reads like a flake and is actually a version skew. Any independent bump of
 * either tree re-creates it, because Dependabot updates each directory separately.
 *
 * This guard fails the quality job with a message that names the fix, instead of letting
 * the E2E job fail 15 minutes later with a missing-executable error.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

/** Packages that must resolve to one version across every tree that installs them. */
const SHARED_PACKAGES = ["playwright", "@playwright/test"];

/** Lockfiles that install a shared package. Order is the display order. */
const LOCKFILES = ["package-lock.json", "apps/web-portal/package-lock.json"];

function readLockfile(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return null;
  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    return { error: error.message };
  }
}

/** The version installed at the tree root (`node_modules/<name>`, not a nested copy). */
function rootVersionOf(lock, name) {
  const entry = lock?.packages?.[`node_modules/${name}`];
  if (!entry) return null;
  // `version` is absent for link/workspace entries; those cannot pin a browser build.
  return entry.version ?? null;
}

function main() {
  const problems = [];
  const seen = [];

  const locks = LOCKFILES.map((relative) => ({ relative, lock: readLockfile(relative) }));

  for (const { relative, lock } of locks) {
    if (!lock) {
      problems.push(`${relative}: missing — run npm install in that directory`);
    } else if (lock.error) {
      problems.push(`${relative}: invalid JSON (${lock.error})`);
    }
  }

  if (problems.length === 0) {
    for (const name of SHARED_PACKAGES) {
      const resolved = locks
        .map(({ relative, lock }) => ({ relative, version: rootVersionOf(lock, name) }))
        .filter((entry) => entry.version);

      if (resolved.length < 2) continue;
      seen.push(`${name}@${resolved[0].version}`);

      const versions = new Set(resolved.map((entry) => entry.version));
      if (versions.size > 1) {
        const detail = resolved.map((e) => `${e.relative}=${e.version}`).join(", ");
        problems.push(
          `${name} resolves to different versions across trees (${detail}). ` +
            `Playwright browsers share one cache, so the tree that installed them is the ` +
            `only one that can run. Bump ${name} in every tree in the same PR ` +
            `(root package.json and apps/web-portal/package.json), then re-run ` +
            `npm install in both directories so the lockfiles agree.`
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error("✖ Tooling version verification failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `✔ Tooling versions aligned across ${locks.length} lockfiles (${seen.join(", ") || "nothing shared"}).`
  );
}

main();
