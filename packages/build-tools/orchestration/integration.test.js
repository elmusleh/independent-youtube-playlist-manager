import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import { IntegrationResult, integrateOnce } from "./integration.js";

function createRepo() {
  const dir = fs.mkdtempSync(join("/tmp", "integration-test-"));
  execSync("git init -q", { cwd: dir, stdio: "ignore" });
  execSync('git config user.email "i@test.local"', { cwd: dir, stdio: "ignore" });
  execSync('git config user.name "Integration Test"', { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(join(dir, "README.md"), "# test\n");
  execSync("git add README.md", { cwd: dir, stdio: "ignore" });
  execSync('git commit -q -m "init"', { cwd: dir, stdio: "ignore" });
  return dir;
}

async function seedJob(registry, id) {
  return registry.createJob({
    id,
    schemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    changeName: `change-${id}`,
    branch: `feat/${id}`,
    worktreePath: `/tmp/wt/${id}`,
    worktreeManager: "git",
    startingSha: "abc123",
    dependencies: [],
    state: "queued",
  });
}

const validEvidence = { status: "valid", problems: [] };
const validReview = { decision: "ready-for-guarded-merge", blockers: [], head: "abc123" };
const protections = {
  requiredChecks: ["verify"],
  requiredApprovals: 1,
  allowsAdminBypass: false,
  requiresUpToDate: true,
};
function fresh(head = "abc123") {
  return { reviewState: { ...validReview, head }, protections };
}
const authority = { allowed: true, blockers: [] };

let repo;
let registry;

beforeEach(async () => {
  repo = createRepo();
  registry = new OrchestrationRegistry(repo, { maxActive: 2 });
  await seedJob(registry, "job-1");
  await seedJob(registry, "job-2");
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("Integration - one operation at a time", () => {
  it("refuses a second integration while the slot is held", async () => {
    // Simulate an in-flight integration by taking the slot directly.
    fs.writeFileSync(join(registry.registryDir, ".integration.lock"), "{}");
    const service = { squashMerge: vi.fn() };

    const result = await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1, repository: "owner/repo" },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      service,
      remoteState: async () => ({ targetSha: "target-1", prHeads: { 1: "abc123" }, ...fresh() }),
      authority,
      evidenceState: validEvidence,
      reviewState: validReview,
    });

    expect(result.status).toBe(IntegrationResult.BUSY);
    expect(service.squashMerge).not.toHaveBeenCalled();
  });

  it("serializes two ready PRs so only one merges against the same target", async () => {
    const state = { targetSha: "target-1" };
    const service = {
      squashMerge: vi.fn(async () => {
        const sha = `merge-${Math.random().toString(36).slice(2, 6)}`;
        state.targetSha = sha;
        return { merged: true, sha };
      }),
    };
    const remoteState = async () => ({
      targetSha: state.targetSha,
      prHeads: { 1: "head-1", 2: "head-2" },
      ...fresh("head-1"),
    });

    const first = await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1, repository: "owner/repo" },
      expectedHead: "head-1",
      expectedTargetSha: "target-1",
      service,
      remoteState,
      authority,
      evidenceState: validEvidence,
      reviewState: { ...validReview, head: "head-1" },
    });

    const second = await integrateOnce({
      registry,
      jobId: "job-2",
      pr: { number: 2, repository: "owner/repo" },
      expectedHead: "head-2",
      expectedTargetSha: "target-1",
      service,
      remoteState,
      authority,
      evidenceState: validEvidence,
      reviewState: { ...validReview, head: "head-1" },
    });

    expect(first.status).toBe(IntegrationResult.MERGED);
    expect(second.status).toBe(IntegrationResult.RECHECK_REQUIRED);
    expect(second.merged).toBe(false);
    expect(service.squashMerge).toHaveBeenCalledTimes(1);
    expect(second.actualTargetSha).not.toBe("target-1");
  });
});

describe("Integration - last-moment rechecks", () => {
  it("aborts when an external actor moved the target", async () => {
    const service = { squashMerge: vi.fn() };
    const result = await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1, repository: "owner/repo" },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      service,
      remoteState: async () => ({
        targetSha: "externally-moved",
        prHeads: { 1: "abc123" },
        ...fresh(),
      }),
      authority,
      evidenceState: validEvidence,
      reviewState: validReview,
    });

    expect(result.status).toBe(IntegrationResult.RECHECK_REQUIRED);
    expect(service.squashMerge).not.toHaveBeenCalled();
  });

  it("aborts when the PR head moved", async () => {
    const service = { squashMerge: vi.fn() };
    const result = await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1, repository: "owner/repo" },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      service,
      remoteState: async () => ({ targetSha: "target-1", prHeads: { 1: "different" } }),
      authority,
      evidenceState: validEvidence,
      reviewState: validReview,
    });

    expect(result.status).toBe(IntegrationResult.RECHECK_REQUIRED);
    expect(service.squashMerge).not.toHaveBeenCalled();
  });

  it("fails safely when the merge service rejects the expected head", async () => {
    const service = {
      squashMerge: async () => {
        throw new Error("expected head does not match");
      },
    };
    const result = await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1, repository: "owner/repo" },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      service,
      remoteState: async () => ({ targetSha: "target-1", prHeads: { 1: "abc123" }, ...fresh() }),
      authority,
      evidenceState: validEvidence,
      reviewState: validReview,
    });

    expect(result.status).toBe(IntegrationResult.FAILED);
    expect(result.merged).toBe(false);
    // The slot is released even after failure.
    expect(fs.existsSync(join(registry.registryDir, ".integration.lock"))).toBe(false);
  });

  it("refuses stale evidence without calling the service", async () => {
    const service = { squashMerge: vi.fn() };
    const result = await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1, repository: "owner/repo" },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      service,
      remoteState: async () => ({ targetSha: "target-1", prHeads: { 1: "abc123" }, ...fresh() }),
      authority,
      evidenceState: { status: "stale", problems: [{ code: "STALE_HEAD" }] },
      reviewState: validReview,
    });

    expect(result.status).toBe(IntegrationResult.REFUSED);
    expect(service.squashMerge).not.toHaveBeenCalled();
  });

  it("refuses when review is blocked", async () => {
    const service = { squashMerge: vi.fn() };
    const result = await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1, repository: "owner/repo" },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      service,
      remoteState: async () => ({ targetSha: "target-1", prHeads: { 1: "abc123" }, ...fresh() }),
      authority,
      evidenceState: validEvidence,
      reviewState: { decision: "blocked", blockers: [{ code: "CHECKS_FAILED" }] },
    });

    expect(result.status).toBe(IntegrationResult.REFUSED);
    expect(result.blockers.map((b) => b.code)).toContain("CHECKS_FAILED");
  });
});

describe("Integration - other jobs are invalidated after a target update", () => {
  it("marks other jobs as needing a recheck", async () => {
    const seen = [];
    const service = { squashMerge: async () => ({ merged: true, sha: "new-target" }) };

    const result = await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1, repository: "owner/repo" },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      service,
      remoteState: async () => ({ targetSha: "target-1", prHeads: { 1: "abc123" }, ...fresh() }),
      authority,
      evidenceState: validEvidence,
      reviewState: validReview,
      invalidate: async ({ job, targetSha }) => {
        seen.push(`${job.id}:${targetSha}`);
      },
    });

    expect(result.status).toBe(IntegrationResult.MERGED);
    expect(result.invalidatedJobs).toEqual(["job-2"]);
    expect(seen).toEqual(["job-2:new-target"]);

    const other = registry.getJob("job-2");
    expect(other.requiresRecheck).toBe(true);
    expect(other.evidenceInvalidations[0].reason).toBe("target-advanced");

    const merged = registry.getJob("job-1");
    expect(merged.requiresRecheck).toBeUndefined();
  });
});

describe("Integration - incomplete or changed remote safety state", () => {
  it.each([{}, { 1: "wrong" }])("refuses missing or changed remote head %j", async (prHeads) => {
    const service = { squashMerge: vi.fn() };
    await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1 },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      authority,
      evidenceState: validEvidence,
      reviewState: validReview,
      service,
      remoteState: async () => ({ targetSha: "target-1", prHeads, ...fresh() }),
    });
    expect(service.squashMerge).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    {},
    { decision: "blocked", head: "abc123", blockers: [{ code: "CHECKS_FAILED" }] },
  ])("refuses unknown or newly blocked review %j", async (reviewState) => {
    const service = { squashMerge: vi.fn() };
    await integrateOnce({
      registry,
      jobId: "job-1",
      pr: { number: 1 },
      expectedHead: "abc123",
      expectedTargetSha: "target-1",
      authority,
      evidenceState: validEvidence,
      reviewState: validReview,
      service,
      remoteState: async () => ({
        targetSha: "target-1",
        prHeads: { 1: "abc123" },
        protections,
        reviewState,
      }),
    });
    expect(service.squashMerge).not.toHaveBeenCalled();
  });
});
