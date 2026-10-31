import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import { RecoveryManager, RecoveryError } from "./recovery.js";

function createTempRepo() {
  const tmpDir = fs.mkdtempSync(join("/tmp", "orchestration-test-"));
  execSync("git init", { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: "ignore" });
  fs.writeFileSync(join(tmpDir, "README.md"), "# Test Repo\n");
  execSync("git add README.md", { cwd: tmpDir, stdio: "ignore" });
  execSync('git commit -m "Initial commit"', { cwd: tmpDir, stdio: "ignore" });
  return tmpDir;
}

function cleanupTempRepo(repoPath) {
  try {
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
  try {
    fs.rmSync(repoPath, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

describe("RecoveryManager - Journal-based resume", () => {
  let repoPath;
  let registry;
  let recovery;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath, { maxActive: 2 });
    recovery = new RecoveryManager(repoPath, { maxActive: 2 });
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("resumes jobs from journal", async () => {
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

    await registry.updateJob("job-1", { state: "dispatch-pending" });

    const results = await recovery.resumeFromJournal();
    expect(results.length).toBe(1);
    expect(results[0].jobId).toBe("job-1");
    expect(results[0].recovered).toBe(true);
  });

  it("detects dead owner on active job", async () => {
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

    // Claim ownership with invalid PID
    await registry.claimOwnership("job-1", "session-dead", 999999, "ref-dead");

    const status = recovery.getRecoveryStatus();
    const jobStatus = status.find((s) => s.jobId === "job-1");

    expect(jobStatus.needsAttention).toBe(true);
    expect(jobStatus.attentionReasons).toContain("dead-owner");
  });

  it("detects uncertain operations", async () => {
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

    const status = recovery.getRecoveryStatus();
    const jobStatus = status.find((s) => s.jobId === "job-1");

    expect(jobStatus.needsAttention).toBe(true);
    expect(jobStatus.attentionReasons).toContain("uncertain-operations");
    expect(jobStatus.uncertainOperations).toBe(1);
  });

  it("detects blocked state", async () => {
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
      state: "blocked",
    });

    const status = recovery.getRecoveryStatus();
    const jobStatus = status.find((s) => s.jobId === "job-1");

    expect(jobStatus.needsAttention).toBe(true);
    expect(jobStatus.attentionReasons).toContain("blocked");
  });
});

describe("RecoveryManager - Lease reassignment", () => {
  let repoPath;
  let registry;
  let recovery;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath, { maxActive: 2 });
    recovery = new RecoveryManager(repoPath, { maxActive: 2 });
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("reassigns lease when owner is dead", async () => {
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

    // Claim ownership with invalid PID
    await registry.claimOwnership("job-1", "session-dead", 999999, "ref-dead");

    // Reassign lease
    const updated = await recovery.reassignLease(
      "job-1",
      "session-new",
      process.pid,
      "ref-new",
      "owner-dead",
      "admin"
    );

    expect(updated.owner.sessionId).toBe("session-new");
    expect(updated.state).toBe("implementing");

    // Check journal has reassignment entry
    const journal = registry.getJournal("job-1");
    const reassignmentEntry = journal.find((e) => e.evidence?.action === "lease-reassignment");
    expect(reassignmentEntry).toBeDefined();
    expect(reassignmentEntry.evidence.reason).toBe("owner-dead");
    expect(reassignmentEntry.evidence.authorizedBy).toBe("admin");
    expect(reassignmentEntry.previousOwner.sessionId).toBe("session-dead");
  });

  it("rejects reassignment when owner is alive without authorization", async () => {
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

    // Claim ownership with valid PID
    await registry.claimOwnership("job-1", "session-alive", process.pid, "ref-alive");

    // Try to reassign without authorization - should fail
    await expect(
      recovery.reassignLease("job-1", "session-new", process.pid, "ref-new", "test", undefined)
    ).rejects.toThrow(RecoveryError);
  });

  it("allows reassignment when owner is alive with authorization", async () => {
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

    await registry.claimOwnership("job-1", "session-alive", process.pid, "ref-alive");

    // Reassign with explicit authorization
    const updated = await recovery.reassignLease(
      "job-1",
      "session-new",
      process.pid,
      "ref-new",
      "admin-override",
      "admin-user"
    );

    expect(updated.owner.sessionId).toBe("session-new");
  });
});

describe("RecoveryManager - Job cancellation", () => {
  let repoPath;
  let registry;
  let recovery;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath, { maxActive: 2 });
    recovery = new RecoveryManager(repoPath, { maxActive: 2 });
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("cancels job and preserves work", async () => {
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
      state: "implementing",
    });

    await registry.claimOwnership("job-1", "session-owner", process.pid, "ref-owner");

    const cancelled = await recovery.cancelJob("job-1", "session-owner", "user-requested");

    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.operationReceipts).toBeDefined();

    // Journal should have cancellation entry
    const journal = registry.getJournal("job-1");
    const cancelEntry = journal.find((e) => e.evidence?.action === "cancellation");
    expect(cancelEntry).toBeDefined();
    expect(cancelEntry.evidence.reason).toBe("user-requested");
  });

  it("rejects cancellation by non-owner when owner is alive", async () => {
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
      state: "implementing",
    });

    await registry.claimOwnership("job-1", "session-owner", process.pid, "ref-owner");

    await expect(recovery.cancelJob("job-1", "session-other", "malicious")).rejects.toThrow(
      RecoveryError
    );
  });

  it("allows cancellation when owner is dead", async () => {
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
      state: "implementing",
    });

    await registry.claimOwnership("job-1", "session-dead", 999999, "ref-dead");

    const cancelled = await recovery.cancelJob("job-1", "session-admin", "admin-cancel");
    expect(cancelled.state).toBe("cancelled");
  });
});

describe("RecoveryManager - Corruption detection", () => {
  let repoPath;
  let registry;
  let recovery;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath, { maxActive: 2 });
    recovery = new RecoveryManager(repoPath, { maxActive: 2 });
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("detects missing fields in journal entries", async () => {
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

    // Manually corrupt journal by appending malformed entry
    const journalPath = join(repoPath, ".git", "agent-orchestration", "journal.jsonl");
    fs.appendFileSync(journalPath, '{"id":"bad-entry"}\n');

    const recoverResult = await recovery.recoverJob("job-1", { skipEarlyReturn: true });
    expect(recoverResult.requiresManualIntervention).toBe(true);
    expect(recoverResult.corruptedEntries.length).toBeGreaterThan(0);
  });

  it("detects invalid state values in journal", async () => {
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

    // Manually corrupt journal with invalid state
    const journalPath = join(repoPath, ".git", "agent-orchestration", "journal.jsonl");
    fs.appendFileSync(
      journalPath,
      '{"id":"bad-state","jobId":"job-1","fromState":"invalid","toState":"also-invalid","actor":"test","timestamp":"2024-01-01T00:00:00.000Z"}\n'
    );

    const recoverResult = await recovery.recoverJob("job-1", { skipEarlyReturn: true });
    expect(recoverResult.requiresManualIntervention).toBe(true);
    expect(recoverResult.corruptedEntries.some((e) => e.reason === "Invalid state value")).toBe(
      true
    );
  });
});
