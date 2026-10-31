#!/usr/bin/env node
/**
 * Cancellation and cleanup.
 *
 * Cancelling stops future dispatch/publication steps but never discards existing work or
 * undoes a committed remote effect. Cleanup requires owner authority, refuses dirty
 * trees, protected branches and unsafe branch deletion, and records what it retained.
 */

import { isProtectedBranch } from "./workspace.js";
import { getDirty } from "./sync.js";
import { releaseWorkspace, GitWorktreeManager } from "./lifecycle.js";

export class CancellationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "CancellationError";
    this.code = code;
  }
}

export const CleanupResult = {
  REMOVED: "removed",
  RETAINED: "retained",
  REFUSED: "refused",
};

/**
 * Request cancellation. Work is preserved; the job records the intent and stops future
 * steps. An in-flight remote operation is never cancelled mid-write.
 */
export async function requestCancellation({ registry, jobId, reason, by = "owner" }) {
  const job = registry.getJob(jobId);
  if (!job) throw new CancellationError(`Job ${jobId} not found`, "JOB_NOT_FOUND");

  const now = new Date().toISOString();
  const inFlight = ["syncing", "publication-pending", "pr-open", "ci-pending"].includes(job.state);

  const record = {
    requestedAt: now,
    reason: reason || "cancelled by owner",
    by,
    stateAtRequest: job.state,
    inFlight,
  };

  let updated;
  try {
    updated = await registry.transitionJob(jobId, "cancelled", {
      updates: { cancellation: record, cancelRequested: true, cancelRequestedAt: now },
      evidence: { reason: record.reason, by },
      actor: by,
    });
  } catch {
    // A state that cannot transition now still records the intent; the coordinator stops
    // future steps on the flag rather than forcing an invalid transition.
    await registry.patchJob(jobId, {
      cancellation: record,
      cancelRequested: true,
      cancelRequestedAt: now,
    });
    updated = registry.getJob(jobId);
  }

  return {
    cancelled: true,
    state: updated.state,
    inFlight,
    note: inFlight
      ? "In-flight remote operation not interrupted; it is reconciled before any retry"
      : "No in-flight operation; future steps are stopped",
    workPreserved: Boolean(updated.worktreePath),
    record,
  };
}

/**
 * Cancellation/status snapshot for one job.
 */
export function cancellationStatus({ registry, jobId }) {
  const job = registry.getJob(jobId);
  if (!job) throw new CancellationError(`Job ${jobId} not found`, "JOB_NOT_FOUND");

  return {
    jobId,
    state: job.state,
    cancelRequested: job.cancelRequested === true,
    cancelRequestedAt: job.cancelRequestedAt || null,
    cancellation: job.cancellation || null,
    worktreePath: job.worktreePath || null,
    workRetained: Boolean(job.worktreePath),
    evidenceReceipts: job.evidenceReceipts || [],
    cleanupReceipts: job.cleanupReceipts || [],
  };
}

/**
 * Check whether a branch may be deleted. Protected branches and branches whose commits
 * are not provably contained in the target are refused.
 */
export function evaluateBranchDeletion({
  branch,
  target = "next",
  mergedInto = [],
  squashMerged = false,
}) {
  if (!branch) return { allowed: false, reason: "MISSING_BRANCH" };
  if (isProtectedBranch(branch)) return { allowed: false, reason: "PROTECTED_BRANCH" };
  if (mergedInto.includes(target)) return { allowed: true, reason: "MERGED" };
  if (squashMerged) {
    return { allowed: false, reason: "SQUASH_SAFE_DELETE_REFUSED" };
  }
  return { allowed: false, reason: "NOT_MERGED" };
}

/**
 * Authorized cleanup with retained receipts.
 *
 * `authorization` must come from an owner action (`policy.jobAuthority.cleanup`).
 */
export async function cleanupJob({
  registry,
  policy,
  jobId,
  authorization,
  manager = null,
  branchDeletion = null,
  keepBranch = true,
  force = false,
}) {
  const job = registry.getJob(jobId);
  if (!job) throw new CancellationError(`Job ${jobId} not found`, "JOB_NOT_FOUND");

  const cleanupPolicy = policy?.jobAuthority?.cleanup || {};
  if (cleanupPolicy.requiresOwnerAuthority && authorization?.authorized !== true) {
    return {
      status: CleanupResult.REFUSED,
      reason: "CLEANUP_NOT_AUTHORIZED",
      retainedPath: job.worktreePath || null,
    };
  }

  const receipts = [];

  if (job.worktreePath) {
    const dirty = getDirty(job.worktreePath);
    if (dirty.dirty) {
      const receipt = {
        at: new Date().toISOString(),
        action: "retained",
        path: job.worktreePath,
        reason: "DIRTY_WORKTREE",
        files: dirty.files,
      };
      await registry.patchJob(jobId, {
        cleanupReceipts: [...(job.cleanupReceipts || []), receipt],
      });
      return {
        status: CleanupResult.RETAINED,
        reason: "DIRTY_WORKTREE",
        files: dirty.files,
        retainedPath: job.worktreePath,
        receipt,
      };
    }

    const owner = manager || (job.worktreeManager === "git" ? new GitWorktreeManager() : null);
    if (!owner) {
      return {
        status: CleanupResult.RETAINED,
        reason: "NO_LIFECYCLE_ADAPTER",
        retainedPath: job.worktreePath,
      };
    }

    const removal = await releaseWorkspace({ manager: owner, registry, jobId, force });
    receipts.push({
      at: new Date().toISOString(),
      action: removal.removed ? "worktree-removed" : "worktree-retained",
      path: job.worktreePath,
      owner: removal.owner || job.worktreeManager,
      reason: removal.reason || null,
    });

    if (!removal.removed) {
      const receipt = receipts[0];
      await registry.patchJob(jobId, {
        cleanupReceipts: [...(job.cleanupReceipts || []), receipt],
      });
      return {
        status: CleanupResult.RETAINED,
        reason: removal.reason || "REMOVAL_REFUSED",
        retainedPath: job.worktreePath,
        receipt,
      };
    }
  }

  if (branchDeletion && keepBranch === false) {
    const decision = evaluateBranchDeletion(branchDeletion);
    receipts.push({
      at: new Date().toISOString(),
      action: decision.allowed ? "branch-deletion-authorized" : "branch-retained",
      branch: branchDeletion.branch,
      reason: decision.reason,
    });
    if (!decision.allowed) {
      await registry.patchJob(jobId, {
        cleanupReceipts: [...(job.cleanupReceipts || []), ...receipts],
      });
      return {
        status: CleanupResult.RETAINED,
        reason: decision.reason,
        branch: branchDeletion.branch,
        worktreeRemoved: true,
        receipts,
      };
    }
  }

  await registry.patchJob(jobId, {
    cleanupReceipts: [...(job.cleanupReceipts || []), ...receipts],
  });

  return {
    status: CleanupResult.REMOVED,
    worktreeRemoved: Boolean(job.worktreePath),
    branchRetained: true,
    receipts: [...(job.cleanupReceipts || []), ...receipts],
    evidencePreserved: (job.evidenceReceipts || []).length,
  };
}
