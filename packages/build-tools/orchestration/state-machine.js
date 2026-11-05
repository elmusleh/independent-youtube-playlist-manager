#!/usr/bin/env node
/**
 * State Machine for Job Transitions
 *
 * Defines valid states, transitions, and guards for job lifecycle.
 */

export const JobState = {
  QUEUED: "queued",
  DISPATCH_PENDING: "dispatch-pending",
  IMPLEMENTING: "implementing",
  VERIFICATION_PENDING: "verification-pending",
  VERIFYING: "verifying",
  REVIEW_PENDING: "review-pending",
  REVIEWING: "reviewing",
  SYNC_REQUIRED: "sync-required",
  SYNCING: "syncing",
  PUBLICATION_PENDING: "publication-pending",
  PR_OPEN: "pr-open",
  CI_PENDING: "ci-pending",
  MERGE_READY: "merge-ready",
  MERGED: "merged",
  BLOCKED: "blocked",
  CANCELLED: "cancelled",
};

/**
 * Valid state transitions: fromState -> allowed toStates
 * Based on the design.md lifecycle diagram
 */
export const VALID_TRANSITIONS = {
  [JobState.QUEUED]: [JobState.DISPATCH_PENDING, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.DISPATCH_PENDING]: [JobState.IMPLEMENTING, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.IMPLEMENTING]: [JobState.VERIFICATION_PENDING, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.VERIFICATION_PENDING]: [JobState.VERIFYING, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.VERIFYING]: [
    JobState.REVIEW_PENDING,
    JobState.SYNC_REQUIRED,
    JobState.BLOCKED,
    JobState.CANCELLED,
  ],
  [JobState.REVIEW_PENDING]: [JobState.REVIEWING, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.REVIEWING]: [
    JobState.SYNC_REQUIRED,
    JobState.PUBLICATION_PENDING,
    JobState.BLOCKED,
    JobState.CANCELLED,
  ],
  [JobState.SYNC_REQUIRED]: [JobState.SYNCING, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.SYNCING]: [JobState.PUBLICATION_PENDING, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.PUBLICATION_PENDING]: [JobState.PR_OPEN, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.PR_OPEN]: [JobState.CI_PENDING, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.CI_PENDING]: [JobState.MERGE_READY, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.MERGE_READY]: [JobState.MERGED, JobState.BLOCKED, JobState.CANCELLED],
  [JobState.MERGED]: [], // Terminal state
  [JobState.BLOCKED]: [JobState.QUEUED, JobState.DISPATCH_PENDING, JobState.CANCELLED], // Can be unblocked
  [JobState.CANCELLED]: [], // Terminal state
};

/**
 * Terminal states - no outgoing transitions
 */
export const TERMINAL_STATES = new Set([JobState.MERGED, JobState.CANCELLED]);

/**
 * Active implementation states (count toward maxActive limit)
 */
export const ACTIVE_STATES = new Set([
  JobState.DISPATCH_PENDING,
  JobState.IMPLEMENTING,
  JobState.VERIFICATION_PENDING,
  JobState.VERIFYING,
  JobState.REVIEW_PENDING,
  JobState.REVIEWING,
  JobState.SYNC_REQUIRED,
  JobState.SYNCING,
  JobState.PUBLICATION_PENDING,
  JobState.PR_OPEN,
  JobState.CI_PENDING,
  JobState.MERGE_READY,
]);

/**
 * States that require ownership
 */
export const OWNERSHIP_REQUIRED_STATES = new Set([
  JobState.IMPLEMENTING,
  JobState.VERIFICATION_PENDING,
  JobState.VERIFYING,
  JobState.REVIEW_PENDING,
  JobState.REVIEWING,
  JobState.SYNC_REQUIRED,
  JobState.SYNCING,
  JobState.PUBLICATION_PENDING,
  JobState.PR_OPEN,
  JobState.CI_PENDING,
  JobState.MERGE_READY,
]);

/**
 * Validate a state transition
 * @returns {object} { valid: boolean, reason?: string }
 */
export function validateTransition(fromState, toState, context = {}) {
  // Same state is always valid (idempotent)
  if (fromState === toState) {
    return { valid: true };
  }

  // Check if fromState is terminal
  if (TERMINAL_STATES.has(fromState)) {
    return { valid: false, reason: `Cannot transition from terminal state: ${fromState}` };
  }

  // Check if transition is allowed
  const allowed = VALID_TRANSITIONS[fromState];
  if (!allowed || !allowed.includes(toState)) {
    return { valid: false, reason: `Invalid transition: ${fromState} -> ${toState}` };
  }

  // Additional guards based on context
  if (toState === JobState.IMPLEMENTING && !context.hasOwnership) {
    return { valid: false, reason: "IMPLEMENTING requires ownership claim" };
  }

  if (toState === JobState.VERIFYING && !context.verifierAssigned) {
    return { valid: false, reason: "VERIFYING requires verifier assignment" };
  }

  if (toState === JobState.REVIEWING && !context.reviewerAssigned) {
    return { valid: false, reason: "REVIEWING requires reviewer assignment" };
  }

  if (toState === JobState.PR_OPEN && !context.branchPushed) {
    return { valid: false, reason: "PR_OPEN requires branch pushed to remote" };
  }

  if (toState === JobState.MERGE_READY && !context.ciPassed) {
    return { valid: false, reason: "MERGE_READY requires CI to pass" };
  }

  if (toState === JobState.MERGED && !context.mergeAuthority) {
    return { valid: false, reason: "MERGED requires merge authority" };
  }

  return { valid: true };
}

/**
 * Get all valid next states from a given state
 */
export function getValidNextStates(fromState) {
  return VALID_TRANSITIONS[fromState] || [];
}

/**
 * Check if a state is active (counts toward maxActive)
 */
export function isActiveState(state) {
  return ACTIVE_STATES.has(state);
}

/**
 * Check if a state is terminal
 */
export function isTerminalState(state) {
  return TERMINAL_STATES.has(state);
}

/**
 * Check if a state requires ownership
 */
export function requiresOwnership(state) {
  return OWNERSHIP_REQUIRED_STATES.has(state);
}

/**
 * Get state description for documentation
 */
export const STATE_DESCRIPTIONS = {
  [JobState.QUEUED]: "Job created, waiting for dispatch slot",
  [JobState.DISPATCH_PENDING]: "Dispatch initiated, waiting for agent to claim",
  [JobState.IMPLEMENTING]: "Agent actively implementing the change",
  [JobState.VERIFICATION_PENDING]: "Implementation complete, awaiting verification",
  [JobState.VERIFYING]: "Verifier running tests and checks",
  [JobState.REVIEW_PENDING]: "Verification complete, awaiting review",
  [JobState.REVIEWING]: "Reviewer inspecting changes",
  [JobState.SYNC_REQUIRED]: "Target branch advanced, sync needed",
  [JobState.SYNCING]: "Integrating latest target into feature branch",
  [JobState.PUBLICATION_PENDING]: "Ready to push branch and create PR",
  [JobState.PR_OPEN]: "PR created, awaiting CI",
  [JobState.CI_PENDING]: "CI running on PR",
  [JobState.MERGE_READY]: "All checks passed, ready for merge",
  [JobState.MERGED]: "Successfully merged into target",
  [JobState.BLOCKED]: "Blocked by dependency, conflict, or external factor",
  [JobState.CANCELLED]: "Job cancelled, work preserved",
};
