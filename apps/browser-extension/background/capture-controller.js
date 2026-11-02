/* eslint-disable no-console */
/**
 * Capture Controller — Entry point for background capture operations.
 * Composes job-store, mutation-queue, capture-execution, and capture-handlers.
 */

import { JobState } from "./capture-constants.js";
import { enqueuePlaylistMutation, getPlaylistsRevision } from "./mutation-queue.js";
import { createCaptureJob, updateJob, getJob, cleanupOldJobs } from "./job-store.js";
import { executeCapture } from "./capture-execution.js";
import {
  handleSingleVideoCapture,
  handlePlaylistSave,
  handlePageImport,
  retryJob,
} from "./capture-handlers.js";

export {
  JobState,
  enqueuePlaylistMutation,
  getPlaylistsRevision,
  createCaptureJob,
  updateJob,
  getJob,
  cleanupOldJobs,
  executeCapture,
  handleSingleVideoCapture,
  handlePlaylistSave,
  handlePageImport,
  retryJob,
};

export default {
  JobState,
  enqueuePlaylistMutation,
  getPlaylistsRevision,
  createCaptureJob,
  updateJob,
  getJob,
  cleanupOldJobs,
  executeCapture,
  handleSingleVideoCapture,
  handlePlaylistSave,
  handlePageImport,
  retryJob,
};
