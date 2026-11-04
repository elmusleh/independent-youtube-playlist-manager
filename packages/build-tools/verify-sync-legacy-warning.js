/* global chrome */
const assert = require("node:assert/strict");

const LEGACY_CONFIG = {
  syncKey: "ABCDEFGHIJKLMNOPQRST",
  backend: "relay",
  syncRevision: 3,
  lastSyncedAt: 1234,
  content: { playlists: true, settings: false, history: false },
};

async function verifySyncLegacyWarning(page, base, requestUrls) {
  requestUrls.length = 0;
  await page.evaluate(
    (config) =>
      new Promise((resolve) => chrome.storage.local.set({ yph_sync_config: config }, resolve)),
    LEGACY_CONFIG
  );
  await page.goto(`${base}/editor/index.html#/sync`);

  const warning = page.getByTestId("legacy-sync-warning");
  await warning.waitFor();
  assert.match(
    await warning.innerText(),
    /hosted legacy v1 snapshot table is currently unavailable/i
  );
  assert.match(await warning.innerText(), /export a full JSON backup from every device/i);
  const continueButton = warning.getByRole("button", {
    name: "Continue with sync v2",
    exact: true,
  });
  const acknowledgement = warning.getByRole("checkbox");
  assert.equal(await continueButton.isDisabled(), true, "Acknowledgement must be explicit");
  assert.equal(
    requestUrls.filter((url) => /\/rest\/v1\/rpc\/sync_(claim|pull|push)/.test(url)).length,
    0,
    "Legacy warning must appear before any relay request"
  );

  await acknowledgement.check();
  assert.equal(await continueButton.isDisabled(), false);
  await continueButton.click();
  await page.waitForFunction(async () => {
    const { yph_sync_config: config } = await chrome.storage.local.get("yph_sync_config");
    return (
      Number.isSafeInteger(config?.legacyV2AcknowledgedAt) && config.legacyV2AcknowledgedAt > 0
    );
  });
  await warning.waitFor({ state: "detached" });
}

module.exports = { verifySyncLegacyWarning };
