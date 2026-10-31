#!/usr/bin/env node
/**
 * Worktree lifecycle adapters.
 *
 * A managed create/archive API owns the workspace when it is available and reports
 * the capabilities this workflow needs; otherwise the Git worktree adapter is used,
 * but only when the caller permits that fallback. Cleanup never forces a dirty tree
 * away: refusal leaves the tree and a cleanup action for the owner.
 */

import fs from "fs";
import { execSync } from "child_process";
import {
  WorkspaceBackend,
  WorkspaceError,
  createWorktreeGit,
  getDirtyStatus,
  getWorktreeInventory,
  removeWorktreeGit,
} from "./workspace.js";

export class WorktreeCapabilityError extends Error {
  constructor(message, code = "CAPABILITY_UNAVAILABLE") {
    super(message);
    this.name = "WorktreeCapabilityError";
    this.code = code;
  }
}

const REQUIRED_CAPABILITIES = ["create", "archive", "inventory"];

/**
 * Git worktree adapter. Always available where git is installed.
 */
export class GitWorktreeManager {
  constructor() {
    this.id = "git";
    this.backend = WorkspaceBackend.GIT;
    this.capabilities = { create: true, archive: true, inventory: true };
  }

  isAvailable() {
    try {
      execSync("git --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  supports(capability) {
    return this.capabilities[capability] === true;
  }

  async create({ repoRoot, worktreePath, branchName, startingSha }) {
    const created = createWorktreeGit(repoRoot, worktreePath, branchName, startingSha);
    return { ...created, managerWorktreeId: null, owner: this.id };
  }

  async archive({ repoRoot, worktreePath, force = false }) {
    try {
      const result = removeWorktreeGit(repoRoot, worktreePath, force);
      return { removed: true, path: result.path, owner: this.id, forced: force === true };
    } catch (error) {
      if (error instanceof WorkspaceError) {
        return {
          removed: false,
          path: worktreePath,
          owner: this.id,
          reason: error.code,
          cleanupAction: error.code === "DIRTY_WORKTREE" ? "preserve-and-report" : "manual-cleanup",
        };
      }
      throw error;
    }
  }

  async inventory(repoRoot) {
    return getWorktreeInventory(repoRoot);
  }
}

/**
 * Adapter around an app-managed create/archive API.
 *
 * `provider` is expected to expose `create(request)`, `archive(request)` and
 * `list()`. It must return identifiers for created workspaces; a provider that
 * cannot is treated as unavailable rather than assumed to have succeeded.
 */
export class ManagedWorktreeManager {
  constructor({ id = "managed", provider, capabilities = {} } = {}) {
    this.id = id;
    this.backend = WorkspaceBackend.MANAGED;
    this.provider = provider;
    this.capabilities = {
      create: capabilities.create ?? typeof provider?.create === "function",
      archive: capabilities.archive ?? typeof provider?.archive === "function",
      inventory: capabilities.inventory ?? typeof provider?.list === "function",
    };
  }

  isAvailable() {
    if (!this.provider) return false;
    return REQUIRED_CAPABILITIES.every((capability) => this.supports(capability));
  }

  supports(capability) {
    return this.capabilities[capability] === true;
  }

  async create({ repoRoot, worktreePath, branchName, startingSha, jobId }) {
    if (!this.supports("create")) {
      throw new WorktreeCapabilityError(`Manager '${this.id}' cannot create workspaces`);
    }

    const response = await this.provider.create({
      repoRoot,
      worktreePath,
      branchName,
      startingSha,
      jobId,
    });

    if (!response || !response.managerWorktreeId) {
      throw new WorktreeCapabilityError(
        `Manager '${this.id}' did not return a workspace identifier; refusing to assume creation`,
        "UNCONFIRMED_CREATION"
      );
    }

    return {
      backend: WorkspaceBackend.MANAGED,
      owner: this.id,
      managerWorktreeId: response.managerWorktreeId,
      path: response.path || worktreePath,
      branch: response.branch || branchName,
    };
  }

  async isDirty({ worktreePath }) {
    if (typeof this.provider?.isDirty === "function") {
      return { dirty: (await this.provider.isDirty({ worktreePath })) === true, source: "manager" };
    }

    const gitStatus = getDirtyStatus(worktreePath);
    if (gitStatus.dirty) {
      return { dirty: true, source: "git", files: gitStatus.files };
    }

    // A clean git status is only evidence when the path really is a git work tree.
    try {
      execSync("git rev-parse --is-inside-work-tree", { cwd: worktreePath, stdio: "ignore" });
      return { dirty: false, source: "git" };
    } catch {
      return { dirty: true, source: "unknown", files: [], unknown: true };
    }
  }

  async archive({ repoRoot, worktreePath, managerWorktreeId, force = false }) {
    if (!this.supports("archive")) {
      throw new WorktreeCapabilityError(`Manager '${this.id}' cannot archive workspaces`);
    }

    // Dirty work is never forced away by the coordinator, regardless of backend.
    const state = await this.isDirty({ worktreePath });
    if (state.dirty && !force) {
      return {
        removed: false,
        path: worktreePath,
        owner: this.id,
        reason: state.unknown ? "DIRTY_STATUS_UNKNOWN" : "DIRTY_WORKTREE",
        files: state.files,
        cleanupAction: "preserve-and-report",
      };
    }

    const response = await this.provider.archive({
      repoRoot,
      worktreePath,
      managerWorktreeId,
      force,
      preserveDirty: false,
    });

    return {
      removed: response?.removed === true,
      path: worktreePath,
      owner: this.id,
      managerWorktreeId,
      forced: force === true,
      cleanupAction: response?.removed === true ? "none" : "manual-cleanup",
    };
  }

  async inventory() {
    if (!this.supports("inventory")) {
      throw new WorktreeCapabilityError(`Manager '${this.id}' cannot list workspaces`);
    }
    return this.provider.list();
  }
}

/**
 * Choose a lifecycle owner. Managed wins when it is available and capable;
 * Git is only a fallback and only where the caller permits it.
 */
export function selectWorktreeManager({
  preferred = "managed",
  managers = [],
  allowGitFallback = true,
} = {}) {
  const available = managers.filter((manager) => manager && manager.isAvailable());

  if (preferred === "managed") {
    const managed = available.find((manager) => manager.backend === WorkspaceBackend.MANAGED);
    if (managed) return managed;
  }

  const git = available.find((manager) => manager.backend === WorkspaceBackend.GIT);
  if (git && allowGitFallback) return git;

  if (git && !allowGitFallback) {
    throw new WorktreeCapabilityError(
      "No managed workspace manager is available and Git fallback is not permitted for this job",
      "FALLBACK_NOT_PERMITTED"
    );
  }

  throw new WorktreeCapabilityError("No usable workspace manager is available");
}

/**
 * Create a job's workspace through the selected manager and record the owner.
 */
export async function assignWorkspace({ manager, registry, jobId, params }) {
  const job = registry.getJob(jobId);
  if (!job) {
    return { created: false, reason: "JOB_NOT_FOUND" };
  }
  if (job.worktreePath && fs.existsSync(job.worktreePath)) {
    return {
      created: false,
      reused: true,
      owner: job.worktreeManager,
      managerWorktreeId: job.managerWorktreeId ?? null,
      path: job.worktreePath,
    };
  }

  const assignment = await manager.create({ ...params, jobId });
  await registry.patchJob(jobId, {
    worktreePath: assignment.path,
    branch: assignment.branch,
    worktreeManager: assignment.owner,
    managerWorktreeId: assignment.managerWorktreeId ?? null,
  });

  return { created: true, ...assignment };
}

/**
 * Archive a job's workspace through the recorded owner, never forcing dirty work.
 */
export async function releaseWorkspace({ manager, registry, jobId, force = false }) {
  const job = registry.getJob(jobId);
  if (!job) {
    return { removed: false, reason: "JOB_NOT_FOUND" };
  }

  const owner = manager ?? (job.worktreeManager === "git" ? new GitWorktreeManager() : null);
  if (!owner) {
    throw new WorktreeCapabilityError(
      `No lifecycle adapter recorded for job ${jobId}; refusing to guess the owner`
    );
  }

  const result = await owner.archive({
    repoRoot: registry.repoRoot,
    worktreePath: job.worktreePath,
    managerWorktreeId: job.managerWorktreeId ?? undefined,
    force,
  });

  if (result.removed) {
    await registry.patchJob(jobId, { worktreePath: null });
  }

  return result;
}

export { WorkspaceBackend };
