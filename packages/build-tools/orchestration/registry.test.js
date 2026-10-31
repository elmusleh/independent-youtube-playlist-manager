import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { OrchestrationRegistry, RegistryError } from "./registry.js";

function createTempRepo() {
  const tmpDir = fs.mkdtempSync(join("/tmp", "orchestration-test-"));
  execSync("git init -b main", { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: "ignore" });
  // Create initial commit
  fs.writeFileSync(join(tmpDir, "README.md"), "# Test Repo\n");
  execSync("git add README.md", { cwd: tmpDir, stdio: "ignore" });
  execSync('git commit -m "Initial commit"', { cwd: tmpDir, stdio: "ignore" });
  return tmpDir;
}

function createWorktree(repoPath, branchName) {
  const worktreePath = join(
    "/tmp",
    `wt-${branchName}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  execSync(`git worktree add -b ${branchName} ${worktreePath}`, { cwd: repoPath, stdio: "ignore" });
  return worktreePath;
}

function removeWorktree(repoPath, worktreePath) {
  try {
    execSync(`git worktree remove ${worktreePath}`, { cwd: repoPath, stdio: "ignore" });
  } catch {
    // Ignore cleanup errors
  }
}

function cleanupTempRepo(repoPath) {
  try {
    // Remove any worktrees first
    const output = execSync("git worktree list --porcelain", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    });
    const lines = output.trim().split("\n");
    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        const wtPath = line.slice("worktree ".length).trim();
        if (wtPath !== repoPath) {
          execSync(`git worktree remove --force ${wtPath}`, { cwd: repoPath, stdio: "ignore" });
        }
      }
    }
  } catch {
    // Ignore
  }
  // Remove temp directory
  try {
    fs.rmSync(repoPath, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

describe("OrchestrationRegistry - Git Common Directory", () => {
  let repoPath;
  let registry;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath);
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("creates registry in Git common directory", () => {
    const commonDir = execSync("git rev-parse --git-common-dir", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    const expectedRegistryDir = join(repoPath, commonDir, "agent-orchestration");

    expect(fs.existsSync(expectedRegistryDir)).toBe(true);
    expect(fs.existsSync(join(expectedRegistryDir, "jobs"))).toBe(true);
    expect(fs.existsSync(join(expectedRegistryDir, "journal.jsonl"))).toBe(true);
  });

  it("creates and retrieves a job", async () => {
    const job = await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    expect(job.id).toBe("job-1");
    expect(job.changeName).toBe("test-change");
    expect(job.state).toBe("queued");
    expect(job.operationReceipts).toEqual([]);
    expect(job.createdAt).toBeDefined();
    expect(job.updatedAt).toBeDefined();

    const retrieved = registry.getJob("job-1");
    expect(retrieved).toEqual(job);
  });

  it("prevents duplicate job creation", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    await expect(
      registry.createJob({
        id: "job-1",
        schemaVersion: "1.0.0",
        policyVersion: "1.0.0",
        changeName: "test-change-2",
        branch: "feat/test-2",
        worktreePath: "/tmp/worktree-2",
        worktreeManager: "git",
        startingSha: "def456",
        dependencies: [],
        state: "queued",
      })
    ).rejects.toThrow(RegistryError);
  });

  it("updates job state and records journal entry", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Valid transition: queued -> dispatch-pending
    const updated = await registry.updateJob("job-1", { state: "dispatch-pending" });
    expect(updated.state).toBe("dispatch-pending");
    expect(updated.updatedAt).not.toBe(updated.createdAt);

    const journal = registry.getJournal("job-1");
    expect(journal.length).toBe(2); // create + update
    expect(journal[1].fromState).toBe("queued");
    expect(journal[1].toState).toBe("dispatch-pending");
  });

  it("handles ownership claim with conflict detection", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    // First session claims ownership
    const job1 = await registry.claimOwnership("job-1", "session-A", process.pid, "ref-A");
    expect(job1.owner.sessionId).toBe("session-A");
    expect(job1.state).toBe("implementing");

    // Second session tries to claim - should fail due to alive owner
    await expect(
      registry.claimOwnership("job-1", "session-B", process.pid + 1, "ref-B")
    ).rejects.toThrow(RegistryError);
  });

  it("allows ownership reassignment when owner appears dead", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    // First session claims ownership with invalid PID
    await registry.claimOwnership("job-1", "session-A", 999999, "ref-A");

    // Second session claims ownership - should succeed because PID 999999 is dead
    const job = await registry.claimOwnership("job-1", "session-B", process.pid, "ref-B");
    expect(job.owner.sessionId).toBe("session-B");
  });

  it("releases ownership correctly", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    await registry.claimOwnership("job-1", "session-A", process.pid, "ref-A");
    const released = await registry.releaseOwnership("job-1", "session-A");

    expect(released.owner).toBeUndefined();
    expect(released.state).toBe("verification-pending");
  });

  it("rejects release from non-owner", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    await registry.claimOwnership("job-1", "session-A", process.pid, "ref-A");

    await expect(registry.releaseOwnership("job-1", "session-B")).rejects.toThrow(RegistryError);
  });

  it("updates heartbeat", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    await registry.claimOwnership("job-1", "session-A", process.pid, "ref-A");
    const before = registry.getJob("job-1").owner.lastHeartbeat;

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updated = await registry.updateHeartbeat("job-1", "session-A");
    expect(updated.owner.lastHeartbeat).not.toBe(before);
  });

  it("adds operation receipts", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/worktree-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    const updated = await registry.addOperationReceipt("job-1", {
      type: "push",
      status: "completed",
      command: ["git", "push", "origin", "feat/test"],
      exitCode: 0,
      output: "Everything up-to-date",
      idempotencyKey: "push-job-1-feat-test",
    });

    expect(updated.operationReceipts.length).toBe(1);
    expect(updated.operationReceipts[0].type).toBe("push");
    expect(updated.operationReceipts[0].status).toBe("completed");
    expect(updated.operationReceipts[0].idempotencyKey).toBe("push-job-1-feat-test");
  });

  it("lists jobs sorted by creation time", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "change-a",
      branch: "feat/a",
      worktreePath: "/tmp/wt-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    await registry.createJob({
      id: "job-2",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "change-b",
      branch: "feat/b",
      worktreePath: "/tmp/wt-2",
      worktreeManager: "git",
      startingSha: "def456",
      dependencies: [],
      state: "queued",
    });

    const jobs = registry.listJobs();
    expect(jobs.length).toBe(2);
    expect(jobs[0].id).toBe("job-1");
    expect(jobs[1].id).toBe("job-2");
  });

  it("filters active jobs correctly", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "change-a",
      branch: "feat/a",
      worktreePath: "/tmp/wt-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "implementing",
    });

    await registry.createJob({
      id: "job-2",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "change-b",
      branch: "feat/b",
      worktreePath: "/tmp/wt-2",
      worktreeManager: "git",
      startingSha: "def456",
      dependencies: [],
      state: "merged",
    });

    await registry.createJob({
      id: "job-3",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "change-c",
      branch: "feat/c",
      worktreePath: "/tmp/wt-3",
      worktreeManager: "git",
      startingSha: "ghi789",
      dependencies: [],
      state: "verifying",
    });

    const active = registry.getActiveJobs();
    expect(active.length).toBe(2);
    expect(active.map((j) => j.id).sort()).toEqual(["job-1", "job-3"]);
  });

  it("filters jobs by change name", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "feature-x",
      branch: "feat/x1",
      worktreePath: "/tmp/wt-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    await registry.createJob({
      id: "job-2",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "feature-x",
      branch: "feat/x2",
      worktreePath: "/tmp/wt-2",
      worktreeManager: "git",
      startingSha: "def456",
      dependencies: [],
      state: "queued",
    });

    await registry.createJob({
      id: "job-3",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "feature-y",
      branch: "feat/y1",
      worktreePath: "/tmp/wt-3",
      worktreeManager: "git",
      startingSha: "ghi789",
      dependencies: [],
      state: "queued",
    });

    const featureXJobs = registry.getJobsByChange("feature-x");
    expect(featureXJobs.length).toBe(2);
    expect(featureXJobs.every((j) => j.changeName === "feature-x")).toBe(true);
  });
});

describe("OrchestrationRegistry - Multi-worktree shared registry", () => {
  let repoPath;
  let worktree1Path;
  let worktree2Path;

  beforeEach(() => {
    repoPath = createTempRepo();
    worktree1Path = createWorktree(repoPath, "feat/worktree-1");
    worktree2Path = createWorktree(repoPath, "feat/worktree-2");
  });

  afterEach(() => {
    removeWorktree(repoPath, worktree1Path);
    removeWorktree(repoPath, worktree2Path);
    cleanupTempRepo(repoPath);
  });

  it("all worktrees resolve to the same registry", async () => {
    const registryMain = new OrchestrationRegistry(repoPath);
    const registryWt1 = new OrchestrationRegistry(worktree1Path);
    const registryWt2 = new OrchestrationRegistry(worktree2Path);

    // Create job from main repo
    await registryMain.createJob({
      id: "shared-job",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "shared-change",
      branch: "feat/shared",
      worktreePath: worktree1Path,
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    // Retrieve from worktree 1
    const jobFromWt1 = registryWt1.getJob("shared-job");
    expect(jobFromWt1).toBeDefined();
    expect(jobFromWt1.id).toBe("shared-job");

    // Retrieve from worktree 2
    const jobFromWt2 = registryWt2.getJob("shared-job");
    expect(jobFromWt2).toBeDefined();
    expect(jobFromWt2.id).toBe("shared-job");

    // Both should see the same data
    expect(jobFromWt1).toEqual(jobFromWt2);
  });

  it("concurrent ownership claims from different worktrees have one winner", async () => {
    const registryWt1 = new OrchestrationRegistry(worktree1Path);
    const registryWt2 = new OrchestrationRegistry(worktree2Path);

    // Create job from main
    const registryMain = new OrchestrationRegistry(repoPath);
    await registryMain.createJob({
      id: "contested-job",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "contested-change",
      branch: "feat/contested",
      worktreePath: worktree1Path,
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    // Both worktrees try to claim ownership simultaneously
    // The lock ensures only one succeeds
    const result1 = await registryWt1.claimOwnership(
      "contested-job",
      "session-wt1",
      process.pid,
      "ref-wt1"
    );
    expect(result1.owner.sessionId).toBe("session-wt1");

    // Second claim should fail
    await expect(
      registryWt2.claimOwnership("contested-job", "session-wt2", process.pid + 1, "ref-wt2")
    ).rejects.toThrow(RegistryError);

    // Verify the winner is recorded
    const job = registryWt2.getJob("contested-job");
    expect(job.owner.sessionId).toBe("session-wt1");
  });

  it("atomic writes prevent corruption under concurrent access", async () => {
    const registryWt1 = new OrchestrationRegistry(worktree1Path);
    const registryWt2 = new OrchestrationRegistry(worktree2Path);

    const registryMain = new OrchestrationRegistry(repoPath);
    await registryMain.createJob({
      id: "atomic-job",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "atomic-change",
      branch: "feat/atomic",
      worktreePath: worktree1Path,
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    // First transition to dispatch-pending (valid from queued)
    await registryMain.updateJob("atomic-job", { state: "dispatch-pending" });

    // Simulate concurrent ownership claims from both worktrees
    // Only one should succeed
    const [result1, result2] = await Promise.allSettled([
      registryWt1.claimOwnership("atomic-job", "session-wt1", process.pid, "ref-wt1"),
      registryWt2.claimOwnership("atomic-job", "session-wt2", process.pid + 1, "ref-wt2"),
    ]);

    // Exactly one should succeed
    const successCount = [result1, result2].filter((r) => r.status === "fulfilled").length;
    expect(successCount).toBe(1);

    // Final state should be implementing with one owner
    const finalJob = registryMain.getJob("atomic-job");
    expect(finalJob).toBeDefined();
    expect(finalJob.state).toBe("implementing");
    expect(finalJob.owner).toBeDefined();
  });
});

describe("OrchestrationRegistry - Journal and recovery", () => {
  let repoPath;
  let registry;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath);
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("maintains append-only journal", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/wt-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    // Follow valid state transitions: queued -> dispatch-pending -> implementing -> verification-pending -> verifying -> review-pending -> reviewing
    await registry.updateJob("job-1", { state: "dispatch-pending" });
    // Claim ownership before implementing
    await registry.claimOwnership("job-1", "session-test", process.pid, "ref-test");
    await registry.updateJob("job-1", { state: "verification-pending" });
    // verifying requires verifier assignment context
    await registry.transitionJob("job-1", "verifying", { verifierAssigned: true });
    await registry.updateJob("job-1", { state: "review-pending" });
    // reviewing requires reviewer assignment context
    await registry.transitionJob("job-1", "reviewing", { reviewerAssigned: true });

    const journal = registry.getJournal("job-1");
    expect(journal.length).toBe(7); // create + 6 updates

    const states = journal.map((e) => e.toState);
    expect(states).toEqual([
      "queued",
      "dispatch-pending",
      "implementing",
      "verification-pending",
      "verifying",
      "review-pending",
      "reviewing",
    ]);
  });

  it("reconciles uncertain operations", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test",
      worktreePath: "/tmp/wt-1",
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    await registry.addOperationReceipt("job-1", {
      type: "push",
      status: "uncertain",
      command: ["git", "push"],
      idempotencyKey: "push-1",
    });

    await registry.addOperationReceipt("job-1", {
      type: "pr-create",
      status: "completed",
      command: ["gh", "pr", "create"],
      exitCode: 0,
      idempotencyKey: "pr-create-1",
    });

    const uncertain = registry.reconcileUncertainOperations();
    expect(uncertain.length).toBe(1);
    expect(uncertain[0].jobId).toBe("job-1");
    expect(uncertain[0].receipt.type).toBe("push");
    expect(uncertain[0].receipt.status).toBe("uncertain");
  });
});
