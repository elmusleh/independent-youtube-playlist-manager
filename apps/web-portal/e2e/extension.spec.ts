import { test as base, chromium, type BrowserContext, expect } from "@playwright/test";
import path from "path";

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

    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const isHeadless = !process.env.HEADED;
    if (isHeadless) {
      await use("dummy-extension-id");
      return;
    }
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
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
    await expect(page.getByText("Playlist Helper", { exact: true })).toBeVisible();
  });

  test("2. Playlist Editor SPA dashboard loads successfully", async ({ page, extensionId }) => {
    // Navigate to the settings page in the Svelte options UI
    await page.goto(`chrome-extension://${extensionId}/editor/index.html#/settings`);
    
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByText("Independent YouTube Playlist Manager")).toBeVisible();
    await expect(page.getByText("Cache duration")).toBeVisible();
  });
});
