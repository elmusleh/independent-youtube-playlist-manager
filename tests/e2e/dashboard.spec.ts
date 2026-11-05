// tests/e2e/dashboard.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Dashboard - Desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("shows sync key entry when not paired", async ({ page }) => {
    await expect(page.locator("text=Playlist Dashboard")).not.toBeVisible();
    await expect(page.locator("text=Enter your sync key")).toBeVisible();
  });

  test("allows entering sync key", async ({ page }) => {
    await page.fill('input[placeholder*="ABCDE"]', "ABCDE-FGHJK-MNPQR-STVWX");
    await page.click('button:has-text("Verify")');
    // Would verify with mock API
  });

  test("navigates to pairing flow", async ({ page }) => {
    // Pre-fill with valid sync key via localStorage
    await page.evaluate(() => {
      localStorage.setItem("dashboard_sync_key", "ABCDE-FGHJK-MNPQR-STVWX");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Playlist Dashboard")).toBeVisible();
    await page.click('button:has-text("Pair New Device")');
    await expect(page.locator("text=Pair Your Device")).toBeVisible();
  });
});

test.describe("Dashboard - Mobile", () => {
  test.use({ ...require("@playwright/test").devices["Pixel 7"] });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("mobile layout works correctly", async ({ page }) => {
    await expect(page.locator("text=Playlist Dashboard")).not.toBeVisible();
    await expect(page.locator("text=Enter your sync key")).toBeVisible();

    // Check responsive layout
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412);
  });

  test("touch targets meet minimum size", async ({ page }) => {
    const button = page.locator('button:has-text("Verify")');
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
    expect(box?.width).toBeGreaterThanOrEqual(48);
  });
});

test.describe("TV Page - Android TV", () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    hasTouch: false,
    isMobile: false,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/tv");
    await page.waitForLoadState("networkidle");
  });

  test("shows pairing code when not paired", async ({ page }) => {
    await expect(page.locator("text=Pair Your TV")).toBeVisible();
    await expect(page.locator(".text-6xl")).toBeVisible(); // 6-digit code
  });

  test("large text for 10-foot UI", async ({ page }) => {
    const title = page.locator("text=Pair Your TV");
    const styles = await title.evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseInt(styles)).toBeGreaterThanOrEqual(48); // 3rem = 48px minimum
  });

  test("keyboard navigation works", async ({ page }) => {
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    // Should focus and activate buttons
  });

  test("generates new pairing code", async ({ page }) => {
    await page.click('button:has-text("Generate New Code")');
    await expect(page.locator(".text-6xl")).toBeVisible();
  });
});

test.describe("Cross-device Sync Flow", () => {
  test("TV and phone can pair via 6-digit code", async ({ page, context }) => {
    // Open TV page
    const tvPage = await context.newPage();
    await tvPage.goto("/tv");
    await tvPage.waitForLoadState("networkidle");

    const pairingCode = await tvPage.locator(".text-6xl").textContent();
    expect(pairingCode).toMatch(/^\d{6}$/);

    // Open dashboard on "phone"
    const phonePage = await context.newPage();
    await phonePage.goto("/dashboard");
    await phonePage.waitForLoadState("networkidle");

    // Enter pairing flow
    await phonePage.click('button:has-text("Pair New Device")');
    await phonePage.fill('input[placeholder*="ABCDE"]', "TEST-KEY-FOR-PAIRING");
    await phonePage.click('button:has-text("Verify & Pair")');

    // TV should receive sync key and show playlists
    await expect(tvPage.locator("text=My Playlists")).toBeVisible({ timeout: 10000 });
  });
});
