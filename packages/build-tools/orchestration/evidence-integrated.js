#!/usr/bin/env node
/**
 * Task 7.1 evidence: run repository check gates sequentially and record exact commands,
 * exit codes, durations and the tested tree identity.
 *
 * No remote mutation: only local checks are executed.
 *
 * Usage: node packages/build-tools/orchestration/evidence-integrated.js [--out <file>]
 */

import { spawnSync, execFileSync } from "child_process";
import fs from "fs";
import identity from "../verification/identity.js";
import { dirname } from "path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
  stdio: "pipe",
}).trim();

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8", stdio: "pipe" }).trim();
}

const commands = [
  { name: "unit-and-integration-tests", command: "npm", args: ["test"] },
  {
    name: "lint",
    command: "npx",
    args: ["eslint", "apps/browser-extension/", "packages/build-tools/", "--ext", ".js"],
  },
  { name: "format-check", command: "npx", args: ["prettier", "--check", "."] },
  { name: "file-size", command: "node", args: ["packages/build-tools/verify-file-size.js"] },
  { name: "css-bundle", command: "node", args: ["packages/build-tools/verify-css-bundle.js"] },
  {
    name: "vercel-config",
    command: "node",
    args: ["packages/build-tools/verify-vercel-config.js"],
  },
  {
    name: "contracts-check",
    command: "node",
    args: ["packages/build-tools/generate-protocol-declarations.js", "--check"],
  },
  {
    name: "release-notes-check",
    command: "node",
    args: ["packages/build-tools/gen-release-notes.mjs", "--check"],
  },
];

const outIndex = process.argv.indexOf("--out");
const outPath = outIndex > -1 ? process.argv[outIndex + 1] : null;

const evidence = {
  task: "7.1",
  change: "orchestrate-parallel-implementations",
  generatedAt: new Date().toISOString(),
  repository: {
    root: repoRoot,
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    head: git(["rev-parse", "HEAD"]),
    tree: git(["rev-parse", "HEAD^{tree}"]),
    workingTree: identity.sourceIdentity(repoRoot).sha256,
  },
  toolchain: {
    node: process.version,
    platform: process.platform,
    npm: execFileSync("npm", ["--version"], { encoding: "utf-8", stdio: "pipe" }).trim(),
  },
  remoteMutation: "none",
  commands: [],
};

for (const entry of commands) {
  const started = Date.now();
  const result = spawnSync(entry.command, entry.args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: "pipe",
    shell: false,
    env: { ...process.env, CI: "1" },
  });
  evidence.commands.push({
    name: entry.name,
    command: [entry.command, ...entry.args].join(" "),
    exitCode: result.status,
    durationMs: Date.now() - started,
    signal: result.signal || null,
    stdoutTail: (result.stdout || "").trim().split("\n").slice(-6).join("\n"),
    stderrTail: (result.stderr || "").trim().split("\n").slice(-6).join("\n"),
  });
  process.stderr.write(`${entry.name}: exit ${result.status}\n`);
}

evidence.repository.after = {
  head: git(["rev-parse", "HEAD"]),
  tree: git(["rev-parse", "HEAD^{tree}"]),
  workingTree: identity.sourceIdentity(repoRoot).sha256,
  unchanged: null,
};
evidence.repository.after.unchanged =
  evidence.repository.after.head === evidence.repository.head &&
  evidence.repository.after.tree === evidence.repository.tree &&
  evidence.repository.after.workingTree === evidence.repository.workingTree;

evidence.summary = {
  allPassed:
    evidence.repository.after.unchanged && evidence.commands.every((entry) => entry.exitCode === 0),
  failed: evidence.commands.filter((entry) => entry.exitCode !== 0).map((entry) => entry.name),
  treeUnchanged: evidence.repository.after.unchanged,
  note: "Build gates requiring npm ci/network install were not run; checks above are local.",
};

const json = JSON.stringify(evidence, null, 2);
if (outPath) {
  fs.mkdirSync(dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json + "\n");
}
console.log(json);
process.exit(evidence.summary.allPassed ? 0 : 1);
