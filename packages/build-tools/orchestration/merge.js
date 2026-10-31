#!/usr/bin/env node
/**
 * Optional guarded squash merge.
 *
 * Disabled by default. Merging requires a policy-level guarded mode, an explicit
 * per-job owner opt-in, a `next` target, current evidence, a clean review state,
 * passing CI and effective server protections. The merge is a single call with an
 * expected head; failures are reported as failures, never as merged.
 */

export class MergeError extends Error {
  constructor(message, code, detail = {}) {
    super(message);
    this.name = "MergeError";
    this.code = code;
    this.detail = detail;
  }
}

export function reviewIsReady(state, expectedHead) {
  return (
    state?.decision === "ready-for-guarded-merge" &&
    Array.isArray(state.blockers) &&
    state.blockers.length === 0 &&
    (!expectedHead || state.head === expectedHead)
  );
}
export function protectionsAreEffective(protections) {
  return (
    Array.isArray(protections?.requiredChecks) &&
    protections.requiredChecks.length > 0 &&
    protections.requiredChecks.every((name) => typeof name === "string" && name.length > 0) &&
    Number.isInteger(protections.requiredApprovals) &&
    protections.requiredApprovals > 0 &&
    protections.allowsAdminBypass === false &&
    protections.requiresUpToDate === true
  );
}

export function evaluateMergeAuthority({
  policy,
  job,
  target,
  evidenceState,
  reviewState,
  protections,
}) {
  const blockers = [];
  const mergePolicy = policy?.jobAuthority?.merge || {};

  if (policy?.mergeMode !== "guarded") {
    blockers.push({
      code: "GUARDED_MERGE_DISABLED",
      detail: "mergeMode is manual; enabling guarded merge is an explicit owner decision",
    });
  }
  if (job?.mergeOptIn !== true) {
    blockers.push({ code: "MERGE_NOT_AUTHORIZED", detail: "job has no recorded owner opt-in" });
  }
  if (mergePolicy.requiresOwnerOptIn === false) {
    blockers.push({ code: "MERGE_NOT_AUTHORIZED", detail: "policy does not require owner opt-in" });
  }

  const resolvedTarget = target ?? job?.target;
  if (resolvedTarget !== "next") {
    blockers.push({ code: "PROTECTED_TARGET", detail: resolvedTarget || "(missing)" });
  }

  if (!evidenceState || evidenceState.status !== "valid") {
    blockers.push({
      code: "STALE_EVIDENCE",
      detail: evidenceState?.problems?.map((problem) => problem.code) || ["missing"],
    });
  }

  if (!reviewIsReady(reviewState, job?.headSha)) {
    blockers.push({
      code: "REVIEW_NOT_READY",
      detail: reviewState?.blockers?.map((blocker) => blocker.code) || ["missing"],
    });
  }

  if (!protectionsAreEffective(protections))
    blockers.push({
      code: "INEFFECTIVE_PROTECTIONS",
      detail: "Missing or ineffective protection data",
    });

  return { allowed: blockers.length === 0, blockers };
}

/**
 * Squash-merge through an injected service adapter. One call, expected head pinned.
 */
export async function performGuardedSquashMerge({
  service,
  repository,
  number,
  expectedHead,
  authority,
  commitTitle,
}) {
  if (!authority?.allowed) {
    return {
      merged: false,
      status: "refused",
      blockers: authority?.blockers || [{ code: "GUARDED_MERGE_DISABLED" }],
      serviceCalls: 0,
    };
  }
  if (!service || typeof service.squashMerge !== "function") {
    throw new MergeError("Merge service adapter is required", "MISSING_SERVICE");
  }

  let response;
  try {
    response = await service.squashMerge({
      repository,
      number,
      expectedHead,
      commitTitle,
    });
  } catch (error) {
    return {
      merged: false,
      status: "failed",
      reason: error.message,
      serviceCalls: 1,
    };
  }

  if (!response || response.merged !== true) {
    return {
      merged: false,
      status: "failed",
      reason: response?.message || "merge not confirmed by service",
      serviceCalls: 1,
    };
  }

  return {
    merged: true,
    status: "merged",
    method: "squash",
    head: expectedHead,
    mergeCommit: response.sha || null,
    serviceCalls: 1,
  };
}
