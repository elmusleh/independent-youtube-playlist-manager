import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { libraryFixture } from "../test-support/library-fixture";
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const videoId = "abcdefghijk";
async function setup() {
  const fixture = await libraryFixture();
  fixture.stored.yt_playlist_cache_v1 = {
    list: { data: [{ id: "PLremote", title: "Remote", videos: [] }] },
  };
  window.getSettings = vi.fn().mockResolvedValue({});
  window.isSignedIn = vi.fn().mockResolvedValue(true);
  window.ytGetPlaylistItems = vi.fn().mockResolvedValue([]);
  window.ytAddVideo = vi.fn().mockResolvedValue(undefined);
  const jobs = await import("../../../background/capture-jobs.js");
  const controller = await import("../../../background/capture-controller.js");
  const job = await jobs.createJob({
    source: "menu",
    operation: "capture",
    mode: "PLremote",
    ids: [videoId],
    tabs: [],
    position: "bottom",
    closeTabs: false,
    sourceTab: { id: 1, url: "https://example.com", windowId: 1 },
  });
  return { ...fixture, ...jobs, ...controller, job };
}
it("requires explicit consent before any remote request", async () => {
  const { commitJob, job } = await setup();
  await expect(commitJob(job.id, "PLremote", false)).rejects.toThrow(/Review/);
  expect(window.ytAddVideo).not.toHaveBeenCalled();
  expect(window.ytGetPlaylistItems).not.toHaveBeenCalled();
});
it("reconciles a confirmed in-flight request after restart without adding it twice", async () => {
  const { commitJob, putJob, job } = await setup();
  job.inFlight = videoId;
  await putJob(job);
  window.ytGetPlaylistItems = vi.fn().mockResolvedValue([{ videoId }]);
  const result = await commitJob(job.id, "PLremote", true);
  expect(result.added).toBe(1);
  expect(window.ytAddVideo).not.toHaveBeenCalled();
});
it("does not repeat an uncertain remote request that has not been reconciled", async () => {
  const { commitJob, putJob, job } = await setup();
  job.inFlight = videoId;
  await putJob(job);
  await expect(commitJob(job.id, "PLremote", true)).rejects.toThrow(/not confirmed/);
  expect(window.ytAddVideo).not.toHaveBeenCalled();
});
it("retains partial progress and leaves source tabs open on remote failure", async () => {
  const { commitJob, getJob, job, api } = await setup();
  window.ytAddVideo = vi.fn().mockRejectedValue(new Error("Quota exhausted"));
  await expect(commitJob(job.id, "PLremote", true)).rejects.toThrow(/Quota/);
  expect((await getJob(job.id)).inFlight).toBe(videoId);
  expect(api.tabs.remove).not.toHaveBeenCalled();
});
it("reuses a local receipt if the worker stopped after storage but before job completion", async () => {
  const { commitJob, mutateLibrary, stored, job } = await setup();
  const saved = await mutateLibrary({
    type: "append",
    create: true,
    ids: [videoId],
    receipt: job.id,
  });
  const result = await commitJob(job.id, "new", false);
  expect((result as { id?: string }).id).toBe((saved as { id?: string }).id);
  expect(stored.yph_local_playlists).toHaveLength(1);
});
it("rejects expired jobs and cancellation never writes a remote playlist", async () => {
  const { cancelJob, commitJob, job, stored } = await setup();
  await cancelJob(job.id);
  await expect(commitJob(job.id, "PLremote", true)).rejects.toThrow(/cancelled/);
  expect(window.ytAddVideo).not.toHaveBeenCalled();
  stored[`yph_capture_job:${job.id}`].expires = 0;
  await expect(commitJob(job.id, "PLremote", true)).rejects.toThrow(/expired/);
});
