// @ts-check
import { validIds } from "./library-mutations.js";
const PREFIX = "yph_capture_job:";
const TTL = 30 * 60 * 1000;
const running = new Set();
export async function pruneJobs() {
  const stored = await browser.storage.local.get(null);
  const expired = Object.keys(stored).filter(
    (key) => key.startsWith(PREFIX) && stored[key]?.expires < Date.now()
  );
  if (expired.length) {
    const keys = expired.flatMap((key) => [
      key,
      key + ":cancel",
      key.replace(PREFIX, "yph_capture_receipt:"),
    ]);
    await browser.storage.local.remove(keys);
  }
}
/** @param {import("../shared/protocol-contracts.js").CreateJobInput} data
 * @returns {Promise<import("../shared/protocol-contracts.js").CaptureJob>} */
export async function createJob(data) {
  await pruneJobs();
  const all = await browser.storage.local.get(null);
  if (Object.keys(all).filter((key) => key.startsWith(PREFIX)).length >= 20)
    throw new Error("Too many pending captures. Finish or cancel an existing capture first.");
  const id = crypto.randomUUID();
  /** @type {import("../shared/protocol-contracts.js").CaptureJob} */
  const job = {
    sourceTab: null,
    tabs: [],
    mode: "new",
    position: "bottom",
    closeTabs: false,
    ...data,
    ids: validIds(data.ids || []),
    id,
    expires: Date.now() + TTL,
    status: "ready",
    addedIds: [],
    inFlight: null,
    error: "",
  };
  await putJob(job);
  return job;
}
/** @param {string} id @returns {Promise<import("../shared/protocol-contracts.js").CaptureJob>} */
export async function getJob(id) {
  if (typeof id !== "string" || !/^[\da-f-]{36}$/.test(id))
    throw new Error("Invalid capture link.");
  const stored = await browser.storage.local.get(PREFIX + id);
  const job = stored[PREFIX + id];
  if (!job || job.expires < Date.now())
    throw new Error("This capture expired. Invoke the menu again on the source page.");
  return job;
}
/** @param {import("../shared/protocol-contracts.js").CaptureJob} job */
export async function putJob(job) {
  await browser.storage.local.set({ [PREFIX + job.id]: job });
}
/** @param {string} id */
export function isRunning(id) {
  return running.has(id);
}
/** @template T
 * @param {string} id
 * @param {(job: import("../shared/protocol-contracts.js").CaptureJob) => Promise<T>} action
 * @returns {Promise<T>} */
export async function withJob(id, action) {
  if (running.has(id)) throw new Error("This capture is already running.");
  running.add(id);
  try {
    return await action(await getJob(id));
  } finally {
    running.delete(id);
  }
}
/** @param {string} id @returns {Promise<{status: "cancelled" | "cancelling"}>} */
export async function cancelJob(id) {
  if (running.has(id)) {
    await browser.storage.local.set({ [PREFIX + id + ":cancel"]: true });
    return { status: "cancelling" };
  }
  const job = await getJob(id);
  job.status = "cancelled";
  job.ids = [];
  job.tabs = [];
  job.sourceTab = null;
  await putJob(job);
  return { status: job.status };
}
/** @param {import("../shared/protocol-contracts.js").CaptureJob} job */
export async function checkCancelled(job) {
  if (job.expires < Date.now())
    throw new Error("This capture expired. Start again from the source page.");
  const key = PREFIX + job.id + ":cancel";
  if ((await browser.storage.local.get(key))[key]) {
    job.status = "cancelled";
    await putJob(job);
    await browser.storage.local.remove(key);
    throw new Error("Capture cancelled. Videos already saved were kept.");
  }
}

/** @param {import("../shared/protocol-contracts.js").CaptureJob} job */
export async function openCapture(job) {
  await browser.tabs.create({
    url: browser.runtime.getURL(`/editor/index.html#/capture?job=${job.id}`),
  });
}
