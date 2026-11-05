/* Compatibility exports; capture and persistence belong to the controller. */
import { startCapture } from "./capture-controller.js";
import { SCOPES } from "./context-menu-model.js";
import { clickContext, linkCaptureVideoId } from "../shared/link-capture.js";
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
/** Single resolution path for both the dispatcher and the compatibility surface. */
export function videoIdFromMenu(info, tab) {
  return linkCaptureVideoId(clickContext(info), info, tab?.url);
}
