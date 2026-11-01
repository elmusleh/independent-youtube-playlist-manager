// @ts-check
import { scanExistingJob, stopImportScan } from "./capture-import.js";
export { scanPage } from "./capture-import.js";
export { openCapture } from "./capture-jobs.js";
import { syncRemote } from "./capture-remote.js";
import { mutateLibrary, validIds } from "./library-mutations.js";
import { tabsForScope, youtubeTabs, parseYouTubeVideoId } from "../shared/tab-selection.js";
import {
  cachedDestinations,
  destinationMode,
  effectiveDestinationMode,
  resolveDestination,
  requireDestinationEnabled,
} from "../shared/quick-add.js";
import {
  createJob,
  getJob,
  putJob,
  withJob,
  cancelJob,
  checkCancelled,
  openCapture,
} from "./capture-jobs.js";
import { permittedUI } from "./message-access.js";

/** @param {browser.tabs.Tab | import("../shared/protocol-contracts.js").SourceAnchor | undefined} tab */
function requireAnchor(tab) {
  if (
    !tab ||
    !Number.isInteger(tab.id) ||
    typeof tab.url !== "string" ||
    !Number.isInteger(tab.windowId)
  )
    throw new Error("The source tab is unavailable.");
  if (tab.id === undefined || tab.windowId === undefined)
    throw new Error("The source tab has no identity.");
  return { ...tab, id: tab.id, url: tab.url, windowId: tab.windowId };
}
/** @param {string} scope @param {import("../shared/protocol-contracts.js").SourceAnchor} anchor
 * @returns {Promise<Array<{id: string, tab: browser.tabs.Tab}> & {skipped: number}>} */
export async function collectTabs(scope, anchor) {
  if (!anchor || anchor.incognito) throw new Error("Capturing from private windows is disabled.");
  const live = await browser.tabs.get(anchor.id).catch(() => null);
  if (!live || live.incognito || live.url !== anchor.url || live.windowId !== anchor.windowId)
    throw new Error("The clicked tab changed or closed. Open the menu again.");
  const tabs = await browser.tabs.query(
    scope === "all" ? { windowType: "normal" } : { windowId: anchor.windowId }
  );
  const scoped = tabsForScope(scope, anchor, tabs);
  const videos = youtubeTabs(scoped);
  return Object.assign(videos, { skipped: scoped.length - videos.length });
}
/** @param {import("../shared/protocol-contracts.js").TabSnapshot[]} tabs @param {string[]} addedIds */
export async function closeSavedTabs(tabs, addedIds) {
  const added = new Set(addedIds);
  for (const original of tabs || []) {
    const originalUrl = original.url || "";
    if (original.pinned || original.incognito || !originalUrl) continue;
    const videoId = parseYouTubeVideoId(originalUrl);
    if (!videoId || !added.has(videoId)) continue;
    try {
      const current = await browser.tabs.get(original.id);
      if (
        !current.pinned &&
        !current.incognito &&
        current.url === original.url &&
        current.windowId === original.windowId
      )
        await browser.tabs.remove(original.id);
    } catch {
      /* Closed, moved or no longer accessible: leave it alone. */
    }
  }
}
/** @param {import("../shared/protocol-contracts.js").StartCaptureOptions} options
 * @returns {Promise<import("../shared/protocol-contracts.js").StartCaptureResult>} */
export async function startCapture({
  scope,
  anchor,
  ids,
  mode,
  source = "menu",
  operation = "capture",
  review = false,
  title = "New local playlist",
}) {
  const settings = await window.getSettings();
  if (anchor?.incognito) throw new Error("Capturing from private windows is disabled.");
  const selected = ids
    ? Object.assign([], { skipped: 0 })
    : await collectTabs(scope || "", requireAnchor(anchor));
  const videoIds = validIds(ids || selected.map((item) => item.id));
  if (!videoIds.length) throw new Error("No YouTube videos were found in these tabs.");
  // Menu actions must use the same destination the label advertised, including
  // when the configured family is disabled.
  const target =
    mode ||
    (source === "menu" ? effectiveDestinationMode(settings) : destinationMode(settings, false));
  requireDestinationEnabled(target, settings, source);
  const job = await createJob({
    operation,
    source,
    title,
    mode: target,
    ids: videoIds,
    skipped: selected.skipped || (ids ? ids.length - videoIds.length : 0),
    tabs: selected.flatMap(({ tab }) =>
      typeof tab.id === "number" && typeof tab.url === "string" && typeof tab.windowId === "number"
        ? [{ id: tab.id, url: tab.url, windowId: tab.windowId, pinned: !!tab.pinned }]
        : []
    ),
    sourceTab: anchor ? { id: anchor.id, url: anchor.url, windowId: anchor.windowId } : null,
    position: settings.addToLatestPosition || "bottom",
    closeTabs: source === "menu" ? !!settings.closeContextAddedTabs : !!settings.closeAddedTabs,
  });
  const destination = resolveDestination(target, settings, await cachedDestinations());
  if (destination) {
    job.requestedId = destination.id;
    await putJob(job);
  }
  if (
    review ||
    !destination ||
    (destination.id !== "builder" &&
      destination.id !== "new" &&
      !destination.id.startsWith("local-"))
  ) {
    await openCapture(job);
    return { review: true, jobId: job.id };
  }
  const result = await commitJob(job.id, destination.id, false);
  const shouldOpen =
    destination.id === "builder"
      ? settings.openPlaylistBuilderAfterAdd
      : settings.openSavedPlaylistAfterAdd;
  if (source === "menu" && shouldOpen) {
    const route =
      destination.id === "builder"
        ? "/playlist-builder"
        : `/playlist?id=${encodeURIComponent(result.id)}`;
    await browser.tabs
      .create({ url: browser.runtime.getURL(`/editor/index.html#${route}`) })
      .catch(() => {});
  }
  return result;
}
/** @param {string} id @param {string} destinationId @param {boolean} remoteConsent
 * @param {import("../shared/protocol-contracts.js").CommitOptions} [options]
 * @returns {Promise<import("../shared/protocol-contracts.js").CaptureResult>} */
export async function commitJob(id, destinationId, remoteConsent, options = {}) {
  return withJob(id, async (job) => {
    if (job.status === "complete") {
      if (!job.result || !("addedIds" in job.result))
        throw new Error("This job has no capture result.");
      return job.result;
    }
    if (job.status === "cancelled") throw new Error("This capture was cancelled.");
    if (!job.ids.length)
      throw new Error(
        "No YouTube videos were found. Scan the source page or start another capture."
      );
    if (typeof destinationId !== "string" || destinationId.length > 200)
      throw new Error("Choose a valid destination.");
    if (job.destinationId && job.destinationId !== destinationId)
      throw new Error("A started capture cannot change destinations.");
    const settings = await window.getSettings();
    requireDestinationEnabled(destinationId, settings, job.source);
    if (
      !job.destinationId &&
      !["builder", "new"].includes(destinationId) &&
      !destinationId.startsWith("local-") &&
      !(await cachedDestinations()).some((p) => p.id === destinationId)
    )
      throw new Error(
        "This YouTube destination is unavailable. Load playlists and choose it again."
      );
    if (options.quantity !== undefined) {
      if (job.destinationId) throw new Error("A started capture cannot change import options.");
      if (
        !Number.isInteger(options.quantity) ||
        options.quantity < 0 ||
        options.quantity > 1000 ||
        !["newest", "oldest"].includes(options.order || "")
      )
        throw new Error("Use a quantity from 0 to 1000 and a valid order.");
      job.ids = options.quantity ? job.ids.slice(0, options.quantity) : job.ids;
      if (options.order === "oldest") job.ids.reverse();
    }
    if (job.sourceTab && job.operation === "import") {
      const source = await browser.tabs.get(job.sourceTab.id).catch(() => null);
      if (
        !source ||
        source.url !== job.sourceTab.url ||
        source.windowId !== job.sourceTab.windowId ||
        source.incognito
      )
        throw new Error("The source page changed or closed. Invoke Import from Page again.");
    }
    await checkCancelled(job);
    const remote =
      !["builder", "new"].includes(destinationId) && !destinationId.startsWith("local-");
    job.destinationId = destinationId;
    job.status = "saving";
    await putJob(job);
    try {
      let result;
      if (remote) result = await syncRemote(job, remoteConsent);
      else {
        // Journal result in the same serialized storage transaction as the append. A retry
        // uses the receipt, including the generated ID, rather than creating another list.
        result =
          destinationId === "builder"
            ? await mutateLibrary({
                type: "builder-append",
                ids: job.ids,
                position: job.position,
                receipt: job.id,
              })
            : await mutateLibrary({
                type: "append",
                id: destinationId,
                create: destinationId === "new",
                title: options.title || job.title || "New local playlist",
                ids: job.ids,
                position: job.position,
                receipt: job.id,
              });
      }
      await checkCancelled(job);
      job.result = {
        ...result,
        added: result.addedIds.length,
        skipped: job.skipped || 0,
        failed: 0,
        jobId: job.id,
      };
      job.status = "complete";
      const closingCandidates = job.tabs;
      job.tabs = [];
      job.sourceTab = null;
      await putJob(job);
      if (job.closeTabs) await closeSavedTabs(closingCandidates, result.addedIds);
      return job.result;
    } catch (error) {
      if (/** @type {string} */ (job.status) !== "cancelled") job.status = "failed";
      job.error = error.message;
      await putJob(job);
      throw error;
    }
  });
}
browser.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.cmd !== "capture") return undefined;
  if (!permittedUI(sender, message.action !== "start")) {
    respond({ ok: false, error: "This page cannot access capture jobs." });
    return false;
  }
  const task = async () => {
    if (message.action === "start") {
      if (sender.url !== browser.runtime.getURL("/popup/popup.html"))
        throw new Error("Only the popup may start this operation.");
      const args = message.args || {};
      if (!Array.isArray(args.ids) || args.ids.length > 100000)
        throw new Error("Invalid capture request.");
      // Tab snapshots supplied by UI are not trusted for closure.
      if (args.scope) {
        const anchor = requireAnchor(await browser.tabs.get(args.anchorId));
        if (anchor.incognito || anchor.url !== args.anchorUrl)
          throw new Error("The source tab changed or is private.");
        return startCapture({ scope: args.scope, anchor, mode: args.mode, source: "popup" });
      }
      let anchor;
      if (args.sourceTabId !== undefined) {
        anchor = requireAnchor(await browser.tabs.get(args.sourceTabId));
        if (anchor.incognito || anchor.url !== args.sourceTabUrl)
          throw new Error("The source page changed or is private.");
      }
      return startCapture({
        ids: args.ids,
        anchor,
        mode: args.mode,
        source: "popup",
        review: args.review === true,
        operation: args.review ? "import" : "capture",
        title: typeof args.title === "string" ? args.title.slice(0, 500) : undefined,
      });
    }
    const job = await getJob(message.id);
    const route = sender.url ? new URL(sender.url).hash : "";
    if (new URLSearchParams(route.split("?")[1]).get("job") !== job.id)
      throw new Error("This capture belongs to another page.");
    if (message.action === "get") {
      const settings = await window.getSettings();
      return {
        job,
        destinations: await cachedDestinations(),
        constraints: {
          builderAllowed: job.source !== "menu" || !settings.disableContextBuilder,
          savedAllowed: job.source !== "menu" || !settings.disableContextSaved,
        },
      };
    }
    if (message.action === "destinations") return window.getPlaylists();
    if (message.action === "destination") {
      if (job.operation !== "destination")
        throw new Error("This capture cannot change the default destination.");
      const destination = message.destinationId;
      if (
        !["builder", "new"].includes(destination) &&
        !(await cachedDestinations()).some((p) => p.id === destination)
      )
        throw new Error("Choose an available playlist.");
      requireDestinationEnabled(destination, await window.getSettings(), "menu");
      await window.storeObject("contextMenuDestination", destination);
      job.status = "complete";
      await checkCancelled(job);
      job.result = { id: destination };
      await putJob(job);
      return job.result;
    }
    if (message.action === "scan") return scanExistingJob(job.id, message.quantity);
    if (message.action === "cancel") {
      const result = await cancelJob(job.id);
      await stopImportScan(job);
      return result;
    }
    if (message.action === "commit")
      return commitJob(
        job.id,
        message.destinationId,
        message.remoteConsent === true,
        message.options || {}
      );
    throw new Error("Unknown capture command.");
  };
  task().then(
    (result) => respond({ ok: true, result }),
    (error) => respond({ ok: false, error: error.message })
  );
  return true;
});
