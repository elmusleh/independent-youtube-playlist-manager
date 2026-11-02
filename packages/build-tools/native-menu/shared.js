/**
 * Shared OCR + panel location for native menu gates (Chromium + Firefox).
 * Both gates use the same word→row→panel pipeline; only the probes and Firefox
 * installation differ.
 */
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SCREEN = { width: 1400, height: 1000 };
const CHROME_BOTTOM = 120;
const LEFT_TOL = 40;
const ROW_GAP = 90;
const COLUMN_GAP = 34;

function run(bin, args, options = {}) {
  return execFileSync(bin, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

/** OCR + group words -> rows split at column gutters. */
function ocr(file, { offset = { x: 0, y: 0 }, invert = false, psm = "6" } = {}) {
  let source = file;
  if (invert) {
    source = file.replace(/\.png$/, "-inv.png");
    run("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", "format=gray,negate", "-y", source]);
  }
  const text = run("tesseract", [source, "stdout", "--psm", psm]).replace(/\s+/g, " ");
  const tsv = run("tesseract", [source, "stdout", "--psm", psm, "tsv"]);

  const lines = new Map();
  for (const entry of tsv.split("\n").slice(1)) {
    const c = entry.split("\t");
    if (Number(c[0]) !== 5 || !c[11] || !c[11].trim()) continue;
    const key = `${c[2]}-${c[3]}-${c[4]}`;
    const left = Number(c[6]);
    const word = { text: c[11].trim(), left, right: left + Number(c[8]) };
    if (!lines.has(key))
      lines.set(key, { words: [], top: Number(c[7]), bottom: Number(c[7]) + Number(c[9]) });
    const line = lines.get(key);
    line.words.push(word);
    line.top = Math.min(line.top, Number(c[7]));
    line.bottom = Math.max(line.bottom, Number(c[7]) + Number(c[9]));
  }
  const rows = [];
  for (const line of lines.values()) {
    const words = line.words.slice().sort((a, b) => a.left - b.left);
    let segment = [];
    const flush = () => {
      if (!segment.length) return;
      const left = Math.min(...segment.map((w) => w.left));
      const right = Math.max(...segment.map((w) => w.right));
      rows.push({
        text: segment.map((w) => w.text).join(" "),
        x: offset.x + (left + right) / 2,
        y: offset.y + (line.top + line.bottom) / 2,
        left: offset.x + left,
        top: offset.y + line.top,
      });
      segment = [];
    };
    for (const word of words) {
      const previous = segment[segment.length - 1];
      if (previous && word.left - previous.right > COLUMN_GAP) flush();
      segment.push(word);
    }
    flush();
  }
  rows.sort((a, b) => a.y - b.y);
  return { text, rows };
}

function locatePanel(rows, probes, pad = 12) {
  const usable = rows.filter((row) => row.top >= CHROME_BOTTOM);
  const hits = usable.filter((row) =>
    probes.some((probe) => row.text.toLowerCase().includes(probe.toLowerCase()))
  );
  if (hits.length < 2) return null;
  const edges = [];
  for (const hit of hits) {
    const edge = edges.find((group) => Math.abs(group.left - hit.left) <= LEFT_TOL);
    if (edge) edge.rows.push(hit);
    else edges.push({ left: hit.left, rows: [hit] });
  }
  edges.sort((a, b) => b.rows.length - a.rows.length);
  const anchor = edges[0];
  if (anchor.rows.length < 2) return null;
  const anchorLeft = anchor.rows[0].left;
  const column = usable
    .filter((row) => Math.abs(row.left - anchorLeft) <= LEFT_TOL)
    .sort((a, b) => a.y - b.y);
  const seedIndex = column.findIndex((row) => anchor.rows.includes(row));
  if (seedIndex < 0) return null;
  let first = seedIndex;
  let last = seedIndex;
  while (first > 0 && column[first].y - column[first - 1].y <= ROW_GAP) first -= 1;
  while (last < column.length - 1 && column[last + 1].y - column[last].y <= ROW_GAP) last += 1;
  const run = column.slice(first, last + 1);
  if (run.length < 2) return null;
  const left = Math.min(...run.map((r) => r.left)) - pad;
  const top = Math.min(...run.map((r) => r.top)) - pad - 44;
  const bottom = Math.max(...run.map((r) => r.top)) + pad + 20;
  return {
    x: Math.max(0, Math.round(left)),
    y: Math.max(0, Math.round(top)),
    w: Math.min(SCREEN.width - Math.max(0, left), 560),
    h: Math.min(SCREEN.height - Math.max(0, top), Math.max(60, Math.round(bottom - top))),
  };
}

function findRow(rows, fragments) {
  for (const fragment of fragments) {
    const parts = fragment.toLowerCase().split(/\s+/);
    const hit = rows.find((row) => parts.every((part) => row.text.toLowerCase().includes(part)));
    if (hit) return hit;
  }
  const first = fragments[0].toLowerCase().split(/\s+/)[0];
  return rows.find((row) => row.text.toLowerCase().includes(first)) || null;
}

function squash(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function similarity(a, b) {
  if (a === b) return 1;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return 1 - rows[a.length][b.length] / Math.max(a.length, b.length);
}
function shows(rows, label) {
  const wanted = squash(label);
  if (!wanted) return false;
  const tolerance = wanted.length <= 8 ? 0.9 : 0.85;
  return rows.some((row) => {
    const hay = squash(row.text);
    if (!hay) return false;
    if (hay.includes(wanted)) return true;
    const shortest = Math.max(4, wanted.length - 3);
    for (let length = shortest; length <= wanted.length + 3; length += 1) {
      for (let start = 0; start + length <= hay.length; start += 1) {
        if (similarity(wanted, hay.slice(start, start + length)) >= tolerance) return true;
      }
    }
    return false;
  });
}

function readPanel(display, captureFn, file, probes) {
  const raw = captureFn(display, file);
  const coarse = ocr(raw, { invert: true });
  const box = locatePanel(coarse.rows, probes);
  if (!box) return { text: coarse.text, rows: [], box: null };
  const cropFile = file.replace(/\.png$/, "-crop.png");
  run("ffmpeg", [
    "-loglevel",
    "error",
    "-i",
    raw,
    "-vf",
    `crop=${box.w}:${box.h}:${box.x}:${box.y}`,
    "-y",
    cropFile,
  ]);
  let panel = ocr(cropFile, { offset: { x: box.x, y: box.y }, invert: true });
  if (panel.rows.length < 3) {
    const alt = ocr(cropFile, { offset: { x: box.x, y: box.y }, invert: true, psm: "4" });
    if (alt.rows.length > panel.rows.length) panel = alt;
  }
  return { ...panel, box, raw, cropFile: path.basename(cropFile) };
}

function brandedRow(rows) {
  const direct = findRow(rows, ["Playlist Manager", "Manager", "Playlist"]);
  if (direct) return direct;
  const anchor = findRow(rows, ["View Page Source", "View page source", "Inspect"]);
  if (!anchor) return null;
  return { ...anchor, y: anchor.y - 36, text: "Playlist Manager (positional)" };
}

module.exports = {
  SCREEN,
  ocr,
  locatePanel,
  findRow,
  shows,
  readPanel,
  brandedRow,
};
