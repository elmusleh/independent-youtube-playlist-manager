/* eslint-disable no-console */
/**
 * Context Menus — Top-level registration and awaited dispatch only.
 * Uses context-menu-model.js for menu structure and capture-controller.js for execution.
 */

import { isAndroid } from "./utils.js";
import {
  initializeMenu,
  refreshMenu,
  handleMenuClick,
  MenuId,
  resolveDestination,
  DestinationType,
  TabScope,
  getPlaylists,
  invalidatePlaylistsCache,
  buildMenu,
  reconcileMenu,
} from "./context-menu-model.js";
import {
  executeCapture,
  handleSingleVideoCapture,
  handlePlaylistSave,
  handlePageImport,
  retryJob,
  JobState,
  createCaptureJob,
  getJob,
} from "./capture-controller.js";

// ---------------------------------------------------------------------------
// Menu initialization (called from background.js init)
// ---------------------------------------------------------------------------

export async function buildContextMenus(settings) {
  if (isAndroid()) return;

  const start = Date.now();
  try {
    await initializeMenu();
  } finally {
    const duration = Date.now() - start;
    if (duration > 100 && window.logSystemEvent) {
      window.logSystemEvent("PERF", `buildContextMenus took ${duration}ms`);
    }
  }
}

// ---------------------------------------------------------------------------
// Context menu click handler (top-level registration)
// ---------------------------------------------------------------------------

if (!isAndroid()) {
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const clickedMenuId = info.menuItemId.toString();

    try {
      // Route through model to determine action type
      const action = await handleMenuClick(info, tab);

      switch (action.type) {
        case "scope": {
          // User selected a scope - execute capture with current destination
          const settings = (await window.getSettings) ? await window.getSettings() : null;
          const destination = settings
            ? resolveDestination(settings, null, null)
            : { type: DestinationType.NEW_LOCAL, id: null, requiresChooser: false };

          // For now, execute with default destination; destination selection is separate
          const result = await executeCapture({
            anchorTab: action.tab,
            scope: action.scope,
            destinationType: destination.type,
            destinationId: destination.id,
            insertPosition: "bottom",
            closeTabs: false, // Menu default: keep tabs open
            source: "menu",
          });

          if (result.requiresChooser) {
            // Store job ID for chooser to pick up
            await browser.storage.local.set({ yph_pending_job_id: result.jobId });
            // Open chooser UI
            await openChooserUI(result.jobId);
          } else if (result.success) {
            await showSuccessNotification(result);
          } else {
            await showErrorNotification(result.error);
          }
          break;
        }

        case "single-video": {
          const result = await handleSingleVideoCapture(action.info, action.tab);
          if (result.requiresChooser) {
            await browser.storage.local.set({ yph_pending_job_id: result.jobId });
            await openChooserUI(result.jobId);
          } else if (result.success) {
            await showSuccessNotification(result);
          } else {
            await showErrorNotification(result.error);
          }
          break;
        }

        case "destination": {
          // User selected a destination from the Destination submenu
          // This changes the default for subsequent scope clicks
          const settings = (await window.getSettings) ? await window.getSettings() : null;
          if (settings) {
            // Store the chosen destination as the new default for menu actions
            await browser.storage.sync.set({
              yph_menu_default_destination: action.destinationType,
            });
            if (action.destinationType === DestinationType.CUSTOM) {
              // For custom, we need the chooser
              const job = await createCaptureJob({
                source: "menu",
                anchorSnapshot: {
                  id: action.tab.id,
                  windowId: action.tab.windowId,
                  index: action.tab.index,
                  url: action.tab.url,
                  incognito: action.tab.incognito,
                },
                scope: TabScope.CURRENT,
                destinationType: DestinationType.CUSTOM,
                destinationId: null,
                insertPosition: "bottom",
                closeTabs: false,
              });
              await browser.storage.local.set({ yph_pending_job_id: job.jobId });
              await openChooserUI(job.jobId);
            } else {
              await showSuccessNotification({
                success: true,
                message: `Destination set to ${action.destinationType}`,
              });
            }
          }
          break;
        }

        case "save-playlist": {
          const result = await handlePlaylistSave(action.info, action.tab);
          if (result.requiresChooser) {
            await browser.storage.local.set({ yph_pending_job_id: result.jobId });
            await openChooserUI(result.jobId);
          } else if (result.success) {
            await showSuccessNotification(result);
          } else {
            await showErrorNotification(result.error);
          }
          break;
        }

        case "page-import": {
          const result = await handlePageImport(action.info, action.tab);
          if (result.requiresChooser) {
            await browser.storage.local.set({ yph_pending_job_id: result.jobId });
            await openChooserUI(result.jobId);
          } else if (result.success) {
            await showSuccessNotification(result);
          } else {
            await showErrorNotification(result.error);
          }
          break;
        }

        case "settings": {
          await browser.tabs.create({
            url: browser.runtime.getURL("/editor/index.html#/settings"),
          });
          break;
        }

        default:
          console.warn("Unknown context menu action:", clickedMenuId);
      }
    } catch (error) {
      console.error("Context menu click handler error:", error);
      if (window.logSystemEvent) {
        window.logSystemEvent("ERROR", "Context menu click failed", {
          error: error.message,
          menuId: clickedMenuId,
        });
      }
      await showErrorNotification(error.message);
    }
  });
}

// ---------------------------------------------------------------------------
// Message handlers for chooser UI and retry
// ---------------------------------------------------------------------------

/**
 * Handle messages from chooser UI (playlist-manager SPA).
 */
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.cmd === "context-menu-choose-destination") {
    // Chooser UI selected a destination for a pending job
    (async () => {
      try {
        const { jobId, destinationType, destinationId, insertPosition, closeTabs } = request;
        const result = await retryJob(jobId, {
          destinationType,
          destinationId,
          insertPosition,
          closeTabs,
        });

        // Clear pending job
        await browser.storage.local.remove("yph_pending_job_id");

        if (result.requiresChooser) {
          // Still needs chooser (shouldn't happen if we provided destination)
          sendResponse({ success: false, requiresChooser: true, jobId: result.jobId });
        } else if (result.success) {
          await showSuccessNotification(result);
          sendResponse({ success: true, ...result });
        } else {
          await showErrorNotification(result.error);
          sendResponse({ success: false, error: result.error });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.cmd === "context-menu-retry-job") {
    // Retry a failed job (e.g., after fixing quota/network issue)
    (async () => {
      try {
        const { jobId, overrides } = request;
        const result = await retryJob(jobId, overrides);
        if (result.success) {
          await showSuccessNotification(result);
        } else if (result.requiresChooser) {
          await browser.storage.local.set({ yph_pending_job_id: result.jobId });
        } else {
          await showErrorNotification(result.error);
        }
        sendResponse({ success: result.success, ...result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.cmd === "context-menu-get-pending-job") {
    // Chooser UI asks for pending job details
    (async () => {
      try {
        const result = await browser.storage.local.get("yph_pending_job_id");
        if (result.yph_pending_job_id) {
          const job = await getJob(result.yph_pending_job_id);
          sendResponse({ job });
        } else {
          sendResponse({ job: null });
        }
      } catch (error) {
        sendResponse({ job: null, error: error.message });
      }
    })();
    return true;
  }

  if (request.cmd === "context-menu-clear-pending-job") {
    // Cancel pending job
    (async () => {
      await browser.storage.local.remove("yph_pending_job_id");
      sendResponse({ success: true });
    })();
    return true;
  }

  // Refresh menu on settings/playlist/auth changes
  if (request.cmd === "update-saved-playlists" || request.cmd === "update-settings") {
    refreshMenu().catch(console.error);
    sendResponse({ success: true });
    return true;
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openChooserUI(jobId) {
  // Open the playlist-manager SPA at the destination chooser route
  // The SPA will read the pending job ID from storage
  await browser.tabs.create({
    url: browser.runtime.getURL(`/editor/index.html#/choose-destination?job=${jobId}`),
  });
}

async function showSuccessNotification(result) {
  const { alert } = await import("./utils.js");
  let message = "";
  if (result.addedCount !== undefined) {
    message = `Added ${result.addedCount} video(s)`;
    if (result.duplicateCount > 0) message += ` (${result.duplicateCount} duplicates skipped)`;
    if (result.closedCount > 0) message += `, ${result.closedCount} tab(s) closed`;
    if (result.destinationId) message += ` to ${result.destinationType}`;
  } else if (result.message) {
    message = result.message;
  }
  await alert(message, true);
}

async function showErrorNotification(error) {
  const { alert } = await import("./utils.js");
  await alert(`Playlist Manager: ${error}`);
}

export default {
  buildContextMenus,
};
