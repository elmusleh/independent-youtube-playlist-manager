// @ts-check
import { validIds } from "./library-mutations.js";
import { createJob, putJob, openCapture, withJob, checkCancelled } from "./capture-jobs.js";
/** @param {import("../shared/protocol-contracts.js").SourceAnchor | null} source */
async function requireSource(source) {
  if (!source || !/^https?:\/\//.test(source.url || ""))
    throw new Error("Import requires a regular HTTP(S) webpage.");
  const tab = await browser.tabs.get(source.id).catch(() => null);
  if (!tab || tab.incognito || tab.url !== source.url || tab.windowId !== source.windowId)
    throw new Error("The source page changed or closed. Open its menu and retry.");
  return tab;
}
function isChannel(url) {
  const source = new URL(url);
  return (
    (source.hostname === "youtube.com" || source.hostname.endsWith(".youtube.com")) &&
    /^\/(?:@|channel\/|c\/|user\/)/.test(source.pathname)
  );
}
/** @param {import("../shared/protocol-contracts.js").SourceAnchor} source @param {number} quantity @param {boolean} scrolling */
async function readPage(source, quantity, scrolling) {
  await requireSource(source);
  const target = { tabId: source.id, frameIds: [0] };
  try {
    if (scrolling && isChannel(source.url)) {
      await browser.scripting.executeScript({
        target,
        func: (count) => {
          window["YPH_TARGET_QUANTITY"] = count;
          window["YPH_CANCEL_IMPORT"] = false;
        },
        args: [quantity],
      });
      await requireSource(source);
      const results = await browser.scripting.executeScript({
        target,
        files: ["/content-scripts/injectors/get-channel-video-ids.js"],
      });
      await requireSource(source);
      return validIds((results[0]?.result || []).map((item) => item.id));
    }
    const results = await browser.scripting.executeScript({
      target,
      files: ["/content-scripts/injectors/scrape-youtube-links.js"],
    });
    await requireSource(source);
    return validIds((results[0]?.result?.links || []).map((link) => link.id));
  } catch (error) {
    if (/permission|cannot access|not allowed|restricted/i.test(error.message))
      throw new Error(
        "This page could not be read. Protected pages or lost permissions can block scanning. Open the menu on the source page and retry.",
        { cause: error }
      );
    throw error;
  }
}
/** @param {import("../shared/protocol-contracts.js").SourceAnchor} anchor */
export async function scanPage(anchor) {
  if (!anchor || anchor.incognito) throw new Error("Import from private windows is disabled.");
  const sourceTab = { id: anchor.id, url: anchor.url, windowId: anchor.windowId };
  // Execute before opening extension UI: this is the actual native gesture's activeTab grant.
  const ids = await readPage(sourceTab, 0, false);
  const job = await createJob({
    operation: "import",
    source: "menu",
    sourceTab,
    ids,
    tabs: [],
    mode: "new",
    position: "bottom",
    closeTabs: false,
    canScroll: isChannel(anchor.url),
  });
  await openCapture(job);
  return job;
}
/** @param {string} id @param {number} quantity */
export async function scanExistingJob(id, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000)
    throw new Error("Enter a quantity from 0 to 1000; 0 means all.");
  return withJob(id, async (job) => {
    if (job.operation !== "import" || job.destinationId || job.status === "cancelled")
      throw new Error("This capture cannot scan a page.");
    await checkCancelled(job);
    job.status = "scanning";
    await putJob(job);
    try {
      if (!job.sourceTab) throw new Error("The source page is unavailable.");
      const ids = await readPage(job.sourceTab, quantity, true);
      await checkCancelled(job);
      job.ids = ids;
      job.status = "ready";
      job.error = "";
      await putJob(job);
      return { count: ids.length };
    } catch (error) {
      markScanFailed(job);
      job.error = error.message;
      await putJob(job);
      throw error;
    }
  });
}
/** @param {import("../shared/protocol-contracts.js").CaptureJob} job */
export async function stopImportScan(job) {
  if (job.status !== "scanning" || !job.sourceTab) return;
  try {
    await requireSource(job.sourceTab);
    await browser.scripting.executeScript({
      target: { tabId: job.sourceTab.id, frameIds: [0] },
      func: () => {
        window["YPH_CANCEL_IMPORT"] = true;
      },
    });
  } catch {
    /* Never inject cancellation into a navigated/closed source page. */
  }
}

/** @param {import("../shared/protocol-contracts.js").CaptureJob} job */
function markScanFailed(job) {
  // checkCancelled mutates the shared job across await; retain its terminal state.
  if (job.status !== "cancelled") job.status = "failed";
}
