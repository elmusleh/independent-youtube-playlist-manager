/**
 * Fuzzy label matching for OCR'd menu rows.
 *
 * OCR is probabilistic and its word segmentation is unstable: it reads "Playlist Builder"
 * as "Plavlist Builder", and joins or splits words that belong together ("othe tabs inthis
 * window"). Exact substring tests therefore produce false *failures* — and, worse, would
 * tempt someone to loosen the assertion instead of fixing the matching.
 */
"use strict";

const squash = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

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

/** Does any OCR row show `label`? Space-insensitive: the wanted label is compared against
 * every window of similar length in each row, so a joined or split word still matches. */
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

module.exports = { similarity, shows };
