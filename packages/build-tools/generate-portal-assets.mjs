#!/usr/bin/env node
/**
 * generate-portal-assets.mjs
 *
 * Regenerates every raster asset the web portal ships from one master file, so the
 * portal never serves a print-resolution original again.
 *
 * Background: `apps/web-portal/assets/icon-master.png` is 1437x1082 / 2.0 MB. It used to
 * be copied into `public/icon.png` *and* `src/app/icon.png`, which made a 28 px navbar
 * logo and the favicon both download two megabytes — the Next image optimizer returns
 * the source unchanged for a file that size, so `/_next/image?url=%2Ficon.png&w=128`
 * still transferred 2,018,306 bytes.
 *
 * Outputs (all committed):
 *   public/logo.webp      160x160   inline logo (navbar + hero), ~5 KB
 *   public/icon.png      512x384   README/raw-GitHub image, ~30 KB
 *   public/og-image.png 1200x630   Open Graph / Twitter card, ~100 KB
 *   src/app/icon.png     192x192   favicon metadata route
 *
 * Usage:
 *   npm run assets:portal            # regenerate
 *   npm run check                    # verify-portal-assets.js enforces the budgets
 *
 * Requires the portal's dependencies (`npm --prefix apps/web-portal ci`) because
 * `sharp` is resolved from that tree. The OG card renders its title through librsvg,
 * so regenerating it on a machine without DejaVu Sans produces a different card —
 * inspect the diff before committing a regenerated card.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const portal = path.join(root, "apps/web-portal");
const portalRequire = createRequire(path.join(portal, "package.json"));

const MASTER = path.join(portal, "assets/icon-master.png");

const OUTPUTS = [
  {
    file: "public/logo.webp",
    note: "inline logo (navbar + hero)",
    build: (img) =>
      img
        .resize(160, 160, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 82, effort: 6 }),
  },
  {
    file: "public/icon.png",
    note: "README / raw.githubusercontent image",
    build: (img) =>
      img.resize({ width: 384 }).png({ palette: true, quality: 88, compressionLevel: 9 }),
  },
  {
    file: "src/app/icon.png",
    note: "favicon metadata route",
    build: (img) =>
      img
        .resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ palette: true, quality: 90, compressionLevel: 9 }),
  },
];

const OG = {
  file: "public/og-image.png",
  note: "Open Graph / Twitter card",
  width: 1200,
  height: 630,
  logoHeight: 420,
};

function formatSize(bytes) {
  return `${bytes} bytes (${(bytes / 1024).toFixed(1)} KiB)`;
}

async function buildOgCard(sharp) {
  const logo = await sharp(MASTER).resize({ height: OG.logoHeight }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();

  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG.width}" height="${OG.height}">
    <rect width="${OG.width}" height="${OG.height}" fill="#ffffff"/>
    <text x="${OG.width / 2}" y="565" text-anchor="middle"
      font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="44" font-weight="bold"
      fill="#18181b">Independent YouTube Playlist Manager</text>
    <text x="${OG.width / 2}" y="607" text-anchor="middle"
      font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="26"
      fill="#71717a">Your playlists. Your device. Your rules.</text>
  </svg>`;

  return sharp({
    create: { width: OG.width, height: OG.height, channels: 4, background: "#ffffff" },
  })
    .composite([
      { input: Buffer.from(card), top: 0, left: 0 },
      { input: logo, top: 60, left: Math.round((OG.width - logoMeta.width) / 2) },
    ])
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(MASTER)) {
    console.error(`[ASSETS] Missing master image: ${path.relative(root, MASTER)}`);
    process.exit(1);
  }

  let sharp;
  try {
    sharp = portalRequire("sharp");
  } catch {
    console.error("[ASSETS] `sharp` is not installed for the web portal.");
    console.error("  Run: npm --prefix apps/web-portal ci");
    process.exit(1);
  }

  console.log(
    `[ASSETS] master ${path.relative(root, MASTER)} — ${formatSize(fs.statSync(MASTER).size)}`
  );

  for (const output of OUTPUTS) {
    const target = path.join(portal, output.file);
    const bytes = await output.build(sharp(MASTER)).toBuffer();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    console.log(
      `[ASSETS] ${output.file.padEnd(20)} ${formatSize(bytes.length).padEnd(26)} ${output.note}`
    );
  }

  const ogBytes = await buildOgCard(sharp);
  const ogTarget = path.join(portal, OG.file);
  fs.writeFileSync(ogTarget, ogBytes);
  console.log(
    `[ASSETS] ${OG.file.padEnd(20)} ${formatSize(ogBytes.length).padEnd(26)} ${OG.note} (${OG.width}x${OG.height})`
  );
}

await main();
