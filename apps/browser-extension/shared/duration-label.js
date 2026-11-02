/**
 * Convert the duration labels shown on YouTube playlist/channel cards
 * ("4:20", "1:02:03", "LIVE") into the ISO-8601 form used by the metadata cache.
 *
 * Returns "" for unknown/empty labels and "LIVE" for live badges. A label of
 * "0:00" is treated as unknown: it is almost always a placeholder, and caching
 * it as a real zero-length duration would hide the gap forever.
 */

/** @param {string} label @returns {number} */
export function durationLabelToSeconds(label) {
  const raw = typeof label === "string" ? label.trim() : "";
  if (!raw || /^live$/i.test(raw)) return 0;
  if (!/^\d+(?::\d{1,2}){1,2}$/.test(raw)) return 0;
  const total = raw
    .split(":")
    .map(Number)
    .reduce((acc, part) => acc * 60 + part, 0);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/** @param {number} seconds @returns {string} */
export function secondsToISO(seconds) {
  const value = Math.round(Number(seconds));
  if (!Number.isFinite(value) || value <= 0) return "";
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return "PT" + (h ? `${h}H` : "") + (m ? `${m}M` : "") + (s || (!h && !m) ? `${s}S` : "");
}

/** @param {string} label @returns {string} */
export function durationLabelToISO(label) {
  const raw = typeof label === "string" ? label.trim() : "";
  if (!raw) return "";
  if (/^live$/i.test(raw)) return "LIVE";
  return secondsToISO(durationLabelToSeconds(raw));
}
