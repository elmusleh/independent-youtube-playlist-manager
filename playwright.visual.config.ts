import { defineConfig } from "@playwright/test";

/**
 * Visual regression config for the extension SPA.
 *
 * Kept separate from the portal's Playwright config (apps/web-portal/playwright.config.ts)
 * and from the structural extension E2E (packages/build-tools/verify-extension.js). This
 * suite only does pixel baselines of the Settings page and must be deterministic, so it
 * runs single-worker with no retries (a flaky screenshot is a signal, not a retry case).
 */
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    trace: "off",
    actionTimeout: 20000,
  },
  timeout: 60000,
  projects: [
    {
      name: "chromium",
      use: { channel: "chromium" },
    },
  ],
});
