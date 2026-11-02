/**
 * Capture handlers — specific handlers for single video, playlist save, page import, and retry.
 */

import { JobState } from "./capture-constants.js";
import { DestinationType, InsertPosition, TabScope } from "../shared/quick-add.js";
import {
  collectVideoIdFromLink,
  collectPlaylistIdFromLink,
  getDefaultQuickAddSettings,
  resolveDestination,
} from "../shared/quick-add.js";
import { isYouTubePlaylistTab, createAnchorSnapshot } from "../shared/tab-selection.js";
import { createCaptureJob, updateJob, getJob } from "./job-store.js";
import { executeCapture } from "./capture-execution.js";

/**
 * Handle single video/link capture from context menu.
 * @param {Object} info - contextMenus.OnClickData
 * @param {Tab} tab - The tab where the click occurred
 * @returns {Promise<Object>}
 */
export async function handleSingleVideoCapture(info, tab) {
  const videoId = collectVideoIdFromLink(info.linkUrl || info.pageUrl);
  if (!videoId) {
    return { success: false, error: "Invalid YouTube video link" };
  }

  const settings = (await window.getSettings)
    ? await window.getSettings()
    : getDefaultQuickAddSettings();
  const destination = resolveDestination(settings, null, null); // Use default

  if (destination.requiresChooser) {
    const job = await createCaptureJob({
      source: "menu",
      anchorSnapshot: createAnchorSnapshot(tab),
      scope: TabScope.CURRENT,
      destinationType: null,
      destinationId: null,
      insertPosition: InsertPosition.BOTTOM,
      closeTabs: false,
    });

    await updateJob(job.jobId, {
      state: JobState.PENDING,
      videoIds: [videoId],
      requiresChooser: true,
      chooserReason: destination.reason,
    });

    return {
      success: true,
      requiresChooser: true,
      jobId: job.jobId,
      videoIds: [videoId],
      reason: destination.reason,
    };
  }

  // Direct capture to resolved destination
  return executeCapture({
    anchorTab: tab,
    scope: TabScope.CURRENT,
    destinationType: destination.type,
    destinationId: destination.id,
    insertPosition: InsertPosition.BOTTOM,
    closeTabs: false,
    source: "menu",
  });
}

/**
 * Handle playlist save from context menu (YouTube playlist page).
 * @param {Object} info
 * @param {Tab} tab
 * @returns {Promise<Object>}
 */
export async function handlePlaylistSave(info, tab) {
  if (!isYouTubePlaylistTab(tab)) {
    return { success: false, error: "Not a YouTube playlist page" };
  }

  const playlistId = collectPlaylistIdFromLink(info.pageUrl);
  if (!playlistId) {
    return { success: false, error: "Could not extract playlist ID" };
  }

  // This would need to inject content script to get video IDs
  // For now, return a job that needs the chooser for destination
  const job = await createCaptureJob({
    source: "menu",
    anchorSnapshot: createAnchorSnapshot(tab),
    scope: TabScope.CURRENT,
    destinationType: DestinationType.CUSTOM,
    destinationId: null,
    insertPosition: InsertPosition.BOTTOM,
    closeTabs: false,
  });

  // Store playlist ID in job for later use
  await updateJob(job.jobId, {
    state: JobState.PENDING,
    playlistIdToImport: playlistId,
    requiresChooser: true,
    chooserReason: "Choose destination for imported playlist",
  });

  return { success: true, requiresChooser: true, jobId: job.jobId, playlistIdToImport: playlistId };
}

/**
 * Handle page import from context menu (ordinary page).
 * @param {Object} info
 * @param {Tab} tab
 * @returns {Promise<Object>}
 */
export async function handlePageImport(info, tab) {
  const job = await createCaptureJob({
    source: "menu",
    anchorSnapshot: createAnchorSnapshot(tab),
    scope: TabScope.CURRENT, // Will be overridden by page import logic
    destinationType: null,
    destinationId: null,
    insertPosition: InsertPosition.BOTTOM,
    closeTabs: false,
  });

  await updateJob(job.jobId, {
    state: JobState.PENDING,
    requiresChooser: true,
    chooserReason: "Choose destination for page import",
    isPageImport: true,
    importTabId: tab.id,
    importTabUrl: tab.url,
  });

  return { success: true, requiresChooser: true, jobId: job.jobId, isPageImport: true };
}

/**
 * Retry a failed or pending job (e.g., after user chooses destination).
 * @param {string} jobId
 * @param {Object} [overrides] - destinationType, destinationId, insertPosition, closeTabs
 * @returns {Promise<Object>}
 */
export async function retryJob(jobId, overrides = {}) {
  const job = await getJob(jobId);
  if (!job) {
    return { success: false, error: "Job not found" };
  }

  if (job.state !== JobState.FAILED && job.state !== JobState.PENDING) {
    return { success: false, error: `Cannot retry job in state: ${job.state}` };
  }

  // Merge overrides with original params
  const params = {
    ...job.originalParams,
    ...overrides,
    destinationType: overrides.destinationType || job.destinationType,
    destinationId: overrides.destinationId || job.destinationId,
    insertPosition: overrides.insertPosition || job.insertPosition,
    closeTabs: overrides.closeTabs !== undefined ? overrides.closeTabs : job.closeTabs,
  };

  // Create new job with merged params
  const newJob = await createCaptureJob(params);

  // If we have videoIds already, use them
  if (job.videoIds && job.videoIds.length > 0) {
    await updateJob(newJob.jobId, { videoIds: job.videoIds, duplicateCount: job.duplicateCount });
  }

  return executeCapture(params);
}

export default {
  handleSingleVideoCapture,
  handlePlaylistSave,
  handlePageImport,
  retryJob,
};
