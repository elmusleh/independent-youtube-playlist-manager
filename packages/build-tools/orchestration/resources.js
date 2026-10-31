#!/usr/bin/env node
/**
 * Port, profile and shared-install allocation.
 *
 * Two independent jobs may run side by side, so their ports, disposable profiles and
 * package/browser-cache installs must not collide. Allocation is recorded on the job
 * and shared installs are serialized by a lock file so two jobs never write the same
 * dependency tree at once.
 */

import fs from "fs";
import { join } from "path";

export class ResourceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ResourceError";
    this.code = code;
  }
}

export const DEFAULT_PORT_RANGE = { start: 4100, end: 4199 };
export const DEFAULT_PROFILES = ["hermes-a", "hermes-b", "hermes-c", "hermes-d"];

function usedFrom(jobs, key) {
  const used = new Set();
  for (const job of jobs) {
    const value = job.resources?.[key];
    if (value === undefined || value === null) continue;
    for (const entry of Array.isArray(value) ? value : [value]) used.add(entry);
  }
  return used;
}

/**
 * Allocate one port, one named profile and any requested shared installs for a job.
 */
export async function allocateJobResources({
  registry,
  jobId,
  portRange = DEFAULT_PORT_RANGE,
  profiles = DEFAULT_PROFILES,
  sharedInstalls = [],
}) {
  return registry.withLock(async () => {
    const jobs = registry.listJobs();
    const job = jobs.find((entry) => entry.id === jobId);
    if (!job) throw new ResourceError(`Job ${jobId} not found`, "JOB_NOT_FOUND");

    if (job.resources?.ports?.length && job.resources?.profile) {
      return { ...job.resources, reused: true };
    }

    const usedPorts = usedFrom(jobs, "ports");
    const port = [];
    for (let candidate = portRange.start; candidate <= portRange.end; candidate += 1) {
      if (!usedPorts.has(candidate)) {
        port.push(candidate);
        break;
      }
    }
    if (port.length === 0) {
      throw new ResourceError(
        `No free port in range ${portRange.start}-${portRange.end}`,
        "RESOURCE_EXHAUSTED"
      );
    }

    const usedProfiles = usedFrom(jobs, "profile");
    const profile = profiles.find((candidate) => !usedProfiles.has(candidate));
    if (!profile) {
      throw new ResourceError("No disposable profile is free", "RESOURCE_EXHAUSTED");
    }

    const resources = { ports: port, profile, sharedInstalls: [...sharedInstalls] };
    const now = new Date().toISOString();
    registry.atomicWrite(
      registry.getJobPath(jobId),
      JSON.stringify(
        {
          ...job,
          resources,
          resourceHistory: [
            ...(job.resourceHistory || []),
            { event: "allocate", ...resources, at: now },
          ],
          updatedAt: now,
        },
        null,
        2
      )
    );
    return resources;
  });
}

/**
 * Release a job's ports/profile/installs so another job can take them.
 */
export async function releaseJobResources({ registry, jobId }) {
  return registry.withLock(async () => {
    const job = registry.getJob(jobId);
    if (!job) throw new ResourceError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
    if (!job.resources) return { released: false, reason: "NO_RESOURCES" };

    const now = new Date().toISOString();
    registry.atomicWrite(
      registry.getJobPath(jobId),
      JSON.stringify(
        {
          ...job,
          resources: null,
          resourceHistory: [
            ...(job.resourceHistory || []),
            { event: "release", previous: job.resources, at: now },
          ],
          updatedAt: now,
        },
        null,
        2
      )
    );
    return { released: true, previous: job.resources, at: now };
  });
}

function lockFileFor(registry, installKey) {
  const safeKey = String(installKey).replace(/[^a-zA-Z0-9._-]+/g, "-");
  const locksDir = join(registry.registryDir, "locks");
  fs.mkdirSync(locksDir, { recursive: true, mode: 0o700 });
  return join(locksDir, `install-${safeKey}.lock`);
}

/**
 * Run a shared dependency/browser-cache install under an exclusive lock.
 *
 * The lock file is created with `wx`, so a second coordinator process cannot enter the
 * same install concurrently; it waits for the configured timeout and then reports a
 * collision instead of racing.
 */
export async function withSharedInstallLock(
  { registry, installKey, timeoutMs = 5000, pollMs = 25, owner = "unknown" },
  fn
) {
  if (!installKey) throw new ResourceError("installKey is required", "INVALID_INSTALL_KEY");
  const lockPath = lockFileFor(registry, installKey);
  const start = Date.now();

  for (;;) {
    try {
      fs.writeFileSync(lockPath, JSON.stringify({ owner, at: new Date().toISOString() }), {
        flag: "wx",
        mode: 0o600,
      });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() - start >= timeoutMs) {
        throw new ResourceError(
          `Shared install '${installKey}' is held by another owner`,
          "INSTALL_LOCK_TIMEOUT"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* already released */
    }
  }
}
