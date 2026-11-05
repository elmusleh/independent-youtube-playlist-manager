import { claimOwnership, releaseOwnership, updateHeartbeat } from "./registry-ownership.js";
import { createJob, transitionJob, patchJob } from "./registry-jobs.js";
///usr/bin/env node
/**
 * Git Common Directory Registry
 *
 * A private registry stored in Git's common directory (shared across all worktrees).
 * Provides atomic persistence, short-lived locking, and job state management.
 */

import fs from "fs";
import { resolve, join } from "path";
import { execSync } from "child_process";
import { isActiveState } from "./state-machine.js";
import { getSchedulingDecision, getReadyJobs } from "./scheduler.js";

export { RegistryError } from "./registry-error.js";
import { RegistryError } from "./registry-error.js";

function getGitCommonDir(repoRoot) {
  try {
    const output = execSync("git rev-parse --git-common-dir", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    return resolve(repoRoot, output);
  } catch {
    return join(repoRoot, ".git");
  }
}

function getRepoRoot(startPath = process.cwd()) {
  try {
    const output = execSync("git rev-parse --show-toplevel", {
      cwd: startPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    return output;
  } catch {
    throw new RegistryError("Not inside a Git repository", "NOT_GIT_REPO");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OrchestrationRegistry {
  constructor(repoRoot, policy) {
    this.repoRoot = repoRoot || getRepoRoot();
    this.policy = policy || { maxActive: 2 };
    const commonDir = getGitCommonDir(this.repoRoot);
    this.registryDir = join(commonDir, "agent-orchestration");
    this.jobsDir = join(this.registryDir, "jobs");
    this.journalPath = join(this.registryDir, "journal.jsonl");
    this.lockPath = join(this.registryDir, ".lock");

    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.registryDir)) {
      fs.mkdirSync(this.registryDir, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(this.jobsDir)) {
      fs.mkdirSync(this.jobsDir, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(this.journalPath)) {
      fs.writeFileSync(this.journalPath, "", { mode: 0o600 });
    }
  }

  async acquireLock(timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        fs.closeSync(fs.openSync(this.lockPath, "wx"));
        return true;
      } catch (err) {
        if (err.code === "EEXIST") {
          const waitTime = Math.min(50 + Math.random() * 50, 200);
          await sleep(waitTime);
          continue;
        }
        throw err;
      }
    }
    return false;
  }

  releaseLock() {
    try {
      fs.unlinkSync(this.lockPath);
    } catch {
      // Lock already released or never acquired
    }
  }

  async withLock(fn, timeoutMs = 5000) {
    const acquired = await this.acquireLock(timeoutMs);
    if (!acquired) {
      throw new RegistryError("Could not acquire registry lock", "LOCK_TIMEOUT");
    }
    try {
      return await fn();
    } finally {
      this.releaseLock();
    }
  }

  atomicWrite(filePath, content) {
    const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tempPath, content, { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  }

  readJsonFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  getJobPath(jobId) {
    return join(this.jobsDir, `${jobId}.json`);
  }

  async createJob(jobInput) {
    return createJob(this, jobInput);
  }

  getJob(jobId) {
    return this.readJsonFile(this.getJobPath(jobId));
  }

  /**
   * New validated transition method with full context
   */
  async transitionJob(jobId, toState, context = {}) {
    return transitionJob(this, jobId, toState, context);
  }

  /**
   * Backward-compatible updateJob method for tests and legacy code
   */
  async updateJob(jobId, updates) {
    return this.transitionJob(jobId, updates.state, { updates });
  }

  /**
   * Patch non-state job metadata (workspace owner, manager identifiers, receipts).
   * State changes must go through transitionJob so they stay validated.
   */
  async patchJob(jobId, updates) {
    return patchJob(this, jobId, updates);
  }

  async claimOwnership(jobId, sessionId, pid, livenessRef) {
    return claimOwnership(this, jobId, sessionId, pid, livenessRef);
  }

  async releaseOwnership(jobId, sessionId) {
    return releaseOwnership(this, jobId, sessionId);
  }

  async updateHeartbeat(jobId, sessionId) {
    return updateHeartbeat(this, jobId, sessionId);
  }

  isOwnerAlive(owner) {
    try {
      process.kill(owner.pid, 0);
      const lastHeartbeat = new Date(owner.lastHeartbeat).getTime();
      const now = Date.now();
      return now - lastHeartbeat < 5 * 60 * 1000;
    } catch {
      return false;
    }
  }

  async addOperationReceipt(jobId, receipt) {
    return this.withLock(async () => {
      const job = this.getJob(jobId);
      if (!job) {
        throw new RegistryError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
      }

      const now = new Date().toISOString();
      const fullReceipt = {
        ...receipt,
        id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: now,
      };

      const updatedJob = {
        ...job,
        operationReceipts: [...job.operationReceipts, fullReceipt],
        updatedAt: now,
      };

      this.atomicWrite(this.getJobPath(jobId), JSON.stringify(updatedJob, null, 2));

      return updatedJob;
    });
  }

  listJobs() {
    const jobs = [];
    for (const file of fs.readdirSync(this.jobsDir)) {
      if (file.endsWith(".json")) {
        const job = this.readJsonFile(join(this.jobsDir, file));
        if (job) jobs.push(job);
      }
    }
    return jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getActiveJobs() {
    return this.listJobs().filter((job) => isActiveState(job.state));
  }

  getJobsByChange(changeName) {
    return this.listJobs().filter((job) => job.changeName === changeName);
  }

  getReadyJobs() {
    const allJobs = this.listJobs();
    return getReadyJobs(allJobs, this.policy.maxActive);
  }

  getSchedulingDecision(jobId) {
    const allJobs = this.listJobs();
    return getSchedulingDecision(jobId, allJobs, this.policy.maxActive);
  }

  appendJournal(entry) {
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(this.journalPath, line, { mode: 0o600 });
  }

  getJournal(jobId) {
    const entries = [];
    const content = fs.readFileSync(this.journalPath, "utf-8");
    for (const line of content.trim().split("\n")) {
      if (line) {
        try {
          const entry = JSON.parse(line);
          if (!jobId || entry.jobId === jobId) {
            entries.push(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
    return entries;
  }

  reconcileUncertainOperations() {
    const uncertain = [];
    for (const job of this.listJobs()) {
      for (const receipt of job.operationReceipts) {
        if (receipt.status === "uncertain" || receipt.status === "pending") {
          uncertain.push({ jobId: job.id, receipt });
        }
      }
    }
    return uncertain;
  }
}

// Re-export for convenience
export { JobState } from "./state-machine.js";
export {
  checkActiveLimit,
  validateDependencies,
  areDependenciesSatisfied,
  generateJobId,
  getSchedulingDecision,
  getReadyJobs,
} from "./scheduler.js";

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const registry = new OrchestrationRegistry();

  async function run() {
    switch (command) {
      case "init": {
        console.log(`Registry initialized at: ${registry.registryDir}`);
        break;
      }
      case "list": {
        const jobs = registry.listJobs();
        console.log(JSON.stringify(jobs, null, 2));
        break;
      }
      case "active": {
        const jobs = registry.getActiveJobs();
        console.log(JSON.stringify(jobs, null, 2));
        break;
      }
      case "ready": {
        const jobs = registry.getReadyJobs();
        console.log(JSON.stringify(jobs, null, 2));
        break;
      }
      case "journal": {
        const jobId = process.argv[3];
        const entries = registry.getJournal(jobId);
        console.log(JSON.stringify(entries, null, 2));
        break;
      }
      case "reconcile": {
        const uncertain = registry.reconcileUncertainOperations();
        console.log(JSON.stringify(uncertain, null, 2));
        break;
      }
      case "schedule": {
        const jobId = process.argv[3];
        const decision = registry.getSchedulingDecision(jobId);
        console.log(JSON.stringify(decision, null, 2));
        break;
      }
      default: {
        console.error(
          "Usage: registry.js <init|list|active|ready|journal [jobId]|reconcile|schedule [jobId]>"
        );
        process.exit(1);
      }
    }
  }

  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
