import fs from "fs";
import { RegistryError } from "./registry-error.js";
import { validateTransition, isActiveState, requiresOwnership } from "./state-machine.js";
import {
  generateJobId,
  validateDependencies,
  checkActiveLimit,
  areDependenciesSatisfied,
} from "./scheduler.js";

export async function createJob(registry, jobInput) {
  return registry.withLock(async () => {
    // Generate job ID if not provided
    const jobId = jobInput.id || generateJobId(jobInput.changeName, Date.now());

    const jobPath = registry.getJobPath(jobId);
    if (fs.existsSync(jobPath)) {
      throw new RegistryError(`Job ${jobId} already exists`, "JOB_EXISTS");
    }

    // Validate dependencies
    if (jobInput.dependencies && jobInput.dependencies.length > 0) {
      const allJobs = registry.listJobs();
      const depValidation = validateDependencies(jobId, jobInput.dependencies, allJobs);
      if (!depValidation.valid) {
        throw new RegistryError(
          `Dependency validation failed: ${depValidation.missing?.join(", ") || depValidation.cycles?.join(", ")}`,
          "INVALID_DEPENDENCIES"
        );
      }
    }

    // Check active limit for queued jobs
    if (jobInput.state === "queued" || !jobInput.state) {
      const allJobs = registry.listJobs();
      const limitCheck = checkActiveLimit(allJobs, registry.policy.maxActive);
      if (!limitCheck.allowed) {
        throw new RegistryError(limitCheck.reason, "ACTIVE_LIMIT_EXCEEDED");
      }
    }

    const now = new Date().toISOString();
    const fullJob = {
      ...jobInput,
      id: jobId,
      schemaVersion: jobInput.schemaVersion || "1.0.0",
      policyVersion: jobInput.policyVersion || "1.0.0",
      state: jobInput.state || "queued",
      dependencies: jobInput.dependencies || [],
      operationReceipts: [],
      createdAt: now,
      updatedAt: now,
    };

    registry.atomicWrite(jobPath, JSON.stringify(fullJob, null, 2));
    registry.appendJournal({
      id: `journal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId,
      fromState: "queued",
      toState: fullJob.state,
      actor: "coordinator",
      timestamp: now,
      evidence: { action: "create" },
    });

    return fullJob;
  });
}

export async function transitionJob(registry, jobId, toState, context = {}) {
  return registry.withLock(async () => {
    const jobPath = registry.getJobPath(jobId);
    const job = registry.readJsonFile(jobPath);
    if (!job) {
      throw new RegistryError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
    }

    const fromState = job.state;

    // Validate transition
    const transitionValidation = validateTransition(fromState, toState, context);
    if (!transitionValidation.valid) {
      throw new RegistryError(transitionValidation.reason, "INVALID_TRANSITION");
    }

    // Check dependencies for certain target states
    if (toState !== fromState) {
      const allJobs = registry.listJobs();
      const depCheck = areDependenciesSatisfied(jobId, allJobs);
      if (
        !depCheck.satisfied &&
        ["implementing", "verifying", "reviewing", "syncing", "publication-pending"].includes(
          toState
        )
      ) {
        throw new RegistryError(
          `Dependencies not satisfied: ${depCheck.unsatisfied.map((u) => `${u.jobId} (${u.reason})`).join(", ")}`,
          "DEPENDENCIES_NOT_SATISFIED"
        );
      }
    }

    // Check active limit when entering active state
    if (isActiveState(toState) && !isActiveState(fromState)) {
      const allJobs = registry.listJobs();
      const limitCheck = checkActiveLimit(allJobs, registry.policy.maxActive, jobId);
      if (!limitCheck.allowed) {
        throw new RegistryError(limitCheck.reason, "ACTIVE_LIMIT_EXCEEDED");
      }
    }

    // Check ownership requirement
    if (requiresOwnership(toState) && !job.owner) {
      throw new RegistryError(`State ${toState} requires ownership`, "OWNERSHIP_REQUIRED");
    }

    const now = new Date().toISOString();
    const updatedJob = {
      ...job,
      state: toState,
      updatedAt: now,
      ...context.updates,
    };

    registry.atomicWrite(jobPath, JSON.stringify(updatedJob, null, 2));

    registry.appendJournal({
      id: `journal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId,
      fromState,
      toState,
      actor: context.actor || "unknown",
      timestamp: now,
      evidence: context.evidence || {},
      previousOwner: job.owner,
    });

    return updatedJob;
  });
}

export async function patchJob(registry, jobId, updates) {
  return registry.withLock(async () => {
    if (updates && Object.prototype.hasOwnProperty.call(updates, "state")) {
      throw new RegistryError("patchJob cannot change state; use transitionJob", "INVALID_PATCH");
    }

    const jobPath = registry.getJobPath(jobId);
    const job = registry.readJsonFile(jobPath);
    if (!job) {
      throw new RegistryError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
    }

    const updatedJob = {
      ...job,
      ...updates,
      state: job.state,
      updatedAt: new Date().toISOString(),
    };

    registry.atomicWrite(jobPath, JSON.stringify(updatedJob, null, 2));
    return updatedJob;
  });
}
