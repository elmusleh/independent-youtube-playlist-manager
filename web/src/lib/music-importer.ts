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
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tracks: TrackItem[] = [];

  for (const line of lines) {
    // Strip leading track numbers like "1. ", "01 - ", "[1] "
    const cleaned = line.replace(/^\s*(\d+[\.\-\)]\s*|\[\d+\]\s*)/, "");

    // Split on dash, hyphen, or en-dash
    const parts = cleaned.split(/\s+[\-\–\—]\s+/);
    if (parts.length >= 2) {
      const artist = parts[0].trim();
      // Remove trailing duration like "(3:45)" or "[4:12]"
      const title = parts.slice(1).join(" - ").replace(/\s*[\(\[]\d+:\d+[\)\]]/, "").trim();

      if (artist && title) {
        tracks.push({ artist, title, rawLine: line });
        continue;
      }
    }

    // Single item without clear dash
    if (cleaned.length > 2) {
      tracks.push({
        artist: "Various",
        title: cleaned.replace(/\s*[\(\[]\d+:\d+[\)\]]/, "").trim(),
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
