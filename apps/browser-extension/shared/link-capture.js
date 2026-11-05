import { parseYouTubeVideoId } from "./tab-selection.js";

const MEDIA_CONTEXTS = new Set(["video", "image", "audio"]);

/**
 * Native click data does not carry the clicked context, only its pieces. A link
 * always wins: substituting the current page for a YouTube link that is not a
 * video (channel, playlist, search) would silently capture the wrong video.
 * @param {{linkUrl?: string, srcUrl?: string, mediaType?: string}} info
 */
export function clickContext(info) {
  if (info?.linkUrl) return "link";
  if (info?.mediaType) return info.mediaType;
  return "page";
}

/**
 * Resolve the video id for a native menu click.
 * @param {string} context "link" | "video" | "image" | "audio" | "page" | anything else
 * @param {{linkUrl?: string, srcUrl?: string, pageUrl?: string}} info
 * @param {string | undefined} tabUrl
 * @returns {string | null}
 */
export function linkCaptureVideoId(context, info, tabUrl) {
  if (context === "link") return parseYouTubeVideoId(info?.linkUrl);
  if (MEDIA_CONTEXTS.has(context))
    return parseYouTubeVideoId(info?.srcUrl) || parseYouTubeVideoId(tabUrl);
  return parseYouTubeVideoId(info?.pageUrl) || parseYouTubeVideoId(tabUrl);
}
