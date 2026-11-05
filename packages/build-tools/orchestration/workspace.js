import {
  branchExists,
  getWorktreeInventory,
  getDirtyStatus,
  createWorktreeGit,
  removeWorktreeGit,
  archiveWorktreeManaged,
} from "./workspace-git.js";
export {
  branchExists,
  getWorktreeInventory,
  getDirtyStatus,
  createWorktreeGit,
  removeWorktreeGit,
  archiveWorktreeManaged,
} from "./workspace-git.js";
export { WorkspaceError, WorkspaceBackend } from "./workspace-types.js";
// Workspace entry point
/**
 * Workspace Manager - Preflight, dry-run allocation, and worktree lifecycle
 *
 * Handles workspace validation, dry-run allocation, managed/Git backend capability,
 * and worktree creation/cleanup with dirty tree protection.
 */

import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";

/**
 * Check if a branch exists locally or remotely
 */

/**
 * Check if branch is protected (main, next, release/*)
 */
export function isProtectedBranch(branchName) {
  const protectedPatterns = ["^main$", "^next$", "^release/", "^hotfix/", "^production$"];
  return protectedPatterns.some((pattern) => new RegExp(pattern).test(branchName));
}

/**
 * Get existing worktree inventory
 */

/**
 * Check if a worktree path is occupied by another job
 */
export function isWorktreeOccupied(worktreePath, registry, excludeJobId = null) {
  const jobs = registry.listJobs();
  for (const job of jobs) {
    if (job.id === excludeJobId) continue;
    if (job.worktreePath === worktreePath) {
      return { occupied: true, jobId: job.id, state: job.state };
    }
  }
  return { occupied: false };
}

/**
 * Check if working directory has uncommitted changes
 */

/**
 * Verify committed prerequisites exist in starting commit
 */
export function verifyPrerequisites(repoRoot, requiredPaths) {
  const missing = [];
  for (const requiredPath of requiredPaths) {
    const fullPath = join(repoRoot, requiredPath);
    if (!fs.existsSync(fullPath)) {
      missing.push(requiredPath);
    }
  }
  return { satisfied: missing.length === 0, missing };
}

/**
 * Dry-run allocation - simulate worktree creation without making changes
 */
export function dryRunAllocation(params) {
  const { repoRoot, branchName, worktreePath, startingSha, registry, policy } = params;

  const results = {
    valid: true,
    checks: {},
    errors: [],
    warnings: [],
    reuseExisting: false,
  };

  // 1. Check branch name validity
  if (!branchName || !/^[a-z0-9/-]+$/i.test(branchName)) {
    results.valid = false;
    results.errors.push("Invalid branch name format");
  }
  results.checks.branchName = { valid: /^[a-z0-9/-]+$/i.test(branchName) };

  // 2. Check if branch is protected
  const protectedBranch = isProtectedBranch(branchName);
  if (protectedBranch) {
    results.valid = false;
    results.errors.push(`Branch '${branchName}' is protected`);
  }
  results.checks.protectedBranch = { valid: !protectedBranch };

  // 3. Reuse detection first: an existing job for this change/branch legitimately owns
  // the branch and worktree, so their presence is expected rather than a conflict.
  const existingJobs = registry.getJobsByChange(params.changeName);
  const matchingJob = existingJobs.find((j) => j.branch === branchName);
  if (matchingJob) {
    results.reuseExisting = true;
    results.warnings.push(`Reusing existing job ${matchingJob.id} for change ${params.changeName}`);
  }
  results.checks.existingJob = { found: !!matchingJob, jobId: matchingJob?.id };

  // 4. Check if branch already exists
  const branchCheck = branchExists(repoRoot, branchName);
  if (branchCheck.exists && !results.reuseExisting) {
    results.errors.push(`Branch '${branchName}' already exists (${branchCheck.location})`);
    results.valid = false;
  }
  results.checks.branchExists = { exists: branchCheck.exists, location: branchCheck.location };

  // 5. Check worktree path availability
  if (fs.existsSync(worktreePath)) {
    // Check if it's an existing git worktree
    try {
      execSync("git rev-parse --git-dir", { cwd: worktreePath, stdio: "ignore" });
      // It's a git repo - check if it's our worktree
      const occupied = isWorktreeOccupied(worktreePath, registry, matchingJob?.id ?? null);
      if (occupied.occupied) {
        results.reuseExisting = true;
        results.warnings.push(
          `Worktree at ${worktreePath} occupied by job ${occupied.jobId} (${occupied.state})`
        );
      } else if (matchingJob) {
        results.reuseExisting = true;
        results.warnings.push(`Reusing worktree at ${worktreePath} for job ${matchingJob.id}`);
      } else {
        results.errors.push(
          `Path ${worktreePath} exists and is a git repo but not tracked by any job`
        );
        results.valid = false;
      }
    } catch {
      results.errors.push(`Path ${worktreePath} exists but is not a git worktree`);
      results.valid = false;
    }
  }
  results.checks.worktreePath = { exists: fs.existsSync(worktreePath) };

  // 6. Check active job limit (a reused job already holds its own slot)
  if (!results.reuseExisting) {
    const limitCheck = checkActiveLimit(registry.listJobs(), policy.maxActive);
    if (!limitCheck.allowed) {
      results.valid = false;
      results.errors.push(limitCheck.reason);
    }
    results.checks.activeLimit = limitCheck;
  } else {
    results.checks.activeLimit = { allowed: true, reused: true };
  }

  // 7. Verify starting commit exists
  try {
    execSync(`git cat-file -t ${startingSha}`, { cwd: repoRoot, stdio: "ignore" });
    results.checks.startingSha = { valid: true };
  } catch {
    results.valid = false;
    results.errors.push(`Starting SHA ${startingSha} not found in repository`);
    results.checks.startingSha = { valid: false };
  }

  // 8. Check for dirty working directory (source preservation)
  const dirty = getDirtyStatus(repoRoot);
  if (dirty.dirty) {
    results.warnings.push(
      `Source has ${dirty.files.length} uncommitted changes - will be preserved`
    );
  }
  results.checks.dirtySource = dirty;

  return results;
}

/**
 * Create worktree using Git backend
 */

/**
 * Remove worktree using Git backend (with dirty protection)
 */

/**
 * Archive worktree using managed backend (placeholder for future integration)
 */

/**
 * Preflight check for a job before dispatch
 */
export function preflightJob(jobId, registry) {
  const job = registry.getJob(jobId);
  if (!job) {
    return {
      passed: false,
      checks: {
        jobExists: false,
        branchValid: false,
        worktreeAccessible: false,
        startingShaValid: false,
        dependenciesSatisfied: false,
        activeSlotAvailable: false,
      },
    };
  }

  const checks = {
    jobExists: true,
    branchValid: false,
    worktreeAccessible: false,
    startingShaValid: false,
    dependenciesSatisfied: false,
    activeSlotAvailable: true,
  };

  // Validate branch
  const branchCheck = branchExists(registry.repoRoot || process.cwd(), job.branch);
  checks.branchValid = branchCheck.exists;

  // Validate worktree
  try {
    execSync("git rev-parse --git-dir", { cwd: job.worktreePath, stdio: "ignore" });
    checks.worktreeAccessible = true;
  } catch {
    checks.worktreeAccessible = false;
  }

  // Validate starting SHA
  try {
    execSync(`git cat-file -t ${job.startingSha}`, { cwd: job.worktreePath, stdio: "ignore" });
    checks.startingShaValid = true;
  } catch {
    checks.startingShaValid = false;
  }

  // Check dependencies
  const allJobs = registry.listJobs();
  const depCheck = areDependenciesSatisfied(jobId, allJobs);
  checks.dependenciesSatisfied = depCheck.satisfied;

  // Check active slot
  const limitCheck = checkActiveLimit(registry.listJobs(), registry.policy?.maxActive || 2, jobId);
  checks.activeSlotAvailable = limitCheck.allowed;

  const allPassed = Object.values(checks).every(
    (v) => v === true || (typeof v === "object" && v.satisfied === true)
  );

  return { passed: allPassed, checks };
}

// Re-export dependency check from scheduler
import { areDependenciesSatisfied, checkActiveLimit } from "./scheduler.js";

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const repoRoot = process.argv[3] || process.cwd();
  const registry = new OrchestrationRegistry(repoRoot, { maxActive: 2 });

  async function run() {
    switch (command) {
      case "inventory": {
        const worktrees = getWorktreeInventory(repoRoot);
        console.log(JSON.stringify(worktrees, null, 2));
        break;
      }
      case "dryrun": {
        const branchName = process.argv[4];
        const worktreePath = process.argv[5];
        const startingSha = process.argv[6];
        const changeName = process.argv[7];

        const results = dryRunAllocation({
          repoRoot,
          branchName,
          worktreePath,
          startingSha,
          registry,
          policy: { maxActive: 2 },
          changeName,
        });
        console.log(JSON.stringify(results, null, 2));
        break;
      }
      case "preflight": {
        const jobId = process.argv[4];
        const result = preflightJob(jobId, registry);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      default: {
        console.error("Usage: workspace.js <inventory|dryrun|preflight>");
        process.exit(1);
      }
    }
  }

  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
