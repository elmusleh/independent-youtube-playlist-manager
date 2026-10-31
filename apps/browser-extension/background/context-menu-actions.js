/* Compatibility exports; capture and persistence belong to the controller. */
import { startCapture } from "./capture-controller.js";
import { SCOPES } from "./context-menu-model.js";
import { parseYouTubeVideoId } from "../shared/tab-selection.js";
export const scopes = SCOPES;
export const targets = [
  ["builder", "Playlist Builder"],
  ["favorite", "Favorite playlist"],
  ["latest", "Latest playlist"],
  ["new", "New local playlist"],
];
export function runTabCapture(scope, target, anchor) {
  return startCapture({ scope, mode: target, anchor });
}
export function videoIdFromMenu(info, tab) {
  return (
    [info.linkUrl, info.srcUrl, info.pageUrl, tab?.url].map(parseYouTubeVideoId).find(Boolean) ||
    null
  );
}
