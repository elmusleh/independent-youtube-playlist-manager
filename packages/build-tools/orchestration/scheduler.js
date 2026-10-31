#!/usr/bin/env node
/**
 * Scheduler - Two-slot scheduling and dependency management
 *
 * Enforces maxActive limit, dependency ordering, and cycle detection.
 */

import { isActiveState } from "./state-machine.js";

export class SchedulerError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SchedulerError";
    this.code = code;
  }
}

/**
 * Check if adding a job would exceed maxActive limit
 * @param {Array} jobs - All jobs in registry
 * @param {number} maxActive - Maximum active jobs (from policy)
 * @param {string} excludeJobId - Optional job ID to exclude from count
 * @returns {object} { allowed: boolean, activeCount: number, reason?: string }
 */
export function checkActiveLimit(jobs, maxActive, excludeJobId = null) {
  const activeJobs = jobs.filter((job) => job.id !== excludeJobId && isActiveState(job.state));

  if (activeJobs.length >= maxActive) {
    return {
      allowed: false,
      activeCount: activeJobs.length,
      reason: `Active job limit (${maxActive}) reached. Active jobs: ${activeJobs.map((j) => j.id).join(", ")}`,
    };
  }

  return { allowed: true, activeCount: activeJobs.length };
}

/**
 * Get active job count
 */
export function getActiveCount(jobs) {
  return jobs.filter((job) => isActiveState(job.state)).length;
}

/**
 * Validate dependencies - check for cycles and missing dependencies
 * @param {string} jobId - Job being validated
 * @param {Array<string>} dependencies - Dependency job IDs
 * @param {Array} allJobs - All jobs in registry
 * @returns {object} { valid: boolean, cycles?: Array, missing?: Array }
 */
export function validateDependencies(jobId, dependencies, allJobs) {
  const jobMap = new Map(allJobs.map((j) => [j.id, j]));
  const missing = dependencies.filter((depId) => !jobMap.has(depId));

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  // Check for cycles using DFS
  const cycles = detectCycles(jobId, dependencies, jobMap);

  if (cycles.length > 0) {
    return { valid: false, cycles };
  }

  return { valid: true };
}

/**
 * Detect cycles in dependency graph using DFS
 */
function detectCycles(startJobId, dependencies, jobMap) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(currentJobId, path) {
    if (recursionStack.has(currentJobId)) {
      // Found a cycle
      const cycleStart = path.indexOf(currentJobId);
      cycles.push(path.slice(cycleStart).concat(currentJobId));
      return;
    }

    if (visited.has(currentJobId)) {
      return;
    }

    visited.add(currentJobId);
    recursionStack.add(currentJobId);

    const job = jobMap.get(currentJobId);
    if (job && job.dependencies) {
      for (const depId of job.dependencies) {
        if (jobMap.has(depId)) {
          dfs(depId, [...path, currentJobId]);
        }
      }
    }

    recursionStack.delete(currentJobId);
  }

  // Check each dependency path
  for (const depId of dependencies) {
    if (jobMap.has(depId)) {
      dfs(depId, [startJobId]);
    }
  }

  return cycles;
}

/**
 * Get jobs that depend on a given job (reverse dependencies)
 */
export function getDependents(jobId, allJobs) {
  return allJobs.filter((job) => job.dependencies?.includes(jobId));
}

/**
 * Check if a job's dependencies are satisfied (all in terminal/success states)
 */
export function areDependenciesSatisfied(jobId, allJobs) {
  const job = allJobs.find((j) => j.id === jobId);
  if (!job || !job.dependencies || job.dependencies.length === 0) {
    return { satisfied: true };
  }

  const jobMap = new Map(allJobs.map((j) => [j.id, j]));
  const unsatisfied = [];

  for (const depId of job.dependencies) {
    const depJob = jobMap.get(depId);
    if (!depJob) {
      unsatisfied.push({ jobId: depId, reason: "missing" });
      continue;
    }

    // Dependency must be merged or at least in a success terminal state
    if (depJob.state !== "merged" && depJob.state !== "cancelled") {
      unsatisfied.push({ jobId: depId, reason: `state=${depJob.state}` });
    }
  }

  return {
    satisfied: unsatisfied.length === 0,
    unsatisfied,
  };
}

/**
 * Get jobs ready to be activated (queued, deps satisfied, within limit)
 */
export function getReadyJobs(jobs, maxActive) {
  const activeCount = getActiveCount(jobs);
  const availableSlots = maxActive - activeCount;

  if (availableSlots <= 0) {
    return [];
  }

  const queuedJobs = jobs.filter((j) => j.state === "queued");

  return queuedJobs
    .filter((job) => {
      const depCheck = areDependenciesSatisfied(job.id, jobs);
      return depCheck.satisfied;
    })
    .slice(0, availableSlots);
}

/**
 * Check if a job can transition to a target state considering dependencies
 */
export function canTransitionWithDeps(jobId, targetState, allJobs) {
  const job = allJobs.find((j) => j.id === jobId);
  if (!job) {
    return { allowed: false, reason: "Job not found" };
  }

  // Check dependencies for states that require them
  const statesRequiringDeps = [
    "implementing",
    "verifying",
    "reviewing",
    "syncing",
    "publication-pending",
  ];

  if (statesRequiringDeps.includes(targetState)) {
    const depCheck = areDependenciesSatisfied(jobId, allJobs);
    if (!depCheck.satisfied) {
      return {
        allowed: false,
        reason: `Dependencies not satisfied: ${depCheck.unsatisfied.map((u) => `${u.jobId} (${u.reason})`).join(", ")}`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Generate a deterministic job ID from change name and index
 */
export function generateJobId(changeName, index) {
  const slug = changeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${index.toString().padStart(3, "0")}`;
}

/**
 * Get scheduling decision for a job
 */
export function getSchedulingDecision(jobId, jobs, maxActive) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    return { action: "not-found" };
  }

  if (job.state !== "queued") {
    return { action: "invalid-state", reason: `Job is in ${job.state}, not queued` };
  }

  const depCheck = areDependenciesSatisfied(jobId, jobs);
  if (!depCheck.satisfied) {
    return { action: "waiting-deps", unsatisfied: depCheck.unsatisfied };
  }

  const limitCheck = checkActiveLimit(jobs, maxActive, jobId);
  if (!limitCheck.allowed) {
    return { action: "waiting-slot", activeCount: limitCheck.activeCount };
  }

  return { action: "ready" };
}
