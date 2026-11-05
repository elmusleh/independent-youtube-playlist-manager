// tests/e2e/visual.spec.ts
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  {
    name: "tv",
    width: 1920,
    height: 1080,
    userAgent: "Mozilla/5.0 (Linux; Android 13; TV) AppleWebKit/537.36",
  },
];

const PAGES = [
  { path: "/dashboard", name: "dashboard" },
  { path: "/tv", name: "tv" },
];

for (const viewport of VIEWPORTS) {
  for (const page of PAGES) {
    test(`visual: ${page.name} @ ${viewport.name}`, async ({ page: testPage }) => {
      await testPage.setViewportSize({ width: viewport.width, height: viewport.height });
      if (viewport.userAgent) {
        await testPage.setExtraHTTPHeaders({ "User-Agent": viewport.userAgent });
      }

      await testPage.goto(page.path);
      await testPage.waitForLoadState("networkidle");
      await testPage.waitForTimeout(1000); // Allow animations to settle

      await expect(testPage).toHaveScreenshot(`${page.name}-${viewport.name}.png`, {
        fullPage: true,
        animations: "disabled",
        threshold: 0.2,
      });
    });
  }
}

test.describe("Dark mode visual regression", () => {
  for (const viewport of VIEWPORTS) {
    for (const page of PAGES) {
      test(`visual dark: ${page.name} @ ${viewport.name}`, async ({ page: testPage }) => {
        await testPage.setViewportSize({ width: viewport.width, height: viewport.height });
        if (viewport.userAgent) {
          await testPage.setExtraHTTPHeaders({ "User-Agent": viewport.userAgent });
        }

        await testPage.emulateMedia({ colorScheme: "dark" });
        await testPage.goto(page.path);
        await testPage.waitForLoadState("networkidle");
        await testPage.waitForTimeout(1000);

        await expect(testPage).toHaveScreenshot(`${page.name}-${viewport.name}-dark.png`, {
          fullPage: true,
          animations: "disabled",
          threshold: 0.2,
        });
      });
    }
  }
});
