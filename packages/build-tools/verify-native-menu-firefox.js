/* eslint-disable no-console */
/**
 * Firefox native menu pixel check — option A (simplified).
 *
 * Temporary add-on install via web-ext. One purpose: prove Firefox renders
 * the branded root context menu entry ("Playlist Manager").
 *
 * Usage:
 *   npm run test:native-menu-firefox        # verify; screenshots -> dist/verification
 *   npm run test:native-menu-firefox -- --record   # also refresh docs/testing evidence
 *   IYPM_REQUIRE_NATIVE_MENU=1 ...          # no X11 fails instead of skipping
 *   IYPM_NATIVE_DISPLAY=:99 ...             # reuse an existing display
 */
"use strict";

const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { ocr, locatePanel, findRow, shows, brandedRow } = require("./native-menu/shared.js");

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>Native menu fixture</title></head>
<body style="font:16px system-ui;padding:40px"><h1>Native menu fixture</h1>
<p id="p" style="font-size:20px">Right-click this paragraph for the page context.</p></body></html>`;

const PARENT_PROBES = [
  "Save Page As",
  "Select All",
  "Take Screenshot",
  "View Page Source",
  "Inspect",
];

function run(bin, args, options = {}) {
  return execFileSync(bin, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function have(bin) {
  try {
    execFileSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function acquireDisplay() {
  if (process.env.IYPM_NATIVE_DISPLAY)
    return { display: process.env.IYPM_NATIVE_DISPLAY, stop: () => {} };
  const xvfbBin = process.env.XVFB_BIN || "Xvfb";
  if (!have(xvfbBin)) return null;
  for (let n = 99; n < 110; n += 1) {
    const display = `:${n}`;
    if (fs.existsSync(`/tmp/.X11-unix/X${n}`)) continue;
    const child = spawn(xvfbBin, [display, "-screen", "0", "1400x1000x24", "-nolisten", "tcp"], {
      stdio: "ignore",
      detached: true,
    });
    child.unref();
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        run("xdpyinfo", ["-display", display], { env: { ...process.env, DISPLAY: display } });
        return {
          display,
          stop: () => {
            try {
              process.kill(-child.pid, "SIGTERM");
            } catch {
              /* ignore */
            }
          },
        };
      } catch {
        /* ignore */
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  return null;
}

function capture(display, file) {
  run("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "x11grab",
    "-video_size",
    "1400x1000",
    "-i",
    display,
    "-frames:v",
    "1",
    "-y",
    file,
  ]);
  const { size } = fs.statSync(file);
  if (size < 20000) throw new Error(`${file.split("/").pop()} looks blank (${size} bytes)`);
  return file;
}

function xdo(display, ...args) {
  run("xdotool", args, { env: { ...process.env, DISPLAY: display } });
}

function skip(reason) {
  if (process.env.IYPM_REQUIRE_NATIVE_MENU === "1") {
    console.log(`FAIL: ${reason} (IYPM_REQUIRE_NATIVE_MENU=1)`);
    process.exit(1);
  }
  console.log(`SKIP: native menu requires X11 - ${reason}`);
}

async function main() {
  const record = process.argv.includes("--record");
  const missingBin = ["ffmpeg", "tesseract", "xdotool"].find((bin) => !have(bin));
  if (missingBin) {
    skip(`${missingBin} is required`);
    return;
  }
  const displayHandle = await acquireDisplay();
  if (!displayHandle) {
    skip("no X display available (install Xvfb or set IYPM_NATIVE_DISPLAY)");
    return;
  }
  const { display, stop } = displayHandle;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(FIXTURE);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const pageUrl = `http://127.0.0.1:${server.address().port}/`;

  const extDir = path.join(__dirname, "../../dist/firefox");
  if (!fs.existsSync(path.join(extDir, "manifest.json"))) {
    console.log("FAIL: dist/firefox/manifest.json is missing - run `npm run build` first.");
    process.exit(1);
  }

  const output = path.join(__dirname, "../../dist/verification/native-menu-firefox");
  fs.mkdirSync(output, { recursive: true });

  const failures = [];

  const child = spawn(
    "npx",
    [
      "--yes",
      "web-ext@8",
      "run",
      "--source-dir",
      extDir,
      "--firefox",
      "/usr/bin/firefox",
      "--start-url",
      pageUrl,
      "--no-reload",
      "--no-input",
    ],
    { env: { ...process.env, DISPLAY: display } }
  );
  child.stdout.on("data", (chunk) => console.log(chunk.toString().trim()));
  child.stderr.on("data", (chunk) => console.log(chunk.toString().trim()));
  await new Promise((r) => setTimeout(r, 28000));

  // Right-click the paragraph
  for (let i = 0; i < 3; i += 1) {
    xdo(display, "key", "Escape");
    await new Promise((r) => setTimeout(r, 100));
  }
  const pre = capture(display, path.join(output, "ff-pre.png"));
  const preOcr = ocr(pre, { invert: true });
  const para = findRow(preOcr.rows, ["paragraph", "page context", "fixture"]);
  const y = para ? para.top : 220;
  xdo(display, "mousemove", "380", String(y + 14));
  xdo(display, "click", "3");
  await new Promise((r) => setTimeout(r, 800));

  // Read parent menu
  const parent = capture(display, path.join(output, "ff-parent.png"));
  const parentOcr = ocr(parent, { invert: true });
  const box = locatePanel(parentOcr.rows, PARENT_PROBES);
  if (!box)
    failures.push(
      `firefox: native menu was not recognised on screen | OCR: ${parentOcr.text.slice(0, 160)}`
    );
  const recognised = PARENT_PROBES.filter((entry) => shows(parentOcr.rows, entry));
  if (recognised.length < 2)
    failures.push(
      `firefox: only ${recognised.length} standard browser entry recognised - cannot confirm a menu was open`
    );

  const brand = brandedRow(parentOcr.rows);
  if (!brand)
    failures.push(`firefox: no "Playlist Manager" row | OCR: ${parentOcr.text.slice(0, 160)}`);
  else console.log("PASS: Firefox native menu shows branded entry:", brand.text);

  child.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 2000));
  server.close();
  stop();

  if (failures.length) {
    console.log("");
    for (const f of failures) console.log(`FAIL ${f}`);
    console.log(`\n${failures.length} firefox-native-menu check(s) failed.`);
    process.exit(1);
  }
  console.log("\nPASS: Firefox native menu verified (brand root entry present).");
  if (record) {
    const stamp = new Date().toISOString().slice(0, 10);
    const dir = path.join(__dirname, "../../docs/testing", `native-menu-firefox-${stamp}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ["ff-parent"]) {
      const source = path.join(output, `${name}.png`);
      if (fs.existsSync(source)) fs.copyFileSync(source, path.join(dir, `${name}.png`));
    }
    console.log(`recorded evidence -> ${path.relative(__dirname + "/../../..", dir)}`);
  }
}

main().catch((error) => {
  console.log(`FAIL: ${error.message}`);
  process.exit(1);
});
