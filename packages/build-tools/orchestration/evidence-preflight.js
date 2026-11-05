#!/usr/bin/env node
/**
 * Task 3.1 evidence harness.
 *
 * Runs workspace preflight + dry-run allocation against a disposable repository and
 * writes machine-readable evidence: inventory, missing committed prerequisites,
 * dirty-source preservation, occupied/protected branches and reuse of existing jobs.
 *
 * Usage: node packages/build-tools/orchestration/evidence-preflight.js [--out <file>]
 */

import fs from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import {
  dryRunAllocation,
  getWorktreeInventory,
  getDirtyStatus,
  verifyPrerequisites,
  preflightJob,
} from "./workspace.js";

function git(cwd, args) {
  return execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function createDisposableRepo() {
  const dir = fs.mkdtempSync(join("/tmp", "orch-evidence-"));
  git(dir, "init -q");
  git(dir, 'config user.email "evidence@test.local"');
  git(dir, 'config user.name "Evidence Harness"');
  fs.mkdirSync(join(dir, "openspec", "changes", "demo"), { recursive: true });
  fs.writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "evidence-fixture", version: "0.0.0" }, null, 2)
  );
  fs.writeFileSync(join(dir, "openspec", "changes", "demo", "tasks.md"), "# Tasks\n\n- [ ] demo\n");
  git(dir, "add -A");
  git(dir, 'commit -q -m "committed prerequisite snapshot"');
  return dir;
}

async function main() {
  const outIndex = process.argv.indexOf("--out");
  const outPath = outIndex > -1 ? process.argv[outIndex + 1] : null;

  const repoRoot = createDisposableRepo();
  const registry = new OrchestrationRegistry(repoRoot, { maxActive: 2 });
  const startingSha = git(repoRoot, "rev-parse HEAD");
  const worktreePath = join(repoRoot, ".worktrees", "demo-job");

  const evidence = {
    task: "3.1",
    change: "orchestrate-parallel-implementations",
    generatedAt: new Date().toISOString(),
    repository: { root: repoRoot, startingSha, head: startingSha },
    cases: {},
  };

  // Case 1: committed prerequisites present in the starting snapshot.
  evidence.cases.committedPrerequisites = {
    required: ["package.json", "openspec/changes/demo/tasks.md"],
    ...verifyPrerequisites(repoRoot, ["package.json", "openspec/changes/demo/tasks.md"]),
  };

  // Case 2: missing committed prerequisite is detected.
  evidence.cases.missingCommittedPrerequisite = {
    required: ["package.json", "openspec/changes/demo/missing.md"],
    ...verifyPrerequisites(repoRoot, ["package.json", "openspec/changes/demo/missing.md"]),
  };

  // Case 3: dirty source is preserved (never auto-snapshotted, never discarded).
  const dirtyFile = join(repoRoot, "local-only-edit.txt");
  fs.writeFileSync(dirtyFile, "unrelated local edit\n");
  const dirtyBefore = getDirtyStatus(repoRoot);
  const dirtyAllocation = dryRunAllocation({
    repoRoot,
    branchName: "feat/demo-job",
    worktreePath,
    startingSha,
    registry,
    policy: { maxActive: 2 },
    changeName: "demo-change",
  });
  evidence.cases.dirtySourcePreservation = {
    detected: dirtyBefore.dirty,
    files: dirtyBefore.files,
    stillPresentAfterAllocation: fs.existsSync(dirtyFile),
    committedByHarness: false,
    warnings: dirtyAllocation.warnings.filter((w) => w.includes("uncommitted")),
  };
  fs.rmSync(dirtyFile, { force: true });

  // Case 4: protected branch is rejected.
  const protectedResult = dryRunAllocation({
    repoRoot,
    branchName: "main",
    worktreePath: join(repoRoot, ".worktrees", "protected"),
    startingSha,
    registry,
    policy: { maxActive: 2 },
    changeName: "protected-case",
  });
  evidence.cases.protectedBranch = {
    branch: "main",
    valid: protectedResult.valid,
    errors: protectedResult.errors,
  };

  // Case 5: occupied branch/worktree is detected and reused rather than duplicated.
  git(repoRoot, `worktree add -q -b feat/occupied ${join(repoRoot, ".worktrees", "occupied")}`);
  await registry.createJob({
    id: "job-occupied",
    schemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    changeName: "occupied-change",
    branch: "feat/occupied",
    worktreePath: join(repoRoot, ".worktrees", "occupied"),
    worktreeManager: "git",
    startingSha,
    dependencies: [],
    state: "queued",
  });
  const reuseResult = dryRunAllocation({
    repoRoot,
    branchName: "feat/occupied",
    worktreePath: join(repoRoot, ".worktrees", "occupied"),
    startingSha,
    registry,
    policy: { maxActive: 2 },
    changeName: "occupied-change",
  });
  evidence.cases.occupiedBranchReuse = {
    reuseExisting: reuseResult.reuseExisting,
    existingJobId: reuseResult.checks.existingJob.jobId,
    errors: reuseResult.errors,
    inventory: getWorktreeInventory(repoRoot).map((w) => ({ path: w.path, branch: w.branch })),
  };

  // Case 6: valid allocation passes preflight.
  const validResult = dryRunAllocation({
    repoRoot,
    branchName: "feat/demo-job",
    worktreePath,
    startingSha,
    registry,
    policy: { maxActive: 2 },
    changeName: "demo-change",
  });
  git(repoRoot, `worktree add -q -b feat/demo-job ${worktreePath}`);
  await registry.createJob({
    id: "job-demo",
    schemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    changeName: "demo-change",
    branch: "feat/demo-job",
    worktreePath,
    worktreeManager: "git",
    startingSha,
    dependencies: [],
    state: "queued",
  });
  const preflight = preflightJob("job-demo", registry);
  evidence.cases.validAllocation = {
    dryRunValid: validResult.valid,
    dryRunErrors: validResult.errors,
    preflightPassed: preflight.passed,
    preflightChecks: preflight.checks,
  };

  evidence.summary = {
    allCasesPassed:
      evidence.cases.committedPrerequisites.satisfied === true &&
      evidence.cases.missingCommittedPrerequisite.satisfied === false &&
      evidence.cases.dirtySourcePreservation.detected === true &&
      evidence.cases.dirtySourcePreservation.stillPresentAfterAllocation === true &&
      evidence.cases.protectedBranch.valid === false &&
      evidence.cases.occupiedBranchReuse.reuseExisting === true &&
      evidence.cases.validAllocation.dryRunValid === true &&
      evidence.cases.validAllocation.preflightPassed === true,
  };

  const serialized = JSON.stringify(evidence, null, 2);
  if (outPath) {
    fs.mkdirSync(dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, serialized + "\n");
  }
  console.log(serialized);

  // Cleanup the disposable repository (never the real tree).
  git(repoRoot, "worktree list --porcelain")
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length).trim())
    .filter((path) => path !== repoRoot)
    .forEach((path) => {
      try {
        execSync(`git worktree remove --force "${path}"`, { cwd: repoRoot, stdio: "ignore" });
      } catch {
        /* already gone */
      }
    });
  fs.rmSync(repoRoot, { recursive: true, force: true });

  process.exit(evidence.summary.allCasesPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
