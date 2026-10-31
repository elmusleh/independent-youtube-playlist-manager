import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import {
  branchExists,
  isProtectedBranch,
  getWorktreeInventory,
  isWorktreeOccupied,
  getDirtyStatus,
  verifyPrerequisites,
  dryRunAllocation,
  createWorktreeGit,
  removeWorktreeGit,
  preflightJob,
  WorkspaceError,
  WorkspaceBackend,
} from "./workspace.js";

function createTempRepo() {
  const tmpDir = fs.mkdtempSync(join("/tmp", "orchestration-test-"));
  execSync("git init -b main", { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: "ignore" });
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

describe("Workspace - Branch utilities", () => {
  let repoPath;

  beforeEach(() => {
    repoPath = createTempRepo();
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("detects existing local branches", () => {
    const result = branchExists(repoPath, "main");
    expect(result.exists).toBe(true);
    expect(result.location).toBe("local");
  });

  it("detects non-existent branches", () => {
    const result = branchExists(repoPath, "non-existent-branch");
    expect(result.exists).toBe(false);
  });

  it("identifies protected branches", () => {
    expect(isProtectedBranch("main")).toBe(true);
    expect(isProtectedBranch("next")).toBe(true);
    expect(isProtectedBranch("release/1.0")).toBe(true);
    expect(isProtectedBranch("hotfix/critical")).toBe(true);
    expect(isProtectedBranch("feature/new-ui")).toBe(false);
    expect(isProtectedBranch("fix/bug-123")).toBe(false);
  });
});

describe("Workspace - Worktree inventory", () => {
  let repoPath;
  let worktreePath;

  beforeEach(() => {
    repoPath = createTempRepo();
    worktreePath = createWorktree(repoPath, "feat/test-branch");
  });

  afterEach(() => {
    removeWorktree(repoPath, worktreePath);
    cleanupTempRepo(repoPath);
  });

  it("lists all worktrees", () => {
    const inventory = getWorktreeInventory(repoPath);
    expect(inventory.length).toBe(2); // main + feat/test-branch

    const mainWt = inventory.find((w) => w.branch === "refs/heads/main" || w.branch === "main");
    expect(mainWt).toBeDefined();
    expect(mainWt.path).toBe(repoPath);

    const featWt = inventory.find(
      (w) => w.branch === "refs/heads/feat/test-branch" || w.branch === "feat/test-branch"
    );
    expect(featWt).toBeDefined();
    expect(featWt.path).toBe(worktreePath);
  });
});

describe("Workspace - Worktree occupancy", () => {
  let repoPath;
  let registry;
  let worktreePath;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath, { maxActive: 2 });
    worktreePath = createWorktree(repoPath, "feat/test-branch");
  });

  afterEach(() => {
    removeWorktree(repoPath, worktreePath);
    cleanupTempRepo(repoPath);
  });

  it("detects occupied worktrees", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test-branch",
      worktreePath,
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    const occupied = isWorktreeOccupied(worktreePath, registry);
    expect(occupied.occupied).toBe(true);
    expect(occupied.jobId).toBe("job-1");
  });

  it("allows excluding job from occupancy check", async () => {
    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/test-branch",
      worktreePath,
      worktreeManager: "git",
      startingSha: "abc123",
      dependencies: [],
      state: "queued",
    });

    const occupied = isWorktreeOccupied(worktreePath, registry, "job-1");
    expect(occupied.occupied).toBe(false);
  });

  it("returns false for unoccupied paths", () => {
    const occupied = isWorktreeOccupied("/tmp/non-existent", registry);
    expect(occupied.occupied).toBe(false);
  });
});

describe("Workspace - Dirty status", () => {
  let repoPath;

  beforeEach(() => {
    repoPath = createTempRepo();
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("detects clean working directory", () => {
    const dirty = getDirtyStatus(repoPath);
    expect(dirty.dirty).toBe(false);
    expect(dirty.files).toEqual([]);
  });

  it("detects uncommitted changes", () => {
    fs.writeFileSync(join(repoPath, "new-file.txt"), "content");
    const dirty = getDirtyStatus(repoPath);
    expect(dirty.dirty).toBe(true);
    expect(dirty.files).toContain("new-file.txt");
  });

  it("detects staged changes", () => {
    fs.writeFileSync(join(repoPath, "staged.txt"), "content");
    execSync("git add staged.txt", { cwd: repoPath, stdio: "ignore" });
    const dirty = getDirtyStatus(repoPath);
    expect(dirty.dirty).toBe(true);
    expect(dirty.files).toContain("staged.txt");
  });
});

describe("Workspace - Prerequisite verification", () => {
  let repoPath;

  beforeEach(() => {
    repoPath = createTempRepo();
    fs.writeFileSync(join(repoPath, "package.json"), '{"name":"test"}');
    fs.mkdirSync(join(repoPath, "src"), { recursive: true });
    fs.writeFileSync(join(repoPath, "src", "index.js"), "console.log('hi')");
    execSync("git add .", { cwd: repoPath, stdio: "ignore" });
    execSync('git commit -m "Add files"', { cwd: repoPath, stdio: "ignore" });
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("verifies existing prerequisites", () => {
    const result = verifyPrerequisites(repoPath, ["package.json", "src/index.js"]);
    expect(result.satisfied).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("detects missing prerequisites", () => {
    const result = verifyPrerequisites(repoPath, ["package.json", "missing.txt"]);
    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain("missing.txt");
  });
});

describe("Workspace - Dry-run allocation", () => {
  let repoPath;
  let registry;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath, { maxActive: 2 });
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("validates valid allocation", () => {
    const worktreePath = join("/tmp", `wt-test-${Date.now()}`);
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    const result = dryRunAllocation({
      repoRoot: repoPath,
      branchName: "feat/new-feature",
      worktreePath,
      startingSha,
      registry,
      policy: { maxActive: 2 },
      changeName: "new-feature",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checks.branchName.valid).toBe(true);
    expect(result.checks.protectedBranch.valid).toBe(true);
    expect(result.checks.branchExists.exists).toBe(false);
    expect(result.checks.startingSha.valid).toBe(true);
  });

  it("rejects protected branch names", () => {
    const worktreePath = join("/tmp", `wt-test-${Date.now()}`);
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    const result = dryRunAllocation({
      repoRoot: repoPath,
      branchName: "main",
      worktreePath,
      startingSha,
      registry,
      policy: { maxActive: 2 },
      changeName: "test",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("protected"))).toBe(true);
  });

  it("rejects existing branches", () => {
    const worktreePath = join("/tmp", `wt-test-${Date.now()}`);
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    const result = dryRunAllocation({
      repoRoot: repoPath,
      branchName: "main", // exists
      worktreePath,
      startingSha,
      registry,
      policy: { maxActive: 2 },
      changeName: "test",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("already exists"))).toBe(true);
  });

  it("rejects invalid starting SHA", () => {
    const worktreePath = join("/tmp", `wt-test-${Date.now()}`);

    const result = dryRunAllocation({
      repoRoot: repoPath,
      branchName: "feat/new-feature",
      worktreePath,
      startingSha: "invalid-sha",
      registry,
      policy: { maxActive: 2 },
      changeName: "test",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not found"))).toBe(true);
  });

  it("warns about dirty source", () => {
    fs.writeFileSync(join(repoPath, "dirty.txt"), "uncommitted");

    const worktreePath = join("/tmp", `wt-test-${Date.now()}`);
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    const result = dryRunAllocation({
      repoRoot: repoPath,
      branchName: "feat/new-feature",
      worktreePath,
      startingSha,
      registry,
      policy: { maxActive: 2 },
      changeName: "test",
    });

    expect(result.valid).toBe(true); // Dirty is warning, not error
    expect(result.warnings.some((w) => w.includes("uncommitted"))).toBe(true);
    expect(result.checks.dirtySource.dirty).toBe(true);
  });

  it("reuses existing job for same change/branch", async () => {
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "existing-change",
      branch: "feat/existing",
      worktreePath: "/tmp/wt-existing",
      worktreeManager: "git",
      startingSha,
      dependencies: [],
      state: "queued",
    });

    const worktreePath = join("/tmp", `wt-test-${Date.now()}`);

    const result = dryRunAllocation({
      repoRoot: repoPath,
      branchName: "feat/existing",
      worktreePath,
      startingSha,
      registry,
      policy: { maxActive: 2 },
      changeName: "existing-change",
    });

    expect(result.reuseExisting).toBe(true);
    expect(result.checks.existingJob.found).toBe(true);
    expect(result.checks.existingJob.jobId).toBe("job-1");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("Workspace - Git worktree creation", () => {
  let repoPath;

  beforeEach(() => {
    repoPath = createTempRepo();
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("creates worktree with git backend", () => {
    const worktreePath = join("/tmp", `wt-create-${Date.now()}`);
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    const result = createWorktreeGit(repoPath, worktreePath, "feat/created", startingSha);

    expect(result.backend).toBe(WorkspaceBackend.GIT);
    expect(result.path).toBe(worktreePath);
    expect(result.branch).toBe("feat/created");

    // Verify worktree exists
    const inventory = getWorktreeInventory(repoPath);
    const created = inventory.find((w) => w.path === worktreePath);
    expect(created).toBeDefined();
    expect(created.branch === "refs/heads/feat/created" || created.branch === "feat/created").toBe(
      true
    );
  });

  it("fails to create duplicate worktree", () => {
    const worktreePath = join("/tmp", `wt-duplicate-${Date.now()}`);
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    createWorktreeGit(repoPath, worktreePath, "feat/first", startingSha);

    expect(() => {
      createWorktreeGit(repoPath, worktreePath, "feat/second", startingSha);
    }).toThrow();
  });
});

describe("Workspace - Worktree removal with dirty protection", () => {
  let repoPath;
  let worktreePath;

  beforeEach(() => {
    repoPath = createTempRepo();
    worktreePath = createWorktree(repoPath, "feat/to-remove");
  });

  afterEach(() => {
    cleanupTempRepo(repoPath);
  });

  it("removes clean worktree", () => {
    const result = removeWorktreeGit(repoPath, worktreePath);
    expect(result.removed).toBe(true);

    // Verify worktree is gone
    const inventory = getWorktreeInventory(repoPath);
    const removed = inventory.find((w) => w.path === worktreePath);
    expect(removed).toBeUndefined();
  });

  it("rejects removal of dirty worktree without force", () => {
    // Make a change in the worktree
    fs.writeFileSync(join(worktreePath, "dirty.txt"), "uncommitted");

    expect(() => {
      removeWorktreeGit(repoPath, worktreePath, false);
    }).toThrow(WorkspaceError);
  });

  it("allows forced removal of dirty worktree", () => {
    fs.writeFileSync(join(worktreePath, "dirty.txt"), "uncommitted");

    const result = removeWorktreeGit(repoPath, worktreePath, true);
    expect(result.removed).toBe(true);
  });

  it("rejects removal of non-worktree path", () => {
    const fakePath = join("/tmp", `fake-${Date.now()}`);
    fs.mkdirSync(fakePath, { recursive: true });

    expect(() => {
      removeWorktreeGit(repoPath, fakePath);
    }).toThrow(WorkspaceError);
  });
});

describe("Workspace - Preflight checks", () => {
  let repoPath;
  let registry;
  let worktreePath;

  beforeEach(() => {
    repoPath = createTempRepo();
    registry = new OrchestrationRegistry(repoPath, { maxActive: 2 });
    worktreePath = createWorktree(repoPath, "feat/preflight");
  });

  afterEach(() => {
    removeWorktree(repoPath, worktreePath);
    cleanupTempRepo(repoPath);
  });

  it("passes preflight for valid job", async () => {
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/preflight",
      worktreePath,
      worktreeManager: "git",
      startingSha,
      dependencies: [],
      state: "queued",
    });

    const result = preflightJob("job-1", registry);
    expect(result.passed).toBe(true);
    expect(result.checks.jobExists).toBe(true);
    expect(result.checks.branchValid).toBe(true);
    expect(result.checks.worktreeAccessible).toBe(true);
    expect(result.checks.startingShaValid).toBe(true);
    expect(result.checks.dependenciesSatisfied).toBe(true);
  });

  it("fails preflight for missing job", () => {
    const result = preflightJob("non-existent", registry);
    expect(result.passed).toBe(false);
    expect(result.checks.jobExists).toBe(false);
  });

  it("fails preflight when dependencies not satisfied", async () => {
    const startingSha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    await registry.createJob({
      id: "job-dep",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "dep-change",
      branch: "feat/dep",
      worktreePath: "/tmp/wt-dep",
      worktreeManager: "git",
      startingSha,
      dependencies: [],
      state: "queued",
    });

    await registry.createJob({
      id: "job-1",
      schemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      changeName: "test-change",
      branch: "feat/preflight",
      worktreePath,
      worktreeManager: "git",
      startingSha,
      dependencies: ["job-dep"],
      state: "queued",
    });

    const result = preflightJob("job-1", registry);
    expect(result.passed).toBe(false);
    expect(result.checks.dependenciesSatisfied).toBe(false);
  });
});
