export interface TrackItem {
  artist: string;
  title: string;
  durationSeconds?: number;
  rawLine?: string;
}

export interface ImportResult {
  sourceType: "spotify" | "apple_music" | "text_tracklist";
  sourceName?: string;
  totalParsed: number;
  tracks: TrackItem[];
}

/**
 * Parses raw text tracklists or pasted playlist contents.
 * Supports formats like:
 * - "Queen - Bohemian Rhapsody"
 * - "1. Dua Lipa - New Rules (3:45)"
 * - "Daft Punk - Get Lucky [Official Audio]"
 */
export function parseTextTracklist(text: string): ImportResult {
  // Guard against ReDoS: limit input to a reasonable size (100 KB)
  const MAX_INPUT = 100_000;
  const safeText = text.slice(0, MAX_INPUT);

  const lines = safeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const tracks: TrackItem[] = [];

  for (const line of lines) {
    // Strip leading track numbers like "1. ", "01 - ", "[1] "
    const cleaned = line.replace(/^\s*(\d+[.\-)]\s*|\[\d+\]\s*)/, "");

    // Split on the first occurrence of " - " or similar separator
    // Use indexOf instead of a backtracking regex split to avoid ReDoS
    const SEPARATORS = [" – ", " — ", " - "];
    let artist = "";
    let title = "";

    for (const sep of SEPARATORS) {
      const idx = cleaned.indexOf(sep);
      if (idx > 0) {
        artist = cleaned.slice(0, idx).trim();
        title = cleaned.slice(idx + sep.length).trim();
        break;
      }
    }

    if (artist && title) {
      // Remove trailing duration like "(3:45)" or "[4:12]" using
      // fixed-string indexOf to avoid ReDoS
      const parenIdx = title.lastIndexOf("(");
      const bracketIdx = title.lastIndexOf("[");
      const cutoff = Math.max(parenIdx >= 0 ? parenIdx : -1, bracketIdx >= 0 ? bracketIdx : -1);
      if (cutoff >= 0) {
        const suffix = title.slice(cutoff);
        if (/^[\(\[]\d+:\d+[\)\]]$/.test(suffix)) {
          title = title.slice(0, cutoff).trim();
        }
      }

      tracks.push({ artist, title, rawLine: line });
      continue;
    }

    // Single item without clear dash
    if (cleaned.length > 2) {
      // Strip duration suffix using indexOf (same as above)
      let rawTitle = cleaned;
      const parenIdx = rawTitle.lastIndexOf("(");
      const bracketIdx = rawTitle.lastIndexOf("[");
      const cutoff = Math.max(parenIdx >= 0 ? parenIdx : -1, bracketIdx >= 0 ? bracketIdx : -1);
      if (cutoff >= 0) {
        const suffix = rawTitle.slice(cutoff);
        if (/^[\(\[]\d+:\d+[\)\]]$/.test(suffix)) {
          rawTitle = rawTitle.slice(0, cutoff).trim();
        }
      }

      tracks.push({
        artist: "Various",
        title: rawTitle,
        rawLine: line,
      });
    }
  }

  return {
    sourceType: "text_tracklist",
    totalParsed: tracks.length,
    tracks,
  };
}

/**
 * Detects whether a string is a Spotify URL, Apple Music URL, or text tracklist.
 */
export function detectPlaylistSource(input: string): "spotify" | "apple_music" | "text" {
  if (/spotify\.com\/(playlist|album|track)/i.test(input)) return "spotify";
  if (/music\.apple\.com\/[a-z]{2}\/playlist/i.test(input)) return "apple_music";
  return "text";
}
