#!/usr/bin/env node
/**
 * Review and CI readiness.
 *
 * Readiness is bound to the exact reviewed head/base. Everything that can move — the
 * head commit, the target base, review state, checks, mergeability and protection
 * support — is checked before any merge decision. Merge mode stays manual unless the
 * policy explicitly opts in.
 */

export class ReviewStateError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ReviewStateError";
    this.code = code;
  }
}

export const MergeMode = { MANUAL: "manual", GUARDED: "guarded" };

export const Blocker = {
  HEAD_CHANGED: "HEAD_CHANGED",
  WRONG_BASE: "WRONG_BASE",
  UNKNOWN_MERGEABILITY: "UNKNOWN_MERGEABILITY",
  MERGE_CONFLICT: "MERGE_CONFLICT",
  AUTHOR_ONLY_APPROVAL: "AUTHOR_ONLY_APPROVAL",
  NON_AUTHOR_REVIEW_REQUIRED: "NON_AUTHOR_REVIEW_REQUIRED",
  STALE_REVIEW: "STALE_REVIEW",
  UNRESOLVED_THREADS: "UNRESOLVED_THREADS",
  CHECKS_FAILED: "CHECKS_FAILED",
  CHECKS_PENDING: "CHECKS_PENDING",
  CHECKS_SKIPPED: "CHECKS_SKIPPED",
  MERGE_QUEUE_UNSUPPORTED: "MERGE_QUEUE_UNSUPPORTED",
  DRAFT_PR: "DRAFT_PR",
  MERGE_NOT_AUTHORIZED: "MERGE_NOT_AUTHORIZED",
};

function normalizeChecks(checks) {
  return (checks || []).map((check) => ({
    name: check.name || check.context,
    status: (check.status || "").toLowerCase(),
    conclusion: (check.conclusion || "").toLowerCase(),
  }));
}

function checkBlockers(checks, requiredChecks) {
  const blockers = [];
  const byName = new Map(normalizeChecks(checks).map((check) => [check.name, check]));

  for (const name of requiredChecks) {
    const check = byName.get(name);
    if (!check) {
      blockers.push({ code: Blocker.CHECKS_PENDING, detail: `${name} has not run` });
      continue;
    }
    if (
      check.conclusion === "failure" ||
      check.conclusion === "timed_out" ||
      check.conclusion === "cancelled"
    ) {
      blockers.push({ code: Blocker.CHECKS_FAILED, detail: name });
    } else if (check.conclusion === "skipped" || check.status === "skipped") {
      blockers.push({ code: Blocker.CHECKS_SKIPPED, detail: name });
    } else if (check.status !== "completed" || check.conclusion === "") {
      blockers.push({ code: Blocker.CHECKS_PENDING, detail: name });
    } else if (check.conclusion !== "success") {
      blockers.push({ code: Blocker.CHECKS_FAILED, detail: `${name}:${check.conclusion}` });
    }
  }

  return blockers;
}

/**
 * Evaluate readiness for one PR against its expected head/base.
 */
export function evaluateReviewState({
  head,
  base = "next",
  pr,
  checks = [],
  reviews = [],
  unresolvedThreads = 0,
  requiredChecks = [],
  requiredQueue = null,
  mergeQueueSupported = false,
  policy = {},
  author,
}) {
  if (!pr) throw new ReviewStateError("pr is required", "MISSING_PR");
  if (!head) throw new ReviewStateError("head is required", "MISSING_HEAD");

  const blockers = [];
  const mergePolicy = policy.jobAuthority?.merge || policy.merge || {};
  const mergeMode = policy.mergeMode || MergeMode.MANUAL;

  if (pr.headSha && pr.headSha !== head) {
    blockers.push({ code: Blocker.HEAD_CHANGED, detail: `${pr.headSha} != ${head}` });
  }
  if (pr.base && pr.base !== base) {
    blockers.push({ code: Blocker.WRONG_BASE, detail: `${pr.base} != ${base}` });
  }

  const mergeable = pr.mergeable;
  if (
    mergeable === null ||
    mergeable === undefined ||
    String(mergeable).toLowerCase() === "unknown"
  ) {
    blockers.push({ code: Blocker.UNKNOWN_MERGEABILITY });
  } else if (mergeable === false || String(mergeable).toLowerCase() === "conflicting") {
    blockers.push({ code: Blocker.MERGE_CONFLICT });
  }

  const approvals = (reviews || []).filter(
    (review) => (review.state || "").toUpperCase() === "APPROVED"
  );
  const nonAuthorApprovals = approvals.filter((review) => review.author !== author);
  const staleApprovals = approvals.filter((review) => review.commitId && review.commitId !== head);

  if (approvals.length > 0 && nonAuthorApprovals.length === 0) {
    blockers.push({ code: Blocker.AUTHOR_ONLY_APPROVAL });
  }
  if (
    mergePolicy.requiresNonAuthorReview &&
    nonAuthorApprovals.length === 0 &&
    approvals.length === 0
  ) {
    blockers.push({ code: Blocker.NON_AUTHOR_REVIEW_REQUIRED });
  }
  for (const approval of staleApprovals) {
    blockers.push({ code: Blocker.STALE_REVIEW, detail: approval.author || "unknown" });
  }

  if (unresolvedThreads > 0) {
    blockers.push({ code: Blocker.UNRESOLVED_THREADS, detail: unresolvedThreads });
  }

  blockers.push(...checkBlockers(checks, requiredChecks));

  if (requiredQueue && !mergeQueueSupported) {
    blockers.push({ code: Blocker.MERGE_QUEUE_UNSUPPORTED, detail: requiredQueue });
  }

  if (pr.draft === true) {
    blockers.push({ code: Blocker.DRAFT_PR });
  }

  const hardBlockers = blockers;

  let decision;
  if (hardBlockers.length > 0) {
    decision = "blocked";
  } else if (mergeMode === MergeMode.MANUAL) {
    decision = "ready-for-manual-merge";
  } else {
    const optedIn = mergePolicy.requiresOwnerOptIn === true && mergePolicy.ownerOptIn === true;
    decision = optedIn ? "ready-for-guarded-merge" : "blocked";
    if (!optedIn) blockers.push({ code: Blocker.MERGE_NOT_AUTHORIZED });
  }

  return {
    decision,
    mergeMode,
    automatedMerge: false,
    mergePerformed: false,
    head,
    base,
    blockers,
    approvals: approvals.length,
    nonAuthorApprovals: nonAuthorApprovals.length,
  };
}

/**
 * Guarded merge is disabled unless the policy opts in explicitly, targets next and every
 * gate is satisfied. Even then this function only reports readiness; it never merges.
 */
export function evaluateGuardedMerge({ mergeMode, ...rest }) {
  if (mergeMode !== MergeMode.GUARDED) {
    return {
      allowed: false,
      reason: "GUARDED_MERGE_DISABLED",
      note: "Merge mode is manual; merging requires an explicit owner decision",
    };
  }
  const state = evaluateReviewState(rest);
  return {
    allowed: state.decision === "ready-for-guarded-merge",
    reason: state.decision,
    state,
    note: "Readiness only — no merge is performed by the coordinator",
  };
}
