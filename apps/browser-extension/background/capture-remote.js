// @ts-check
import { putJob, checkCancelled } from "./capture-jobs.js";
/** @type {Promise<unknown>} */
let remoteQueue = Promise.resolve();
/** @param {import("../shared/protocol-contracts.js").CaptureJob} job @param {boolean} consent */
export function syncRemote(job, consent) {
  const task = remoteQueue.then(() => performSync(job, consent));
  remoteQueue = task.catch(() => {});
  return task;
}
/** @param {import("../shared/protocol-contracts.js").CaptureJob} job @param {boolean} consent */
async function performSync(job, consent) {
  if (!consent) throw new Error("Review this YouTube destination and select Sync to consent.");
  if (!(await window.isSignedIn()))
    throw new Error("Sign in to YouTube in Settings, then return and retry Sync.");
  await checkCancelled(job);
  // Reconcile every attempt, including an uncertain request left by a worker restart.
  if (!job.destinationId) throw new Error("Choose a YouTube destination first.");
  const items = await window.ytGetPlaylistItems(job.destinationId);
  const existing = new Set(items.map((item) => item.videoId));
  if (job.inFlight && existing.has(job.inFlight)) {
    if (!job.addedIds.includes(job.inFlight)) job.addedIds.push(job.inFlight);
    job.inFlight = null;
    await putJob(job);
  } else if (job.inFlight) {
    throw new Error(
      "YouTube has not confirmed the previous request. Check the playlist and retry later; no automatic repeat was sent."
    );
  }
  const pending = job.ids.filter((videoId) => !existing.has(videoId));
  for (const [index, videoId] of pending.entries()) {
    await checkCancelled(job);
    job.inFlight = videoId;
    await putJob(job);
    await window.ytAddVideo(job.destinationId, videoId, job.position === "top" ? index : undefined);
    job.addedIds.push(videoId);
    job.inFlight = null;
    await putJob(job);
  }
  window.invalidatePlaylistCache?.();
  return {
    id: job.destinationId,
    addedIds: job.addedIds,
    duplicates: job.ids.length - job.addedIds.length,
  };
}
