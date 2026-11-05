/* global chrome */
const assert = require("node:assert/strict");

async function verifySyncSchedule(page, worker, base, requestUrls) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        chrome.storage.local.set(
          {
            yph_sync_config: {
              syncKey: "ABCDEFGHIJKLMNOPQRST",
              backends: ["relay"],
              syncIntervalMinutes: 5,
              autoSyncOnChange: true,
              autoSyncOnStartup: true,
              syncConfigVersion: 2,
              syncProtocolVersion: 2,
              legacyV2AcknowledgedAt: Date.now(),
              content: { playlists: true, settings: true, history: true },
            },
          },
          resolve
        )
      )
  );

  await page.goto(`${base}/editor/index.html#/sync`);
  const manualButton = page.getByRole("button", { name: "Manual only", exact: true });
  await manualButton.waitFor();
  await manualButton.click();

  await page.waitForFunction(async () => {
    const { yph_sync_config: cfg } = await chrome.storage.local.get("yph_sync_config");
    return (
      cfg?.syncIntervalMinutes === 0 &&
      cfg?.autoSyncOnChange === false &&
      cfg?.autoSyncOnStartup === false
    );
  });

  const clearedAlarm = await worker.evaluate(() => chrome.alarms.get("yph-sync-periodic"));
  assert.equal(clearedAlarm, undefined, "Manual only must clear the yph-sync-periodic alarm");

  const amountInput = page.locator("#sync-custom-amount");
  const unitSelect = page.locator("#sync-custom-unit");
  await amountInput.fill("2");
  await unitSelect.selectOption("hours");
  await page.getByRole("button", { name: "Set", exact: true }).click();

  await page.waitForFunction(async () => {
    const { yph_sync_config: cfg } = await chrome.storage.local.get("yph_sync_config");
    return cfg?.syncIntervalMinutes === 120;
  });

  const activeAlarm = await worker.evaluate(() => chrome.alarms.get("yph-sync-periodic"));
  assert(activeAlarm, "Custom 2-hour schedule must register yph-sync-periodic in service worker");
  assert.equal(activeAlarm.periodInMinutes, 120, "Periodic alarm periodInMinutes must equal 120");

  assert(
    !requestUrls.some((url) => url.includes("api.github.com")),
    "Extension must never issue outbound requests to api.github.com"
  );
}

module.exports = { verifySyncSchedule };
