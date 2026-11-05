#!/usr/bin/env node
/**
 * Single-slot integration.
 *
 * Only one integration operates at a time. Before merging, the target and PR head are
 * re-read from the remote; anything that moved aborts instead of forcing through. After a
 * successful merge the new target invalidates other jobs' evidence so they must recheck.
 */

import fs from "fs";
import { reviewIsReady, protectionsAreEffective } from "./merge.js";
import { join } from "path";

export class IntegrationError extends Error {
  constructor(message, code, detail = {}) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.detail = detail;
  }
}

export const IntegrationResult = {
  MERGED: "merged",
  REFUSED: "refused",
  BUSY: "busy",
  RECHECK_REQUIRED: "recheck-required",
  FAILED: "failed",
};

function integrationLockPath(registry) {
  return join(registry.registryDir, ".integration.lock");
}

function acquireIntegrationSlot(registry) {
  const lockPath = integrationLockPath(registry);
  try {
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), {
      flag: "wx",
      mode: 0o600,
    });
    return { acquired: true, lockPath };
  } catch (error) {
    if (error.code === "EEXIST") return { acquired: false, lockPath };
    throw error;
  }
}

function releaseIntegrationSlot(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* already released */
  }
}

/**
 * Invalidate other jobs whose evidence predates the new target commit.
 */
export async function invalidateOtherJobs({ registry, mergedJobId, targetSha, invalidate = null }) {
  const others = registry.listJobs().filter((job) => job.id !== mergedJobId);
  const invalidated = [];

  for (const job of others) {
    const record = {
      jobId: job.id,
      targetSha,
      reason: "target-advanced",
      at: new Date().toISOString(),
    };
    if (invalidate) {
      await invalidate({ job, targetSha });
    }
    await registry.patchJob(job.id, {
      evidenceInvalidations: [...(job.evidenceInvalidations || []), record],
      requiresRecheck: true,
    });
    invalidated.push(record);
  }

  return invalidated;
}

/**
 * One guarded integration, with last-moment remote rechecks.
 *
 * `remoteState()` must return `{ targetSha, prHeads: { [number]: sha } }` read fresh from
 * the remote at call time.
 */
export async function integrateOnce({
  registry,
  jobId,
  pr,
  expectedHead,
  expectedTargetSha,
  service,
  remoteState,
  authority,
  evidenceState,
  reviewState,
  invalidate = null,
}) {
  const slot = acquireIntegrationSlot(registry);
  if (!slot.acquired) {
    return {
      status: IntegrationResult.BUSY,
      merged: false,
      reason: "another integration operation holds the slot",
    };
  }

  try {
    if (!authority?.allowed) {
      return {
        status: IntegrationResult.REFUSED,
        merged: false,
        blockers: authority?.blockers || [{ code: "MERGE_NOT_AUTHORIZED" }],
      };
    }

    const before = await remoteState();
    if (!before || before.targetSha !== expectedTargetSha) {
      return {
        status: IntegrationResult.RECHECK_REQUIRED,
        merged: false,
        reason: "target moved before integration",
        expectedTargetSha,
        actualTargetSha: before?.targetSha ?? null,
      };
    }
    const remotePrHead = before.prHeads?.[pr.number];
    if (!remotePrHead || remotePrHead !== expectedHead) {
      return {
        status: IntegrationResult.RECHECK_REQUIRED,
        merged: false,
        reason: "PR head moved before integration",
        expectedHead,
        actualHead: remotePrHead,
      };
    }

    if (evidenceState?.status !== "valid") {
      return {
        status: IntegrationResult.REFUSED,
        merged: false,
        blockers: [{ code: "STALE_EVIDENCE", detail: evidenceState?.problems || [] }],
      };
    }
    if (!reviewIsReady(reviewState, expectedHead)) {
      return {
        status: IntegrationResult.REFUSED,
        merged: false,
        blockers: reviewState.blockers || [{ code: "REVIEW_NOT_READY" }],
      };
    }

    if (
      !reviewIsReady(before.reviewState, expectedHead) ||
      !protectionsAreEffective(before.protections)
    ) {
      return {
        status: IntegrationResult.REFUSED,
        merged: false,
        blockers: [{ code: "REMOTE_READINESS_UNKNOWN_OR_CHANGED" }],
      };
    }

    let response;
    try {
      response = await service.squashMerge({
        repository: pr.repository,
        number: pr.number,
        expectedHead,
        expectedBaseSha: expectedTargetSha,
      });
    } catch (error) {
      return {
        status: IntegrationResult.FAILED,
        merged: false,
        reason: error.message,
      };
    }

    if (!response || response.merged !== true) {
      return {
        status: IntegrationResult.FAILED,
        merged: false,
        reason: response?.message || "merge not confirmed",
      };
    }

    const invalidated = await invalidateOtherJobs({
      registry,
      mergedJobId: jobId,
      targetSha: response.sha || null,
      invalidate,
    });

    return {
      status: IntegrationResult.MERGED,
      merged: true,
      method: "squash",
      head: expectedHead,
      targetSha: response.sha || null,
      invalidatedJobs: invalidated.map((entry) => entry.jobId),
    };
  } finally {
    releaseIntegrationSlot(slot.lockPath);
  }
}
