/* eslint-disable no-console */
/* global document, innerWidth, innerHeight, window */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sizes } = require("./extension-fixture.js");

async function main() {
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  const output = path.resolve(__dirname, "../../dist/verification");
  fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://**/*", (route) => route.abort());
    const report = [];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto("http://localhost:3050/");
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `Portal overflows at ${width}px`
      );
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      assert(
        await page.evaluate(
          () => document.querySelector("footer").getBoundingClientRect().bottom <= innerHeight + 1
        ),
        `Footer is clipped at ${width}px`
      );
      report.push({ width, height, passed: true });
      if (width === 390 || width === 1440)
        await page.screenshot({ path: path.join(output, `portal-${width}.png`), fullPage: true });
    }
    for (const method of ["get", "post"]) {
      const response = await page.request[method]("http://localhost:3050/api/sync", {
        headers: { authorization: "Bearer yph_invalid_release_test" },
        ...(method === "post" ? { data: { payload: {} } } : {}),
      });
      assert(
        [401, 503].includes(response.status()),
        "Unconfigured or unauthorized sync reported success"
      );
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, "portal-report.json"),
      JSON.stringify({ layouts: report, syncFailsClosed: true }, null, 2)
    );
    console.log(
      `PASS: portal at ${sizes.length} viewport sizes, reachable footer, no runtime errors, unauthorized/unconfigured sync rejected.`
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
