/* eslint-disable no-console */
/**
 * Guards Firefox MV3 background reliability (#29, #30):
 * 1. Scans extension `.js`, `.ts`, `.svelte` source files for unguarded `.window =`
 *    assignments (which throw `TypeError: setting getter-only property "window"` in
 *    Firefox SpiderMonkey Window contexts).
 * 2. Boots `dist/firefox/background/index.js` inside a headless browser Window with
 *    a native-Promise Firefox `browser` stub (`runtime.getBrowserInfo`), verifying:
 *    - zero module-evaluation / runtime errors,
 *    - `window.syncEngine` mounted and retired `supabaseGetSession` absent,
 *    - trusted extension sender receives native Promise responses,
 *    - untrusted web/content-script sender (`https://www.youtube.com/...`) is rejected.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const ALLOWED_GUARDED_WINDOW_FILES = new Set([
  "apps/browser-extension/background/init.js",
  "apps/browser-extension/playlist-manager/src/services/sync-engine-registration.ts",
]);

function walkSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "editor") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (/\.(js|ts|svelte)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function verifyNoUnguardedWindowAssignments() {
  const files = walkSourceFiles(path.join(root, "apps/browser-extension"));
  const violations = [];
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(\/\/|\*)/.test(line)) continue;
      if (!/\.window\s*=[^=]/.test(line)) continue;
      const prev = lines[i - 1] || "";
      const guarded =
        ALLOWED_GUARDED_WINDOW_FILES.has(rel) &&
        /typeof\s+.*\.window\s*===\s*"undefined"/.test(prev);
      if (!guarded) {
        violations.push(`${rel}:${i + 1}: unguarded .window assignment: ${line.trim()}`);
      }
    }
  }
  if (violations.length > 0) {
    throw new Error(`Firefox Window getter-only safety violations:\n${violations.join("\n")}`);
  }
}

function mimeFor(filePath) {
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs"))
    return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

async function verifyBuiltFirefoxBackgroundBundle() {
  const distFirefox = path.join(root, "dist/firefox");
  if (!fs.existsSync(path.join(distFirefox, "background/index.js"))) {
    throw new Error("dist/firefox/background/index.js not found; run `npm run build` first.");
  }

  const { chromium, firefox } = require("playwright");
  const server = http.createServer((req, res) => {
    const reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (reqPath === "/__bg_boot.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end('<!doctype html><script type="module" src="/background/index.js"></script>');
      return;
    }
    const target = path.resolve(distFirefox, "." + reqPath);
    if (!target.startsWith(distFirefox + path.sep) || !fs.existsSync(target)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeFor(target) });
    res.end(fs.readFileSync(target));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const useFirefox = fs.existsSync(firefox.executablePath());
  const browserType = useFirefox ? firefox : chromium;
  const browser = await browserType.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message || String(err)));

    await page.addInitScript((baseOrigin) => {
      const EXT_ID = "independent-yt-playlist-manager@elmusleh.github.io";
      const msgListeners = [];
      const store = {};
      const makeEvent = (bucket) => ({
        addListener: (fn) => {
          if (bucket) bucket.push(fn);
        },
        removeListener: () => {},
        hasListener: () => false,
      });
      const browserStub = {
        runtime: {
          id: EXT_ID,
          getURL: (p = "") => `${baseOrigin}/${String(p).replace(/^\//, "")}`,
          getManifest: () => ({ version: "1.3.0", manifest_version: 3 }),
          getBrowserInfo: async () => ({ name: "Firefox", vendor: "Mozilla", version: "140.0" }),
          onInstalled: makeEvent(),
          onStartup: makeEvent(),
          onMessage: makeEvent(msgListeners),
          sendMessage: async () => undefined,
        },
        storage: {
          local: {
            get: async (keys) => {
              if (!keys) return { ...store };
              if (typeof keys === "string") return { [keys]: store[keys] };
              const out = {};
              for (const k of Array.isArray(keys) ? keys : Object.keys(keys)) {
                out[k] = k in store ? store[k] : keys[k];
              }
              return out;
            },
            set: async (obj) => {
              Object.assign(store, obj);
            },
            remove: async (keys) => {
              for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
            },
          },
          sync: {
            get: async () => ({}),
            set: async () => {},
          },
          onChanged: makeEvent(),
        },
        alarms: {
          clear: async () => true,
          create: () => {},
          get: async () => undefined,
          onAlarm: makeEvent(),
        },
        contextMenus: {
          create: () => {},
          removeAll: async () => {},
          onClicked: makeEvent(),
        },
        menus: {
          create: () => {},
          removeAll: async () => {},
          onClicked: makeEvent(),
        },
        action: {
          setBadgeText: async () => {},
          setBadgeBackgroundColor: async () => {},
          onClicked: makeEvent(),
        },
        tabs: {
          query: async () => [],
          onUpdated: makeEvent(),
          onActivated: makeEvent(),
        },
        commands: { onCommand: makeEvent() },
        notifications: { create: async () => "" },
        permissions: {
          contains: async () => true,
          request: async () => true,
          onAdded: makeEvent(),
          onRemoved: makeEvent(),
        },
      };
      globalThis.__firefoxMsgListeners = msgListeners;
      globalThis.browser = browserStub;
      globalThis.chrome = browserStub;
    }, origin);

    await page.goto(`${origin}/__bg_boot.html`, { waitUntil: "networkidle" });
    assert.deepEqual(pageErrors, [], `Firefox background bundle threw on boot: ${pageErrors}`);

    const check = await page.evaluate(async (baseOrigin) => {
      const EXT_ID = "independent-yt-playlist-manager@elmusleh.github.io";
      const listeners = globalThis.__firefoxMsgListeners || [];
      const trustedSender = { id: EXT_ID, url: `${baseOrigin}/editor/index.html#/sync` };
      const untrustedWebSender = {
        id: EXT_ID,
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      };

      let statusPromiseResult = null;
      let returnedPromise = false;
      for (const fn of listeners) {
        const out = fn({ cmd: "sync-status" }, trustedSender, () => {});
        if (out && typeof out.then === "function") {
          returnedPromise = true;
          statusPromiseResult = await out;
        }
      }

      let untrustedAccepted = false;
      for (const fn of listeners) {
        const out = fn({ cmd: "sync-now" }, untrustedWebSender, () => {
          untrustedAccepted = true;
        });
        if (out !== undefined) untrustedAccepted = true;
      }

      return {
        hasSyncEngine: typeof globalThis.window?.syncEngine?.runOnce === "function",
        hasRetiredV1Session: typeof globalThis.window?.supabaseGetSession !== "undefined",
        returnedPromise,
        phase: statusPromiseResult?.phase ?? null,
        untrustedAccepted,
      };
    }, origin);

    assert.equal(check.hasSyncEngine, true, "window.syncEngine must mount on Firefox background");
    assert.equal(check.hasRetiredV1Session, false, "Retired v1 supabase-sync must not be loaded");
    assert.equal(check.returnedPromise, true, "Firefox MV3 onMessage must return a native Promise");
    assert.equal(check.phase, "idle", "Initial sync-status phase must be idle");
    assert.equal(
      check.untrustedAccepted,
      false,
      "Content-script/https senders must be rejected by sync-now"
    );
    console.log(
      `PASS: Firefox background bundle booted cleanly (${useFirefox ? "SpiderMonkey" : "Chromium Window harness"}); native Promise & sender guards verified.`
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  verifyNoUnguardedWindowAssignments();
  if (process.argv.includes("--source-only")) return;
  await verifyBuiltFirefoxBackgroundBundle();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
