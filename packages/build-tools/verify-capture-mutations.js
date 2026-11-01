/* eslint-disable no-console */
// Run only on disposable copies: the working tree is never mutated by this verifier.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "iypm-mutations-"));
const files = [
  "tab-selection.test.js",
  "library-mutations.test.ts",
  "context-menu-model.test.js",
  "context-menu-actions.test.js",
  "link-capture.test.js",
  "capture-retry.test.ts",
];
try {
  for (const folder of ["background", "shared"])
    fs.cpSync(
      path.join(root, "apps/browser-extension", folder),
      path.join(temporary, "apps/browser-extension", folder),
      { recursive: true }
    );
  const source = "apps/browser-extension/playlist-manager/src";
  fs.cpSync(path.join(root, source, "test-support"), path.join(temporary, source, "test-support"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(temporary, source, "utils"), { recursive: true });
  for (const file of files)
    fs.copyFileSync(
      path.join(root, source, "utils", file),
      path.join(temporary, source, "utils", file)
    );
  fs.symlinkSync(path.join(root, "node_modules"), path.join(temporary, "node_modules"), "dir");
  fs.copyFileSync(path.join(root, "vitest.setup.mjs"), path.join(temporary, "vitest.setup.mjs"));
  fs.writeFileSync(
    path.join(temporary, "vitest.config.mjs"),
    'export default { test: { environment: "jsdom", globals: true, setupFiles: ["./vitest.setup.mjs"], include: ["apps/**/*.test.{js,ts}"] } };\n'
  );
  const run = () =>
    spawnSync(
      process.execPath,
      [path.join(root, "node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.config.mjs"],
      { cwd: temporary, encoding: "utf8", timeout: 120000 }
    );
  const baseline = run();
  if (baseline.status !== 0) {
    console.error((baseline.stdout || "").slice(-5000));
    console.error((baseline.stderr || "").slice(-2000));
    throw new Error("Mutation baseline failed. Fix normal tests before evaluating mutations.");
  }
  const mutations = [
    [
      "private-tab exclusion",
      "shared/tab-selection.js",
      "if (tab.incognito) return [];",
      "if (false) return [];",
    ],
    [
      "URL scheme validation",
      "shared/tab-selection.js",
      'if (!["http:", "https:"].includes(parsed.protocol)) return null;',
      "if (false) return null;",
    ],
    ["atomic revision check", "background/library-mutations.js", "actual !== expected", "false"],
    [
      "durable builder storage",
      "background/library-mutations.js",
      "await browser.storage.local.set({",
      "await Promise.resolve({",
    ],
    [
      "saved-menu switch",
      "background/context-menu-model.js",
      'if (savedAllowed) item("saved", "My Playlists");',
      'item("saved", "My Playlists");',
    ],
    [
      "effective destination on capture",
      "background/capture-controller.js",
      '(source === "menu" ? effectiveDestinationMode(settings) : destinationMode(settings, false))',
      'destinationMode(settings, source === "menu")',
    ],
    [
      "link context isolation",
      "shared/link-capture.js",
      'if (context === "link") return parseYouTubeVideoId(info?.linkUrl);',
      'if (context === "link") return parseYouTubeVideoId(info?.linkUrl) || parseYouTubeVideoId(info?.pageUrl);',
    ],
  ];
  let survivors = 0;
  for (const [name, relative, before, after] of mutations) {
    const target = path.join(temporary, "apps/browser-extension", relative);
    const original = fs.readFileSync(target, "utf8");
    if (!original.includes(before))
      throw new Error(`Mutation target changed: ${name}. Update the verifier.`);
    fs.writeFileSync(target, original.replace(before, after));
    const outcome = run();
    fs.writeFileSync(target, original);
    if (outcome.error || outcome.signal || outcome.status === null)
      throw new Error(`Mutation execution failed: ${name}`);
    console.log(`${outcome.status === 0 ? "SURVIVED" : "CAUGHT"}: ${name}`);
    if (outcome.status === 0) survivors++;
  }
  if (survivors) process.exitCode = 1;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
