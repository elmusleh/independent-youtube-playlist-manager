/* eslint-disable no-console */
/* global browser, document, window */
const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");

async function main() {
  const root = path.resolve(__dirname, "../..");
  const output = path.join(root, "dist/verification");
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((_, response) => {
    response.setHeader("Content-Type", "text/html");
    response.setHeader("Content-Security-Policy", "frame-src 'none'");
    response.end(
      '<title>Article fixture</title><a href="https://youtu.be/dQw4w9WgXcQ">One</a><a href="https://youtu.be/abcdefghijk">Two</a><a href="https://youtu.be/dQw4w9WgXcQ">Duplicate</a><iframe src="https://www.youtube.com/embed/zyxwvutsrqp"></iframe>'
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const sourceUrl = `http://127.0.0.1:${server.address().port}/article`;
  const report = [];
  try {
    for (const testFixtureHost of [true, false]) {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-import-chromium-"));
      const extension = path.join(directory, "extension");
      fs.cpSync(path.join(root, "dist/chrome"), extension, { recursive: true });
      const manifest = JSON.parse(fs.readFileSync(path.join(extension, "manifest.json")));
      // Chromium automation cannot invoke the real browser toolbar action. This
      // positive fixture tests the popup workflow using only a test-local host.
      // Firefox's companion test verifies the actual activeTab grant and denial.
      if (testFixtureHost) manifest.host_permissions.push("http://127.0.0.1/*");
      else manifest.permissions = manifest.permissions.filter((p) => p !== "activeTab");
      fs.writeFileSync(path.join(extension, "manifest.json"), JSON.stringify(manifest));
      const context = await chromium.launchPersistentContext(path.join(directory, "profile"), {
        channel: "chromium",
        headless: true,
        args: [
          "--no-sandbox",
          `--load-extension=${extension}`,
          `--disable-extensions-except=${extension}`,
        ],
      });
      try {
        await context.route("https://**/*", (route) => route.abort());
        const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
        const base = worker.url().split("/background/")[0];
        const article = await context.newPage();
        await article.goto(sourceUrl);
        const popup = await context.newPage();
        await popup.goto(base + "/popup/popup.html");
        await popup.waitForFunction(() => !!document.getElementById("import-channel").onclick);
        const result = await popup.evaluate(async (sourceUrl) => {
          window.close = () => {};
          await browser.storage.sync.set({ autoFetchMetadata: false });
          const tab = (await browser.tabs.query({})).find((tab) => tab.url === sourceUrl);
          await browser.tabs.update(tab.id, { active: true });
          await document.getElementById("import-channel").onclick();
          document.getElementById("input-quantity").value = "2";
          document.getElementById("select-order").value = "oldest";
          await document.getElementById("confirm-import").onclick();
          const playlists = await window.getPlaylists();
          return {
            opened: document.getElementById("channel-page").style.display === "block",
            playlists: playlists.map((p) => p.videos),
            error: document.getElementById("page-import-error").textContent,
            retryEnabled: !document.getElementById("confirm-import").disabled,
          };
        }, sourceUrl);
        assert(result.opened);
        if (testFixtureHost) assert.deepEqual(result.playlists, [["abcdefghijk", "dQw4w9WgXcQ"]]);
        else {
          assert.deepEqual(result.playlists, []);
          assert(result.error.includes("toolbar button") && result.retryEnabled);
        }
        report.push({ testFixtureHost, ...result });
      } finally {
        await context.close();
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  fs.writeFileSync(
    path.join(output, "page-import-chromium-report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(
    "PASS: Chromium page import, duplicate handling, limit/reverse and permission-denied error. Positive fixture uses a test-local host grant; see Firefox test for activeTab activation."
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
