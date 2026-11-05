/**
 * X11 plumbing for the native menu gate: a private display, framebuffer capture, and the
 * OS-level input the browser's own menu needs (Playwright cannot reach it).
 */
"use strict";

const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");

const SCREEN = { width: 1400, height: 1000 };

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

/** Start a private Xvfb display, or report that none is available. */
async function acquireDisplay() {
  if (process.env.IYPM_NATIVE_DISPLAY) {
    return { display: process.env.IYPM_NATIVE_DISPLAY, stop: () => {} };
  }
  const xvfbBin = process.env.XVFB_BIN || "Xvfb";
  if (!have(xvfbBin)) return null;
  for (let n = 99; n < 110; n += 1) {
    const display = `:${n}`;
    if (fs.existsSync(`/tmp/.X11-unix/X${n}`)) continue;
    const child = spawn(
      xvfbBin,
      [display, "-screen", "0", `${SCREEN.width}x${SCREEN.height}x24`, "-nolisten", "tcp"],
      { stdio: "ignore", detached: true }
    );
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
              /* already gone */
            }
          },
        };
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  return null;
}

/** Grab the whole screen: the menu is a separate popup window, so page screenshots miss it. */
function capture(display, file) {
  run("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "x11grab",
    "-video_size",
    `${SCREEN.width}x${SCREEN.height}`,
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

/** Move onto a menu row in two steps: a single jump does not always fire the hover. */
function hoverRow(display, row, settle = 900) {
  xdo(display, "mousemove", String(Math.round(row.x) - 2), String(Math.round(row.y) - 2));
  return new Promise((resolve) => {
    setTimeout(() => {
      xdo(display, "mousemove", String(Math.round(row.x)), String(Math.round(row.y)));
      setTimeout(resolve, settle);
    }, 120);
  });
}

module.exports = { SCREEN, run, have, acquireDisplay, capture, xdo, hoverRow };
