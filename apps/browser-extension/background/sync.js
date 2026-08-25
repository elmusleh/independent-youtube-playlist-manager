/* eslint-disable no-console */
import { isAndroid } from "./utils.js";

// ---------------------------------------------------------------------------
// Sync retry handler
// ---------------------------------------------------------------------------

export async function handleSyncRetry(localPlaylistId) {
  const alarmName = `sync-retry-${localPlaylistId}`;

  if (window.logSystemEvent) {
    await window.logSystemEvent(
      "INFO",
      `Background: Handling auto-retry for playlist ${localPlaylistId}`
    );
  }

  const editorTabs = await browser.tabs.query({
    url: browser.runtime.getURL("/editor/index.html*"),
  });

  if (editorTabs.length === 0) {
    if (window.logSystemEvent) {
      await window.logSystemEvent(
        "WARN",
        `Background: No editor tab open for ${localPlaylistId}, rescheduling`
      );
    }
    await browser.alarms.create(alarmName, { delayInMinutes: 30 });
    return;
  }

  const targetTab = editorTabs[0];
  try {
    const response = await browser.tabs.sendMessage(targetTab.id, {
      cmd: "resume-sync",
      localPlaylistId: localPlaylistId,
      alarmName: alarmName,
    });

    if (response && response.success) {
      if (window.logSystemEvent) {
        await window.logSystemEvent(
          "INFO",
          `Background: Resume sync initiated for ${localPlaylistId}`
        );
      }
    } else if (response && response.error) {
      const errorLower = response.error.toLowerCase();
      if (errorLower.includes("quota") || errorLower.includes("ratelimitexceeded")) {
        const SYNC_STATE_KEY = "yph_sync_state";
        const result = await browser.storage.local.get(SYNC_STATE_KEY);
        const allStates = result[SYNC_STATE_KEY] || {};
        const syncState = allStates[localPlaylistId];
        const retryCount = syncState?.retryCount || 0;

        if (retryCount >= 7) {
          await browser.alarms.clear(alarmName);
          if (allStates[localPlaylistId]) {
            delete allStates[localPlaylistId];
            await browser.storage.local.set({ [SYNC_STATE_KEY]: allStates });
          }
          await browser.notifications
            .create({
              type: "basic",
              title: "Playlist Manager",
              message: `Playlist sync failed after ${retryCount} attempts. Please try manually.`,
              ...(isAndroid() ? {} : { iconUrl: "assets/icons/icon_48.png" }),
            })
            .catch((e) => console.warn("Notification failed:", e));
        } else {
          if (syncState) {
            syncState.retryCount = retryCount + 1;
            syncState.lastAttemptAt = Date.now();
            allStates[localPlaylistId] = syncState;
            await browser.storage.local.set({ [SYNC_STATE_KEY]: allStates });
          }
          await browser.alarms.create(alarmName, { delayInMinutes: 24 * 60 });
          await browser.notifications
            .create({
              type: "basic",
              title: "Playlist Manager",
              message: `Playlist sync paused due to API quota. Retry ${retryCount + 1}/7 - will try again in 24h.`,
              ...(isAndroid() ? {} : { iconUrl: "assets/icons/icon_48.png" }),
            })
            .catch((e) => console.warn("Notification failed:", e));
        }
      } else if (response.error === "not_signed_in") {
        await browser.alarms.create(alarmName, { delayInMinutes: 24 * 60 });
      } else if (response.error === "auto_retry_disabled") {
        await browser.alarms.clear(alarmName);
        await browser.notifications
          .create({
            type: "basic",
            title: "Playlist Manager",
            message: `Auto-retry is disabled. Click Sync to resume manually when ready.`,
            ...(isAndroid() ? {} : { iconUrl: "assets/icons/icon_48.png" }),
          })
          .catch((e) => console.warn("Notification failed:", e));
      } else {
        await browser.alarms.clear(alarmName);
        await browser.notifications
          .create({
            type: "basic",
            title: "Playlist Manager: Error",
            message: `Failed to resume sync: ${response.error}`,
            ...(isAndroid() ? {} : { iconUrl: "assets/icons/icon_48.png" }),
          })
          .catch((e) => console.warn("Notification failed:", e));
      }
    }
  } catch (e_inner) {
    if (window.logSystemEvent) {
      await window.logSystemEvent(
        "WARN",
        `Background: Editor tab didn't respond for ${localPlaylistId}, rescheduling`,
        { error: e_inner.message }
      );
    }
    await browser.alarms.create(alarmName, { delayInMinutes: 30 });
  }
}

// ---------------------------------------------------------------------------
// Alarm handler (top-level registration)
// ---------------------------------------------------------------------------

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "yph-cache-cleanup") {
    // Import needed lazily to avoid circular dependency
    const { pruneStaleMetadataCache } = await import("./history.js");
    await pruneStaleMetadataCache();
  } else if (alarm.name === "supabase-cloud-sync") {
    if (window.syncEngine) {
      await window.syncEngine
        .triggerSync()
        .catch((e) => console.warn("[Background] Supabase auto-sync error:", e));
    }
  } else if (alarm.name.startsWith("sync-retry-")) {
    const localPlaylistId = alarm.name.replace("sync-retry-", "");
    await handleSyncRetry(localPlaylistId);
  }
});
