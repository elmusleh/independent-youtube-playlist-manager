/**
 * Capture execution — main capture logic for collecting tabs, resolving destinations, and saving.
 */

import { playlistBuilderId, updateBadge } from "./utils.js";
import { JobState } from "./capture-constants.js";
import {
  DestinationType,
  InsertPosition,
  resolveDestination,
  preparePlaylistForSave,
  collectValidVideoIds,
  getDefaultQuickAddSettings,
  extractUniqueVideoIds,
} from "../shared/quick-add.js";
import {
  resolveTabsForScope,
  validateTabForCapture,
  createAnchorSnapshot,
} from "../shared/tab-selection.js";
import { enqueuePlaylistMutation, getPlaylistsRevision } from "./mutation-queue.js";
import { createCaptureJob, updateJob, getJob } from "./job-store.js";

/**
 * Main capture execution function.
 * @param {Object} params
 * @returns {Promise<Object>} Result summary
 */
export async function executeCapture(params) {
  const {
    anchorTab,
    scope,
    destinationType,
    destinationId,
    insertPosition,
    closeTabs,
    source = "menu",
  } = params;

  // Create job for tracking
  const anchorSnapshot = createAnchorSnapshot(anchorTab);
  const job = await createCaptureJob({
    source,
    anchorSnapshot,
    scope,
    destinationType,
    destinationId,
    insertPosition,
    closeTabs,
  });

  try {
    await updateJob(job.jobId, { state: JobState.COLLECTING });

    // Get all tabs needed for scope resolution
    const [allTabsInWindow, allTabsAllWindows] = await Promise.all([
      browser.tabs.query({ windowId: anchorTab.windowId }),
      browser.tabs.query({}), // all normal windows
    ]);

    // Resolve tabs for the scope
    const tabs = resolveTabsForScope({
      anchorTab,
      allTabsInWindow,
      allTabsAllWindows,
      scope,
    });

    if (tabs.length === 0) {
      await updateJob(job.jobId, {
        state: JobState.FAILED,
        error: "No YouTube video tabs found for the selected scope",
      });
      return {
        success: false,
        error: "No YouTube video tabs found for the selected scope",
        jobId: job.jobId,
      };
    }

    // Validate anchor tab hasn't changed
    const validation = validateTabForCapture(anchorTab, anchorSnapshot);
    if (!validation.valid) {
      await updateJob(job.jobId, {
        state: JobState.FAILED,
        error: `Anchor tab validation failed: ${validation.reason}`,
      });
      return {
        success: false,
        error: `Anchor tab validation failed: ${validation.reason}`,
        jobId: job.jobId,
      };
    }

    // Collect valid video IDs
    await updateJob(job.jobId, { state: JobState.ENRICHING });
    const { videoIds, duplicateCount, invalidCount } = collectValidVideoIds(tabs);

    if (videoIds.length === 0) {
      await updateJob(job.jobId, {
        state: JobState.FAILED,
        error: "No valid YouTube video IDs found",
      });
      return { success: false, error: "No valid YouTube video IDs found", jobId: job.jobId };
    }

    // Get settings for destination resolution
    const settings = (await window.getSettings)
      ? await window.getSettings()
      : getDefaultQuickAddSettings();

    // Resolve destination
    const destination = resolveDestination(settings, destinationType, destinationId);

    if (destination.requiresChooser) {
      // Job needs user to choose destination via chooser UI
      await updateJob(job.jobId, {
        state: JobState.PENDING,
        videoIds,
        duplicateCount,
        requiresChooser: true,
        chooserReason: destination.reason,
      });
      return {
        success: true,
        requiresChooser: true,
        jobId: job.jobId,
        videoIds,
        duplicateCount,
        reason: destination.reason,
      };
    }

    // Fetch existing playlist/builder for destination
    let existingPlaylist = null;
    let existingBuilder = [];

    if (destination.type === DestinationType.BUILDER) {
      const result = await browser.storage.local.get(playlistBuilderId);
      existingBuilder = result[playlistBuilderId] || [];
    } else if (destination.id) {
      existingPlaylist = await window.getPlaylist(destination.id);
      if (!existingPlaylist) {
        await updateJob(job.jobId, {
          state: JobState.FAILED,
          error: `Destination playlist not found: ${destination.id}`,
        });
        return {
          success: false,
          error: `Destination playlist not found: ${destination.id}`,
          jobId: job.jobId,
        };
      }
    } else if (destination.type === DestinationType.LATEST) {
      const playlists = await window.getPlaylists();
      if (playlists.length === 0) {
        await updateJob(job.jobId, {
          state: JobState.FAILED,
          error: "No playlists found for 'latest' destination",
        });
        return {
          success: false,
          error: "No playlists found for 'latest' destination",
          jobId: job.jobId,
        };
      }
      existingPlaylist = [...playlists].sort((a, b) => b.timestamp - a.timestamp)[0];
      destination.id = existingPlaylist.id;
    }

    // Extract unique video IDs (deduplicate against existing)
    const { videoIds: uniqueVideoIds, duplicateCount: destDuplicateCount } = extractUniqueVideoIds(
      tabs,
      existingPlaylist?.videos || existingBuilder
    );

    await updateJob(job.jobId, {
      videoIds: uniqueVideoIds,
      duplicateCount: duplicateCount + destDuplicateCount,
      state: JobState.SAVING,
    });

    if (uniqueVideoIds.length === 0) {
      await updateJob(job.jobId, {
        state: JobState.COMPLETED,
        addedCount: 0,
        duplicateCount: duplicateCount + destDuplicateCount,
      });
      return {
        success: true,
        addedCount: 0,
        duplicateCount: duplicateCount + destDuplicateCount,
        destinationId: destination.id,
        destinationType: destination.type,
        jobId: job.jobId,
      };
    }

    // Prepare playlist for save
    const prepared = preparePlaylistForSave({
      videoIds: uniqueVideoIds,
      destinationType: destination.type,
      destinationId: destination.id,
      insertPosition: insertPosition || InsertPosition.BOTTOM,
      existingPlaylist,
      existingBuilder,
    });

    // Save via serialized mutation queue
    const expectedRevision = await getPlaylistsRevision();
    const savedPlaylistId = await enqueuePlaylistMutation(async () => {
      const playlist = prepared.playlist;
      const signedIn = (await window.isSignedIn) ? await window.isSignedIn() : false;
      const isLocal = playlist.id.startsWith("local-") || playlist.isLocal;
      const shouldSync = signedIn && !isLocal && destination.type !== DestinationType.BUILDER;

      return await window.savePlaylist(playlist, { syncToYoutube: shouldSync });
    }, expectedRevision);

    // Update builder badge if builder was modified
    if (destination.type === DestinationType.BUILDER) {
      const result = await browser.storage.local.get(playlistBuilderId);
      const builder = result[playlistBuilderId] || [];
      updateBadge("" + builder.length);
    }

    // Close tabs if requested and enabled
    let closedCount = 0;
    if (closeTabs && tabs.length > 0) {
      await updateJob(job.jobId, { state: JobState.CLOSING });
      const tabsToClose = tabs.filter((t) => {
        // Only close tabs that were durably added (unchanged ID/URL/window, not pinned)
        const validation = validateTabForCapture(t, createAnchorSnapshot(t));
        return validation.valid && !t.pinned;
      });

      if (tabsToClose.length > 0) {
        const tabIds = tabsToClose.map((t) => t.id).filter(Boolean);
        if (tabIds.length > 0) {
          await browser.tabs.remove(tabIds);
          closedCount = tabIds.length;
        }
      }
    }

    await updateJob(job.jobId, {
      state: JobState.COMPLETED,
      addedCount: uniqueVideoIds.length,
      duplicateCount: duplicateCount + destDuplicateCount,
      skippedCount: invalidCount,
      failedCount: 0,
      addedVideoIds: uniqueVideoIds,
      destinationPlaylistId: savedPlaylistId || prepared.destinationId,
      closedCount,
    });

    // Notify open views
    if (window.browser?.runtime?.sendMessage) {
      browser.runtime.sendMessage({ cmd: "update-saved-playlists" }).catch(() => {});
    }

    return {
      success: true,
      addedCount: uniqueVideoIds.length,
      duplicateCount: duplicateCount + destDuplicateCount,
      skippedCount: invalidCount,
      failedCount: 0,
      addedVideoIds: uniqueVideoIds,
      destinationId: savedPlaylistId || prepared.destinationId,
      destinationType: destination.type,
      closedCount,
      jobId: job.jobId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await updateJob(job.jobId, { state: JobState.FAILED, error: errorMsg });
    return { success: false, error: errorMsg, jobId: job.jobId };
  }
}

export default {
  executeCapture,
};
