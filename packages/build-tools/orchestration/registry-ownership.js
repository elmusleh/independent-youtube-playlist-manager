import { RegistryError } from "./registry-error.js";

export async function claimOwnership(registry, jobId, sessionId, pid, livenessRef) {
  return registry.withLock(async () => {
    const job = registry.getJob(jobId);
    if (!job) {
      throw new RegistryError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
    }

    if (job.owner && job.owner.sessionId !== sessionId) {
      if (registry.isOwnerAlive(job.owner)) {
        throw new RegistryError(
          `Job ${jobId} already owned by session ${job.owner.sessionId}`,
          "OWNERSHIP_CONFLICT"
        );
      }
    }

    const now = new Date().toISOString();
    const updatedJob = {
      ...job,
      owner: {
        sessionId,
        pid,
        startedAt: now,
        lastHeartbeat: now,
        livenessRef,
      },
      state: "implementing",
      updatedAt: now,
    };

    registry.atomicWrite(registry.getJobPath(jobId), JSON.stringify(updatedJob, null, 2));

    registry.appendJournal({
      id: `journal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId,
      fromState: job.state,
      toState: "implementing",
      actor: sessionId,
      timestamp: now,
      evidence: { action: "claim-ownership" },
      previousOwner: job.owner,
    });

    return updatedJob;
  });
}

export async function releaseOwnership(registry, jobId, sessionId) {
  return registry.withLock(async () => {
    const job = registry.getJob(jobId);
    if (!job) {
      throw new RegistryError(`Job ${jobId} not found`, "JOB_NOT_FOUND");
    }

    if (job.owner?.sessionId !== sessionId) {
      throw new RegistryError(`Session ${sessionId} does not own job ${jobId}`, "NOT_OWNER");
    }

    const now = new Date().toISOString();
    const updatedJob = {
      ...job,
      owner: undefined,
      state: "verification-pending",
      updatedAt: now,
    };

    registry.atomicWrite(registry.getJobPath(jobId), JSON.stringify(updatedJob, null, 2));

    registry.appendJournal({
      id: `journal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId,
      fromState: job.state,
      toState: "verification-pending",
      actor: sessionId,
      timestamp: now,
      evidence: { action: "release-ownership" },
      previousOwner: job.owner,
    });

    return updatedJob;
  });
}

export async function updateHeartbeat(registry, jobId, sessionId) {
  return registry.withLock(async () => {
    const job = registry.getJob(jobId);
    if (!job || job.owner?.sessionId !== sessionId) {
      throw new RegistryError("Not owner or job not found", "NOT_OWNER");
    }

    const now = new Date().toISOString();
    const updatedJob = {
      ...job,
      owner: {
        ...job.owner,
        lastHeartbeat: now,
      },
      updatedAt: now,
    };

    registry.atomicWrite(registry.getJobPath(jobId), JSON.stringify(updatedJob, null, 2));

    return updatedJob;
  });
}
