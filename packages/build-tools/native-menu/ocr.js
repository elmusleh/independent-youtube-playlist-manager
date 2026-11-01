/**
 * OCR layer for the native menu gate: turn a framebuffer capture into the rows a user
 * would see, without hard-coding any screen coordinates.
 */
"use strict";

const path = require("node:path");
const { SCREEN, capture, run } = require("./display.js");

/** OCR a frame. `invert` is required for the dark menu panels. */
function ocr(file, { offset = { x: 0, y: 0 }, invert = false, psm = "6" } = {}) {
  let source = file;
  if (invert) {
    source = file.replace(/\.png$/, "-inv.png");
    run("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", "format=gray,negate", "-y", source]);
  }
  const text = run("tesseract", [source, "stdout", "--psm", psm]).replace(/\s+/g, " ");
  const tsv = run("tesseract", [source, "stdout", "--psm", psm, "tsv"]);
  const rows = [];
  for (const line of tsv.split("\n").slice(1)) {
    const c = line.split("\t");
    if (Number(c[0]) !== 5 || !c[11] || !c[11].trim()) continue;
    const left = Number(c[6]);
    const top = Number(c[7]);
    const width = Number(c[8]);
    const height = Number(c[9]);
    rows.push({
      text: c[11].trim(),
      x: offset.x + left + width / 2,
      y: offset.y + top + height / 2,
      left: offset.x + left,
      top: offset.y + top,
    });
  }
  return { text, rows };
}

/** Bounding box of the OCR rows that match a probe, using the *largest column-aligned
 * cluster*: browser chrome (tab titles) can contain the same words as a menu row, but it
 * never shares the menu's left edge. */
function locatePanel(rows, probes, pad = 12) {
  const hits = rows.filter((row) =>
    probes.some((probe) => row.text.toLowerCase().includes(probe.toLowerCase()))
  );
  if (hits.length < 2) return null;
  const clusters = [];
  for (const hit of hits) {
    const cluster = clusters.find((group) => Math.abs(group.left - hit.left) <= 24);
    if (cluster) cluster.rows.push(hit);
    else clusters.push({ left: hit.left, rows: [hit] });
  }
  clusters.sort((a, b) => b.rows.length - a.rows.length || b.rows[0].y - a.rows[0].y);
  const chosen = clusters[0].rows;
  if (chosen.length < 2) return null;
  const left = Math.min(...chosen.map((r) => r.left)) - pad;
  const top = Math.min(...chosen.map((r) => r.top)) - pad;
  return {
    x: Math.max(0, Math.round(left)),
    y: Math.max(0, Math.round(top)),
    w: Math.min(SCREEN.width - Math.max(0, left), 520),
    h: Math.min(SCREEN.height - Math.max(0, top), 560),
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

/** The branded row carries a red icon that tesseract mangles. Match it by text when
 * possible, otherwise use the row position: it sits one row above "View page source". */
function brandedRow(rows) {
  const direct = findRow(rows, ["Playlist Manager", "Manager", "Playlist"]);
  if (direct) return direct;
  const anchor = findRow(rows, ["View page source", "page source"]);
  if (!anchor) return null;
  return { ...anchor, y: anchor.y - 36, text: "Playlist Manager (positional)" };
}

/** Capture -> locate panel -> tight inverted crop -> clean OCR. */
function readPanel(display, file, probes) {
  const raw = capture(display, file);
  // Locate on the inverted frame too: on a dark-menu capture the panel is the part that
  // becomes readable, and the light page behind it becomes noise.
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
  // A menu panel mixes labels, icons and shortcut columns; single-column layout (psm 4)
  // recovers rows that psm 6 merges into one garbled line.
  if (panel.rows.length < 3) {
    const alt = ocr(cropFile, { offset: { x: box.x, y: box.y }, invert: true, psm: "4" });
    if (alt.rows.length > panel.rows.length) panel = alt;
  }
  return { ...panel, box, raw, cropFile: path.basename(cropFile) };
}

module.exports = { ocr, locatePanel, findRow, brandedRow, readPanel };
