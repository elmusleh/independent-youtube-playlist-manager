/* eslint-disable no-console */
/**
 * Job store — in-memory job storage with persistence for restart recovery.
 */

import { JobState } from "./capture-constants.js";

/**
 * In-memory job store (survives as long as service worker lives).
 * For persistence across restarts, jobs are also stored in browser.storage.local.
 */
const _jobs = new Map();

/**
 * Create a new capture job.
 * @param {Object} params
 * @returns {Promise<Object>} Job object with jobId
 */
export async function createCaptureJob(params) {
  const jobId = "job-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  const job = {
    jobId,
    state: JobState.PENDING,
    source: params.source, // "menu" | "popup" | "keyboard"
    anchorSnapshot: params.anchorSnapshot,
    scope: params.scope,
    destinationType: params.destinationType,
    destinationId: params.destinationId,
    insertPosition: params.insertPosition,
    closeTabs: params.closeTabs,
    videoIds: [],
    duplicateCount: 0,
    skippedCount: 0,
    failedCount: 0,
    addedVideoIds: [],
    destinationPlaylistId: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // For retry support
    retryable: true,
    originalParams: params,
  };

  _jobs.set(jobId, job);
  await persistJob(job);
  return job;
}

/**
 * Update job state and persist.
 * @param {string} jobId
 * @param {Partial<Object>} updates
 * @returns {Promise<Object|null>}
 */
export async function updateJob(jobId, updates) {
  const job = _jobs.get(jobId);
  if (!job) return null;

  Object.assign(job, updates, { updatedAt: Date.now() });
  await persistJob(job);
  return job;
}

/**
 * Get a job by ID.
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
export async function getJob(jobId) {
  let job = _jobs.get(jobId);
  if (job) return job;

  // Try to load from storage
  const result = await browser.storage.local.get("yph_capture_jobs");
  const jobs = result.yph_capture_jobs || {};
  job = jobs[jobId];
  if (job) {
    _jobs.set(jobId, job);
  }
  return job || null;
}

/**
 * Persist job to storage for restart recovery.
 * @param {Object} job
 */
async function persistJob(job) {
  const result = await browser.storage.local.get("yph_capture_jobs");
  const jobs = result.yph_capture_jobs || {};
  jobs[job.jobId] = job;
  await browser.storage.local.set({ yph_capture_jobs: jobs });
}

/**
 * Remove completed/failed jobs older than maxAge.
 * @param {number} maxAgeMs
 */
export async function cleanupOldJobs(maxAgeMs = 24 * 60 * 60 * 1000) {
  const result = await browser.storage.local.get("yph_capture_jobs");
  const jobs = result.yph_capture_jobs || {};
  const now = Date.now();
  let changed = false;

  for (const [id, job] of Object.entries(jobs)) {
    if (
      now - job.updatedAt > maxAgeMs &&
      (job.state === JobState.COMPLETED || job.state === JobState.FAILED)
    ) {
      delete jobs[id];
      _jobs.delete(id);
      changed = true;
    }
  }

  if (changed) {
    await browser.storage.local.set({ yph_capture_jobs: jobs });
  }
}

export default {
  createCaptureJob,
  updateJob,
  getJob,
  cleanupOldJobs,
};
