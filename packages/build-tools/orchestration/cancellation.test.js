import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import {
  CleanupResult,
  cancellationStatus,
  cleanupJob,
  evaluateBranchDeletion,
  requestCancellation,
} from "./cancellation.js";

function sh(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function createRepo() {
  const dir = fs.mkdtempSync(join("/tmp", "cancel-test-"));
  sh(dir, ["init", "-q", "-b", "main"]);
  sh(dir, ["config", "user.email", "c@test.local"]);
  sh(dir, ["config", "user.name", "Cancel Test"]);
  fs.writeFileSync(join(dir, "README.md"), "# test\n");
  sh(dir, ["add", "README.md"]);
  sh(dir, ["commit", "-q", "-m", "init"]);
  return dir;
}

async function seedJob(registry, overrides = {}) {
  return registry.createJob({
    id: overrides.id || "job-1",
    schemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    changeName: "change-1",
    branch: overrides.branch || "feat/job-1",
    worktreePath: overrides.worktreePath || null,
    worktreeManager: overrides.worktreeManager ?? "git",
    startingSha: "abc123",
    dependencies: [],
    state: overrides.state || "queued",
  });
}

const policy = {
  jobAuthority: { cleanup: { preserveDirtyWork: true, requiresOwnerAuthority: true } },
};
const authorization = { authorized: true, by: "owner" };

let repo;
let registry;

beforeEach(() => {
  repo = createRepo();
  registry = new OrchestrationRegistry(repo, { maxActive: 2 });
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("Cancellation - intent is recorded, work is preserved", () => {
  it("cancels an implementing job and keeps its worktree", async () => {
    await seedJob(registry, { worktreePath: "/tmp/wt/job-1", state: "queued" });
    await registry.claimOwnership("job-1", "session-a", process.pid, "test");

    const result = await requestCancellation({ registry, jobId: "job-1", reason: "owner stopped" });

    expect(result.cancelled).toBe(true);
    expect(result.state).toBe("cancelled");
    expect(result.workPreserved).toBe(true);
    expect(registry.getJob("job-1").cancelRequested).toBe(true);
  });

  it("does not interrupt an in-flight publication step", async () => {
    await seedJob(registry, { worktreePath: "/tmp/wt/job-1" });
    await registry.transitionJob("job-1", "dispatch-pending");
    await registry.claimOwnership("job-1", "session-a", process.pid, "test");
    await registry.transitionJob("job-1", "verification-pending");
    await registry.transitionJob("job-1", "verifying", { verifierAssigned: true });
    await registry.transitionJob("job-1", "review-pending");
    await registry.transitionJob("job-1", "reviewing", { reviewerAssigned: true });
    await registry.transitionJob("job-1", "sync-required");
    await registry.transitionJob("job-1", "syncing");
    await registry.transitionJob("job-1", "publication-pending");

    const result = await requestCancellation({ registry, jobId: "job-1" });
    expect(result.inFlight).toBe(true);
    expect(result.note).toMatch(/reconciled/i);
  });

  it("reports a status snapshot including retained evidence", async () => {
    await seedJob(registry, { worktreePath: "/tmp/wt/job-1" });
    await registry.patchJob("job-1", { evidenceReceipts: ["receipt-1"] });

    const status = cancellationStatus({ registry, jobId: "job-1" });
    expect(status.workRetained).toBe(true);
    expect(status.evidenceReceipts).toEqual(["receipt-1"]);
    expect(status.cancelRequested).toBe(false);
  });
});

describe("Cancellation - cleanup authorization", () => {
  it("refuses cleanup without owner authorization", async () => {
    await seedJob(registry, { worktreePath: "/tmp/wt/job-1" });

    const result = await cleanupJob({ registry, policy, jobId: "job-1", authorization: null });
    expect(result.status).toBe(CleanupResult.REFUSED);
    expect(result.reason).toBe("CLEANUP_NOT_AUTHORIZED");
    expect(result.retainedPath).toBe("/tmp/wt/job-1");
  });

  it("retains a dirty worktree and records the retained files", async () => {
    const worktreePath = join("/tmp", `cancel-wt-${Date.now()}`);
    sh(repo, ["worktree", "add", "-q", "-b", "feat/job-1", worktreePath]);
    fs.writeFileSync(join(worktreePath, "uncommitted.txt"), "work in progress");
    await seedJob(registry, { worktreePath });

    const result = await cleanupJob({ registry, policy, jobId: "job-1", authorization });

    expect(result.status).toBe(CleanupResult.RETAINED);
    expect(result.reason).toBe("DIRTY_WORKTREE");
    expect(result.files).toContain("uncommitted.txt");
    expect(fs.existsSync(join(worktreePath, "uncommitted.txt"))).toBe(true);
    expect(registry.getJob("job-1").cleanupReceipts[0].action).toBe("retained");

    sh(repo, ["worktree", "remove", "--force", worktreePath]);
  });

  it("removes a clean worktree and keeps evidence receipts", async () => {
    const worktreePath = join("/tmp", `cancel-clean-${Date.now()}`);
    sh(repo, ["worktree", "add", "-q", "-b", "feat/job-2", worktreePath]);
    await seedJob(registry, { id: "job-2", branch: "feat/job-2", worktreePath });
    await registry.patchJob("job-2", { evidenceReceipts: ["receipt-1", "receipt-2"] });

    const result = await cleanupJob({ registry, policy, jobId: "job-2", authorization });

    expect(result.status).toBe(CleanupResult.REMOVED);
    expect(fs.existsSync(worktreePath)).toBe(false);
    expect(result.evidencePreserved).toBe(2);
    expect(registry.getJob("job-2").cleanupReceipts[0].action).toBe("worktree-removed");
  });
});

describe("Cancellation - branch deletion safety", () => {
  it("never deletes protected branches", async () => {
    for (const branch of ["next", "main", "release/1.0"]) {
      expect(evaluateBranchDeletion({ branch }).reason).toBe("PROTECTED_BRANCH");
    }
  });

  it("refuses safe-delete after a squash merge", () => {
    const decision = evaluateBranchDeletion({
      branch: "feat/job-1",
      target: "next",
      mergedInto: [],
      squashMerged: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("SQUASH_SAFE_DELETE_REFUSED");
  });

  it("refuses deletion when the branch is not merged into the target", () => {
    const decision = evaluateBranchDeletion({ branch: "feat/job-1", mergedInto: ["main"] });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NOT_MERGED");
  });

  it("allows deletion only when the target contains the branch", () => {
    const decision = evaluateBranchDeletion({ branch: "feat/job-1", mergedInto: ["next"] });
    expect(decision.allowed).toBe(true);
  });

  it("retains a protected branch even when cleanup is authorized", async () => {
    sh(repo, ["branch", "next"]);
    const worktreePath = join("/tmp", `cancel-protected-${Date.now()}`);
    sh(repo, ["worktree", "add", "-q", "-b", "feat/job-3", worktreePath]);
    await seedJob(registry, { id: "job-3", branch: "feat/job-3", worktreePath });

    const result = await cleanupJob({
      registry,
      policy,
      jobId: "job-3",
      authorization,
      keepBranch: false,
      branchDeletion: { branch: "next", target: "next" },
    });

    expect(result.status).toBe(CleanupResult.RETAINED);
    expect(result.reason).toBe("PROTECTED_BRANCH");
    expect(result.worktreeRemoved).toBe(true);
    expect(sh(repo, ["branch", "--list", "next"])).toContain("next");
  });
});
