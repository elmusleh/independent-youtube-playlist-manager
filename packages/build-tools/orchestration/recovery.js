import { detectCorruption } from "./recovery-journal.js";
import {
  reconcilePush,
  reconcilePrCreate,
  reconcilePrUpdate,
  reconcileMergeRequest,
} from "./recovery-remote.js";
import { runRecoveryCLI } from "./recovery-cli.js";
// Recovery entry point
/**
 * Recovery Manager - Journal-based resume and lease reassignment
 *
 * Handles interruption recovery, corruption detection, live owner reassignment,
 * and cancellation without force cleanup.
 */

import { OrchestrationRegistry } from "./registry.js";
import { requiresOwnership } from "./state-machine.js";

export class RecoveryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "RecoveryError";
    this.code = code;
  }
}

export class RecoveryManager {
  constructor(repoRoot, policy) {
    this.registry = new OrchestrationRegistry(repoRoot, policy);
  }

  /**
   * Resume from journal - replay operations and restore state
   */
  async resumeFromJournal() {
    const jobs = this.registry.listJobs();
    const recovered = [];

    for (const job of jobs) {
      const recovery = await this.recoverJob(job.id);
      if (recovery.recovered) {
        recovered.push({ jobId: job.id, ...recovery });
      }
    }

    return recovered;
  }

  /**
   * Recover a single job from its journal
   * @param {string} jobId
   * @param {object} options - { skipEarlyReturn: boolean } for corruption detection
   */
  async recoverJob(jobId, options = {}) {
    const job = this.registry.getJob(jobId);
    if (!job) {
      return { recovered: false, reason: "Job not found" };
    }

    const journal = this.registry.getJournal(jobId);

    // Skip early return for corruption detection
    if (!options.skipEarlyReturn && journal.length <= 1) {
      return { recovered: false, reason: "No journal entries to replay" };
    }

    // Check for uncertain operations that need reconciliation
    const uncertainOps = this.registry
      .reconcileUncertainOperations()
      .filter((u) => u.jobId === jobId);

    const results = {
      recovered: true,
      jobId,
      previousState: job.state,
      uncertainOperations: uncertainOps.length,
      reconciled: [],
      requiresManualIntervention: false,
    };

    // If job was in an active state but owner appears dead, we can reassign
    if (requiresOwnership(job.state) && job.owner) {
      const isAlive = this.registry.isOwnerAlive(job.owner);
      if (!isAlive) {
        // Job needs lease reassignment - mark for manual intervention
        results.requiresManualIntervention = true;
        results.reason = `Owner ${job.owner.sessionId} appears dead, lease reassignment needed`;
      }
    }

    // Check for corrupted journal entries
    const corrupted = this.detectCorruption(jobId);
    if (corrupted.length > 0) {
      results.requiresManualIntervention = true;
      results.corruptedEntries = corrupted;
    }

    return results;
  }

  /**
   * Detect corruption in journal (missing fields, invalid transitions, etc.)
   */
  detectCorruption(jobId) {
    return detectCorruption(this, jobId);
  }

  /**
   * Reconcile uncertain operations by checking actual remote state
   */
  async reconcileUncertainOperations() {
    const uncertain = this.registry.reconcileUncertainOperations();
    const results = [];

    for (const { jobId, receipt } of uncertain) {
      const job = this.registry.getJob(jobId);
      if (!job) continue;

      let reconciliation;

      switch (receipt.type) {
        case "push":
          reconciliation = await this.reconcilePush(job, receipt);
          break;
        case "pr-create":
          reconciliation = await this.reconcilePrCreate(job, receipt);
          break;
        case "pr-update":
          reconciliation = await this.reconcilePrUpdate(job, receipt);
          break;
        case "merge-request":
          reconciliation = await this.reconcileMergeRequest(job, receipt);
          break;
        default:
          reconciliation = { status: "unknown", action: "manual-review" };
      }

      results.push({ jobId, receiptId: receipt.id, ...reconciliation });
    }

    return results;
  }

  /**
   * Check if push actually succeeded by checking remote branch
   */
  async reconcilePush(job, _receipt) {
    return reconcilePush(this, job, _receipt);
  }

  /**
   * Check if PR was actually created
   */
  async reconcilePrCreate(job, _receipt) {
    return reconcilePrCreate(this, job, _receipt);
  }

  /**
   * Reconcile PR update
   */
  async reconcilePrUpdate(job, _receipt) {
    return reconcilePrUpdate(this, job, _receipt);
  }

  /**
   * Reconcile merge request
   */
  async reconcileMergeRequest(job, _receipt) {
    return reconcileMergeRequest(this, job, _receipt);
  }

  /**
   * Deliberate lease reassignment - transfer ownership with evidence
   */
  async reassignLease(jobId, newSessionId, newPid, newLivenessRef, reason, authorizedBy) {
    const job = this.registry.getJob(jobId);
    if (!job) {
      throw new RecoveryError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
    }

    if (!job.owner) {
      throw new RecoveryError(`Job ${jobId} has no owner to reassign`, "NO_OWNER");
    }

    const oldOwner = job.owner;

    // Verify the old owner is actually dead or authorization provided
    const isAlive = this.registry.isOwnerAlive(oldOwner);
    if (isAlive && !authorizedBy) {
      throw new RecoveryError(
        `Owner ${oldOwner.sessionId} is still alive. Reassignment requires explicit authorization.`,
        "OWNER_ALIVE"
      );
    }

    // Record reassignment in journal
    const now = new Date().toISOString();
    const jobPath = this.registry.getJobPath(jobId);

    const updatedJob = {
      ...job,
      owner: {
        sessionId: newSessionId,
        pid: newPid,
        startedAt: now,
        lastHeartbeat: now,
        livenessRef: newLivenessRef,
      },
      state: "implementing",
      updatedAt: now,
    };

    this.registry.atomicWrite(jobPath, JSON.stringify(updatedJob, null, 2));

    this.registry.appendJournal({
      id: `journal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId,
      fromState: job.state,
      toState: "implementing",
      actor: newSessionId,
      timestamp: now,
      evidence: {
        action: "lease-reassignment",
        reason,
        previousOwner: oldOwner,
        authorizedBy,
      },
      previousOwner: oldOwner,
    });

    return updatedJob;
  }

  /**
   * Cancel a job - stop future steps, preserve work
   */
  async cancelJob(jobId, sessionId, reason) {
    const job = this.registry.getJob(jobId);
    if (!job) {
      throw new RecoveryError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
    }

    // Verify ownership or authorization
    if (job.owner && job.owner.sessionId !== sessionId) {
      const isAlive = this.registry.isOwnerAlive(job.owner);
      if (isAlive) {
        throw new RecoveryError(
          `Job ${jobId} owned by active session ${job.owner.sessionId}`,
          "OWNERSHIP_CONFLICT"
        );
      }
    }

    const now = new Date().toISOString();
    const jobPath = this.registry.getJobPath(jobId);

    const updatedJob = {
      ...job,
      state: "cancelled",
      updatedAt: now,
    };

    this.registry.atomicWrite(jobPath, JSON.stringify(updatedJob, null, 2));

    this.registry.appendJournal({
      id: `journal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId,
      fromState: job.state,
      toState: "cancelled",
      actor: sessionId,
      timestamp: now,
      evidence: { action: "cancellation", reason },
      previousOwner: job.owner,
    });

    return updatedJob;
  }

  /**
   * Get recovery status for all jobs
   */
  getRecoveryStatus() {
    const jobs = this.registry.listJobs();
    const status = [];

    for (const job of jobs) {
      const uncertainOps = this.registry
        .reconcileUncertainOperations()
        .filter((u) => u.jobId === job.id);

      let needsAttention = false;
      const attentionReasons = [];

      // Check for dead owner on active job
      if (requiresOwnership(job.state) && job.owner) {
        if (!this.registry.isOwnerAlive(job.owner)) {
          needsAttention = true;
          attentionReasons.push("dead-owner");
        }
      }

      // Check for uncertain operations
      if (uncertainOps.length > 0) {
        needsAttention = true;
        attentionReasons.push("uncertain-operations");
      }

      // Check for blocked state
      if (job.state === "blocked") {
        needsAttention = true;
        attentionReasons.push("blocked");
      }

      status.push({
        jobId: job.id,
        changeName: job.changeName,
        state: job.state,
        owner: job.owner ? job.owner.sessionId : null,
        needsAttention,
        attentionReasons,
        uncertainOperations: uncertainOps.length,
      });
    }

    return status;
  }
}

if (import.meta.url === `file://${process.argv[1]}`)
  runRecoveryCLI(new RecoveryManager(process.argv[3] || process.cwd(), { maxActive: 2 }));
