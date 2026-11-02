/**
 * OCR layer for the native menu gate: turn a framebuffer capture into the rows a user
 * would see, without hard-coding any screen coordinates.
 */
"use strict";

const path = require("node:path");
const { SCREEN, capture, run } = require("./display.js");

/** Horizontal gap that separates two menu columns sharing a baseline (px). Word spacing is
 * a few pixels; the gutter between a menu and its submenu is tens. */
const COLUMN_GAP = 34;

/** OCR a frame. `invert` is required for the dark menu panels. */
function ocr(file, { offset = { x: 0, y: 0 }, invert = false, psm = "6" } = {}) {
  let source = file;
  if (invert) {
    source = file.replace(/\.png$/, "-inv.png");
    run("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", "format=gray,negate", "-y", source]);
  }
  const text = run("tesseract", [source, "stdout", "--psm", psm]).replace(/\s+/g, " ");
  const tsv = run("tesseract", [source, "stdout", "--psm", psm, "tsv"]);
  // Group words into rows. tesseract emits one level-5 entry per word, and it groups a
  // whole visual line into one entry: a menu row and the submenu row beside it share a
  // baseline, so both arrive as ONE line ("View page source Add YouTube tabs to ...").
  // Split each line again wherever the horizontal gap is too wide to be word spacing.
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

/** Rows inside the menu: browser chrome (the tab strip, at the very top) never belongs
 * to a page context menu, and its tab titles can contain the same words as a menu label. */
const CHROME_BOTTOM = 120;
/** Menu rows drift horizontally (icons of different widths) and groups are separated by a
 * blank line rather than a rule, so both tolerances have to be generous. Page text is
 * left-aligned far from the menu column, so widening them cannot drag the page in. */
const LEFT_TOL = 40;
const ROW_GAP = 90;

/** Bounding box of the panel that contains `probes`.
 *
 * Menus are a single left-aligned column of contiguous rows, so: pick the left edge the
 * probe hits agree on, then grow the *vertical run* of rows sharing that edge around them.
 * Growing by run (not by hit) is what keeps the crop on the whole panel: the probes may
 * only match its lower half, and clipping there silently drops the labels above.
 */
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

  // Generous top/bottom margin: the row above the first located one is often a label the
  // coarse pass missed (the first row of a submenu), and clipping it reads as "missing".
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
