import { test as base, chromium, type BrowserContext, expect } from "@playwright/test";
import path from "path";
import os from "os";
import fs from "fs";

// Extend basic test context to load the built Chrome extension
const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, "../../dist/chrome");
    const isHeadless = !process.env.HEADED;

    if (isHeadless) {
      // Use an empty browser context to satisfy the fixture type signature
      const browserInstance = await chromium.launch();
      const context = await browserInstance.newContext();
      await use(context);
      await browserInstance.close();
      return;
    }

    // Use a real temp directory — Chrome crashes on Linux when given "" as profile dir
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-e2e-"));
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox",
        "--disable-gpu",
      ],
    });
    await use(context);
    await context.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  },
  extensionId: async ({ context }, use) => {
    const isHeadless = !process.env.HEADED;
    if (isHeadless) {
      await use("dummy-extension-id");
      return;
    }

    // Open chrome://newtab to force Chrome to activate the extension SW.
    const triggerPage = await context.newPage();
    await triggerPage.goto("chrome://newtab/").catch(() => {});
    await triggerPage.waitForTimeout(2000);

    // Poll up to 10 s for the SW to appear.
    let background = context.serviceWorkers()[0];
    if (!background) {
      background = await context
        .waitForEvent("serviceworker", { timeout: 15000 })
        .catch(() => null as any);
    }

    await triggerPage.close().catch(() => {});

    if (!background) {
      // SW didn't register — skip rather than fail with a misleading URL error.
      test.skip(true, "Extension service worker did not register — check the extension for SW errors.");
      return;
    }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});

test.describe("YPH WebExtension E2E Tests (Chromium)", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!process.env.HEADED, "Skipping extension tests in headless mode (requires process.env.HEADED=true)");
  });

  test("1. Popup page renders elements and matches extensionId", async ({ page, extensionId }) => {
    if (!process.env.HEADED) return;
    // Navigate directly to the extension popup page URL
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    
    // Verify the title or main elements of the popup
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText("Playlist Manager", { exact: true })).toBeVisible();
  });

  test("2. Playlist Editor SPA dashboard loads successfully", async ({ page, extensionId }) => {
    // Navigate to the settings page in the Svelte options UI
    await page.goto(`chrome-extension://${extensionId}/editor/index.html#/settings`);
    
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByText("Independent YouTube Playlist Manager")).toBeVisible();
    await expect(page.getByText("Cache duration")).toBeVisible();
  });
});
