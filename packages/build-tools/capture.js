// Captures real screenshots of the built Chrome extension (headed Chromium via Xvfb).
// Seeds a realistic demo playlist into the extension's local storage so the
// editor/saved views render actual content, then screenshots each view.
/* global browser, indexedDB */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

let extId = "lppdplclfhchgkgckfmkopomahlpfjok"; // default fallback
const pathToExtension = path.resolve(__dirname, "../../dist/chrome");
const OUT = path.resolve(__dirname, "../../docs/screenshots");
fs.mkdirSync(OUT, { recursive: true });

const DEMO_PLAYLISTS = [
  {
    id: "local-demo-mix",
    title: "My Coding Mix",
    videos: [
      "8aGhZQkoFbQ",
      "30LWjhZzg50",
      "i53Gi_K3o7I",
      "w7i4amO_zaE",
      "dQw4w9WgXcQ",
    ],
    loadedVideos: [
      {
        id: "8aGhZQkoFbQ",
        videoId: "8aGhZQkoFbQ",
        url: "https://www.youtube.com/watch?v=8aGhZQkoFbQ",
        title: "What the heck is the event loop anyway?",
        channel: "Philip Roberts",
        thumbnailUrl: "https://i.ytimg.com/vi/8aGhZQkoFbQ/hqdefault.jpg",
        duration: "PT26M53S",
        durationSeconds: 1613,
        viewCount: 3400000,
        publishedAt: "2014-10-09T00:00:00Z",
      },
      {
        id: "30LWjhZzg50",
        videoId: "30LWjhZzg50",
        url: "https://www.youtube.com/watch?v=30LWjhZzg50",
        title: "Learn TypeScript – Full Tutorial",
        channel: "freeCodeCamp.org",
        thumbnailUrl: "https://i.ytimg.com/vi/30LWjhZzg50/hqdefault.jpg",
        duration: "PT4H46M",
        durationSeconds: 17160,
        viewCount: 5400000,
        publishedAt: "2022-12-20T00:00:00Z",
      },
      {
        id: "i53Gi_K3o7I",
        videoId: "i53Gi_K3o7I",
        url: "https://www.youtube.com/watch?v=i53Gi_K3o7I",
        title: "System Design Interview – Step By Step Guide",
        channel: "System Design Interview",
        thumbnailUrl: "https://i.ytimg.com/vi/i53Gi_K3o7I/hqdefault.jpg",
        duration: "PT32M",
        durationSeconds: 1920,
        viewCount: 1200000,
        publishedAt: "2023-01-15T00:00:00Z",
      },
      {
        id: "w7i4amO_zaE",
        videoId: "w7i4amO_zaE",
        url: "https://www.youtube.com/watch?v=w7i4amO_zaE",
        title: "Vim in 100 Seconds",
        channel: "Fireship",
        thumbnailUrl: "https://i.ytimg.com/vi/w7i4amO_zaE/hqdefault.jpg",
        duration: "PT2M32S",
        durationSeconds: 152,
        viewCount: 2100000,
        publishedAt: "2021-08-01T00:00:00Z",
      },
      {
        id: "dQw4w9WgXcQ",
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "How JavaScript Works Behind the Scenes",
        channel: "JS Deep Dive",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        duration: "PT18M10S",
        durationSeconds: 1090,
        viewCount: 880000,
        publishedAt: "2022-03-12T00:00:00Z",
      },
    ],
    timestamp: Date.now() - 86400000,
    saved: true,
    isLocal: true,
  },
  {
    id: "local-demo-focus",
    title: "Deep Focus",
    videos: ["jNQXAC9IVRw", "kJQP7kiw5Fk"],
    loadedVideos: [
      {
        id: "jNQXAC9IVRw",
        videoId: "jNQXAC9IVRw",
        url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        title: "Me at the zoo",
        channel: "jawed",
        thumbnailUrl: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
        duration: "PT19S",
        durationSeconds: 19,
        viewCount: 320000000,
        publishedAt: "2005-04-23T00:00:00Z",
      },
      {
        id: "kJQP7kiw5Fk",
        videoId: "kJQP7kiw5Fk",
        url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
        title: "Lo-fi hip hop radio 📚 beats to relax/study to",
        channel: "Lofi Girl",
        thumbnailUrl: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
        duration: "PT1H2M3S",
        durationSeconds: 3723,
        viewCount: 150000000,
        publishedAt: "2020-02-01T00:00:00Z",
      },
    ],
    timestamp: Date.now() - 172800000,
    saved: true,
    isLocal: true,
  },
];

async function seed(page) {
  await page.evaluate(async (playlists) => {
    // browser is available via webextension-polyfill on extension pages
    await browser.storage.local.set({ yph_local_playlists: playlists });

    // Seed the IndexedDB metadata cache (yph:meta:<id>) so titles render instantly.
    const META = {};
    for (const p of playlists) {
      for (const v of p.loadedVideos || []) {
        META[v.videoId] = {
          videoId: v.videoId,
          title: v.title,
          channel: v.channel,
          durationSeconds: v.durationSeconds,
          viewCount: v.viewCount,
          publishedAt: v.publishedAt,
          isPrivate: false, isDeleted: false, isBroken: false, isLive: false,
          lastCachedAt: Date.now(),
        };
      }
    }
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("yph_metadata_db_v2", 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("metadata")) db.createObjectStore("metadata");
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("metadata", "readwrite");
        const store = tx.objectStore("metadata");
        for (const [id, meta] of Object.entries(META)) {
          store.put(meta, "yph:meta:" + id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, DEMO_PLAYLISTS);
  console.log("[seed] wrote", DEMO_PLAYLISTS.length, "demo playlists + metadata");
}

(async () => {
  const profileDir = `/tmp/yph-shots-${Date.now()}`;
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    timeout: 60000,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      "--no-sandbox",
      "--disable-gpu",
    ],
  });

  // Wait for the extension's service worker so storage APIs are ready.
  try {
    let [bg] = context.serviceWorkers();
    if (!bg) bg = await context.waitForEvent("serviceworker", { timeout: 10000 });
    console.log("[init] service worker:", bg.url());
    extId = bg.url().split("/")[2];
    console.log("[init] dynamically resolved extension ID:", extId);
  } catch (e) {
    console.warn("[init] warning: service worker event not caught, proceeding anyway:", e.message);
  }

  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Seed then load the editor
  const base = `chrome-extension://${extId}/editor/index.html`;
  await page.goto(`${base}#/settings`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await seed(page);

  const routes = [
    ["01-editor", "#/playlist?id=local-demo-mix"],
    ["02-saved-playlists", "#/saved"],
    ["03-new-playlist", "#/new"],
    ["04-settings", "#/settings"],
    ["05-shortcuts", "#/shortcuts"],
    ["06-history", "#/history"],
  ];

  for (const [name, hash] of routes) {
    try {
      await page.goto(`${base}${hash}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3500);
      // Dismiss any skeleton loaders by waiting for them to clear.
      await page.waitForSelector(".skeleton-shimmer", { state: "detached", timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.resolve(OUT, `screenshot-${name}.png`) });
      console.log("[capture]", name, "ok");
    } catch (e) {
      console.error("[capture]", name, "FAILED:", e.message);
    }
  }

  // Capture promotional store banners from HTML templates
  const promoRoutes = [
    {
      name: "marquee-promo-1400x560.png",
      template: "../../docs/assets/templates/marquee-promo-1400x560.html",
      width: 1400,
      height: 560
    },
    {
      name: "small-promo-440x280.png",
      template: "../../docs/assets/templates/small-promo-440x280.html",
      width: 440,
      height: 280
    }
  ];

  const promoPage = await context.newPage();
  for (const promo of promoRoutes) {
    try {
      const templatePath = path.resolve(__dirname, promo.template);
      await promoPage.setViewportSize({ width: promo.width, height: promo.height });
      await promoPage.goto("file://" + templatePath, { waitUntil: "networkidle", timeout: 30000 });
      await promoPage.waitForTimeout(1000); // Allow fonts/images to fully settle
      const outPath = path.resolve(__dirname, "../../docs/assets", promo.name);
      await promoPage.screenshot({ path: outPath });
      console.log("[capture] promo banner", promo.name, "ok");
    } catch (e) {
      console.error("[capture] promo banner", promo.name, "FAILED:", e.message);
    }
  }

  await context.close();
  console.log("done");
})();
