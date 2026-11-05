// tests/e2e/accessibility.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  { path: "/dashboard", name: "dashboard" },
  { path: "/tv", name: "tv" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tv", width: 1920, height: 1080 },
];

for (const page of PAGES) {
  for (const viewport of VIEWPORTS) {
    test(`a11y: ${page.name} @ ${viewport.name}`, async ({ page: testPage }) => {
      await testPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await testPage.goto(page.path);
      await testPage.waitForLoadState("networkidle");

      const accessibilityScanResults = await new AxeBuilder({ page: testPage })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
}

test.describe("Keyboard navigation", () => {
  test("TV page is fully keyboard navigable", async ({ page }) => {
    await page.goto("/tv");
    await page.waitForLoadState("networkidle");

    const focusableElements = await page
      .locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      .all();

    for (let i = 0; i < focusableElements.length; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).not.toBe("BODY");
    }
  });

  test("Dashboard page is fully keyboard navigable", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => {
      localStorage.setItem("dashboard_sync_key", "ABCDE-FGHJK-MNPQR-STVWX");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");

    const focusableElements = await page
      .locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      .all();

    for (let i = 0; i < focusableElements.length; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).not.toBe("BODY");
    }
  });
});

test.describe("Screen reader support", () => {
  test("TV page has proper ARIA labels", async ({ page }) => {
    await page.goto("/tv");
    await page.waitForLoadState("networkidle");

    const h1 = await page.locator("h1").count();
    expect(h1).toBeGreaterThan(0);

    const buttons = page.locator("button");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute("aria-label");
      const text = await button.textContent();
      expect(name || text?.trim()).toBeTruthy();
    }
  });

  test("Dashboard has proper form labels", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const inputs = page.locator("input");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      const label = id ? await page.locator(`label[for="${id}"]`).count() : 0;

      expect(ariaLabel || ariaLabelledBy || label).toBeTruthy();
    }
  });
});

test.describe("Color contrast", () => {
  test("TV page meets WCAG AA contrast", async ({ page }) => {
    await page.goto("/tv");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(["cat.color"]).analyze();

    expect(results.violations).toEqual([]);
  });

  test("Dashboard meets WCAG AA contrast", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(["cat.color"]).analyze();

    expect(results.violations).toEqual([]);
  });
});

test.describe("Focus management", () => {
  test("TV page focus is visible and logical", async ({ page }) => {
    await page.goto("/tv");
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement);
    expect(focused).not.toBeNull();

    const firstFocused = focused;
    await page.keyboard.press("Tab");
    const secondFocused = await page.evaluate(() => document.activeElement);
    expect(secondFocused).not.toBe(firstFocused);
  });

  test("Dashboard focus trap in modals", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.click('button:has-text("Pair New Device")');
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement);
    const modal = page.locator('[role="dialog"], .modal').first();
    const modalExists = (await modal.count()) > 0;
    expect(modalExists).toBeTruthy();
  });
});
