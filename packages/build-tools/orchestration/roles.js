#!/usr/bin/env node
/**
 * Role ownership and writer leases.
 *
 * Verification or review that writes files needs an explicit handoff: exactly one
 * writer may hold a worktree, and changing which role writes is a recorded transfer
 * rather than an implicit overlap.
 */

export const Roles = {
  IMPLEMENTER: "implementer",
  VERIFIER: "verifier",
  REVIEWER: "reviewer",
  COORDINATOR: "coordinator",
};

/** Roles whose commands may mutate the worktree. */
export const FILE_WRITING_ROLES = new Set([Roles.IMPLEMENTER, Roles.VERIFIER, Roles.REVIEWER]);

export class RoleError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "RoleError";
    this.code = code;
  }
}

function activeLease(job) {
  if (!job?.writerLease || job.writerLease.releasedAt) return null;
  return job.writerLease;
}

function writeJob(registry, job) {
  registry.atomicWrite(registry.getJobPath(job.id), JSON.stringify(job, null, 2));
}

/**
 * Report every active writer lease on a worktree other than `excludeJobId`.
 */
export function findWorktreeWriters(registry, worktreePath, excludeJobId = null) {
  return registry
    .listJobs()
    .filter((job) => job.id !== excludeJobId)
    .map((job) => ({ jobId: job.id, lease: activeLease(job) }))
    .filter((entry) => entry.lease && entry.lease.worktreePath === worktreePath);
}

/**
 * Acquire the single writer slot for a worktree.
 */
export async function acquireWriterLease({
  registry,
  jobId,
  worktreePath,
  role,
  sessionId,
  allowTakeover = false,
}) {
  if (!FILE_WRITING_ROLES.has(role)) {
    throw new RoleError(`Role '${role}' does not write files`, "ROLE_NOT_WRITING");
  }

  return registry.withLock(async () => {
    const job = registry.getJob(jobId);
    if (!job) throw new RoleError(`Job ${jobId} not found`, "JOB_NOT_FOUND");

    const path = worktreePath || job.worktreePath;
    if (!path) throw new RoleError(`Job ${jobId} has no worktree to write`, "NO_WORKTREE");

    const conflicts = findWorktreeWriters(registry, path, jobId);
    if (conflicts.length > 0) {
      throw new RoleError(
        `Worktree ${path} already has a writer: job ${conflicts[0].jobId} (${conflicts[0].lease.role})`,
        "WRITER_CONFLICT"
      );
    }

    const current = activeLease(job);
    if (current && !allowTakeover) {
      if (current.role !== role || current.sessionId !== sessionId) {
        throw new RoleError(
          `Worktree ${path} is held by ${current.role} (${current.sessionId}); transfer ownership explicitly`,
          "ROLE_HANDOFF_REQUIRED"
        );
      }
      return { ...current, reused: true };
    }

    const now = new Date().toISOString();
    const lease = { role, sessionId, worktreePath: path, acquiredAt: now };
    const updated = {
      ...job,
      writerLease: lease,
      roleHistory: [
        ...(job.roleHistory || []),
        { event: current ? "takeover" : "acquire", role, sessionId, at: now },
      ],
      updatedAt: now,
    };
    writeJob(registry, updated);
    return lease;
  });
}

/**
 * Release a lease only when the caller is its recorded holder.
 */
export async function releaseWriterLease({ registry, jobId, role, sessionId }) {
  return registry.withLock(async () => {
    const job = registry.getJob(jobId);
    if (!job) throw new RoleError(`Job ${jobId} not found`, "JOB_NOT_FOUND");

    const current = activeLease(job);
    if (!current) return { released: false, reason: "NO_LEASE" };
    if (current.role !== role || current.sessionId !== sessionId) {
      throw new RoleError(
        `Lease is held by ${current.role} (${current.sessionId}), not ${role} (${sessionId})`,
        "LEASE_OWNER_MISMATCH"
      );
    }

    const now = new Date().toISOString();
    const updated = {
      ...job,
      writerLease: { ...current, releasedAt: now },
      roleHistory: [...(job.roleHistory || []), { event: "release", role, sessionId, at: now }],
      updatedAt: now,
    };
    writeJob(registry, updated);
    return { released: true, role, at: now };
  });
}

/**
 * Explicitly hand file-writing ownership from one role to another (e.g. implementer
 * pauses so a verifier can write files). The previous role can no longer write until
 * it takes the lease back through another transfer.
 */
export async function transferWriterRole({ registry, jobId, from, to, sessionId, evidence = {} }) {
  if (!FILE_WRITING_ROLES.has(from) || !FILE_WRITING_ROLES.has(to)) {
    throw new RoleError("Only file-writing roles can transfer a writer lease", "ROLE_NOT_WRITING");
  }
  if (from === to) {
    throw new RoleError("Transfer requires a different target role", "SAME_ROLE_TRANSFER");
  }

  return registry.withLock(async () => {
    const job = registry.getJob(jobId);
    if (!job) throw new RoleError(`Job ${jobId} not found`, "JOB_NOT_FOUND");

    const current = activeLease(job);
    if (!current) {
      throw new RoleError(`Job ${jobId} has no writer lease to transfer`, "NO_LEASE");
    }
    if (current.role !== from) {
      throw new RoleError(
        `Job ${jobId} writer is ${current.role}, not ${from}`,
        "ROLE_OWNER_MISMATCH"
      );
    }
    if (sessionId && current.sessionId !== sessionId) {
      throw new RoleError(
        `Lease session ${current.sessionId} does not match ${sessionId}`,
        "LEASE_OWNER_MISMATCH"
      );
    }

    const now = new Date().toISOString();
    const lease = {
      role: to,
      sessionId: current.sessionId,
      worktreePath: current.worktreePath,
      acquiredAt: now,
      transferredFrom: from,
    };
    const updated = {
      ...job,
      writerLease: lease,
      roleHistory: [
        ...(job.roleHistory || []),
        { event: "transfer", from, to, sessionId: current.sessionId, at: now, evidence },
      ],
      updatedAt: now,
    };
    writeJob(registry, updated);
    return { lease, pausedRole: from, evidence };
  });
}

/**
 * Check that a worktree has at most one writer. Used by dispatch and verification.
 */
export function assertWriterExclusive(registry, worktreePath) {
  const writers = findWorktreeWriters(registry, worktreePath);
  return { exclusive: writers.length <= 1, writers };
}

/**
 * Assert that the given role currently owns writing rights before it runs commands or
 * edits (file-writing verification must not start while implementation is in progress).
 */
export function assertRoleCanWrite({ registry, jobId, role, sessionId }) {
  const job = registry.getJob(jobId);
  if (!job) throw new RoleError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
  const current = activeLease(job);
  if (!current) throw new RoleError(`Job ${jobId} has no writer lease`, "NO_LEASE");
  if (current.role !== role) {
    throw new RoleError(
      `Job ${jobId} writer is ${current.role}; ${role} must request an explicit handoff`,
      "ROLE_HANDOFF_REQUIRED"
    );
  }
  if (sessionId && current.sessionId !== sessionId) {
    throw new RoleError(`Lease session does not match ${sessionId}`, "LEASE_OWNER_MISMATCH");
  }
  return { allowed: true, lease: current };
}
