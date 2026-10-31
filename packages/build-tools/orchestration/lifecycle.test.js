import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import {
  GitWorktreeManager,
  ManagedWorktreeManager,
  WorktreeCapabilityError,
  selectWorktreeManager,
  assignWorkspace,
  releaseWorkspace,
} from "./lifecycle.js";
import { getWorktreeInventory, WorkspaceBackend } from "./workspace.js";

function createTempRepo() {
  const dir = fs.mkdtempSync(join("/tmp", "lifecycle-test-"));
  execSync("git init -q -b main", { cwd: dir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "ignore" });
  execSync('git config user.name "Test User"', { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(join(dir, "README.md"), "# Test\n");
  execSync("git add README.md", { cwd: dir, stdio: "ignore" });
  execSync('git commit -q -m "init"', { cwd: dir, stdio: "ignore" });
  return dir;
}

function headSha(repo) {
  return execSync("git rev-parse HEAD", { cwd: repo, encoding: "utf-8", stdio: "pipe" }).trim();
}

function cleanupRepo(repo) {
  try {
    execSync("git worktree list --porcelain", { cwd: repo, encoding: "utf-8", stdio: "pipe" })
      .split("\n")
      .filter((line) => line.startsWith("worktree "))
      .map((line) => line.slice("worktree ".length).trim())
      .filter((path) => path !== repo)
      .forEach((path) => {
        try {
          execSync(`git worktree remove --force "${path}"`, { cwd: repo, stdio: "ignore" });
        } catch {
          /* gone */
        }
      });
  } catch {
    /* ignore */
  }
  fs.rmSync(repo, { recursive: true, force: true });
}

async function seedJob(registry, overrides = {}) {
  return registry.createJob({
    id: overrides.id || "job-1",
    schemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    changeName: overrides.changeName || "change-1",
    branch: overrides.branch || "feat/job-1",
    worktreePath: overrides.worktreePath ?? null,
    worktreeManager: overrides.worktreeManager ?? null,
    managerWorktreeId: overrides.managerWorktreeId ?? null,
    startingSha: overrides.startingSha || "abc123",
    dependencies: overrides.dependencies || [],
    state: overrides.state || "queued",
  });
}

/**
 * Fake app-managed API: creates a real directory so dirty checks are meaningful.
 */
function createFakeProvider({ failCreate = false } = {}) {
  const calls = { create: [], archive: [], list: [] };
  return {
    calls,
    async create(request) {
      calls.create.push(request);
      if (failCreate) throw new Error("manager create failed");
      fs.mkdirSync(request.worktreePath, { recursive: true });
      fs.writeFileSync(join(request.worktreePath, ".managed-workspace"), request.jobId);
      return {
        managerWorktreeId: `mgr-${request.jobId}`,
        path: request.worktreePath,
        branch: request.branchName,
      };
    },
    async archive(request) {
      calls.archive.push(request);
      fs.rmSync(request.worktreePath, { recursive: true, force: true });
      return { removed: true };
    },
    async list() {
      calls.list.push(true);
      return [];
    },
    async isDirty({ worktreePath }) {
      try {
        return fs.readdirSync(worktreePath).some((entry) => entry !== ".managed-workspace");
      } catch {
        return true;
      }
    },
  };
}

describe("Lifecycle - capability detection", () => {
  it("reports the Git adapter as available and capable", () => {
    const manager = new GitWorktreeManager();
    expect(manager.isAvailable()).toBe(true);
    expect(manager.backend).toBe(WorkspaceBackend.GIT);
    expect(manager.supports("create")).toBe(true);
    expect(manager.supports("archive")).toBe(true);
    expect(manager.supports("inventory")).toBe(true);
  });

  it("treats a managed manager without a provider as unavailable", () => {
    expect(new ManagedWorktreeManager({ provider: null }).isAvailable()).toBe(false);
  });

  it("treats a managed manager with missing capabilities as unavailable", () => {
    const manager = new ManagedWorktreeManager({
      provider: { create: async () => ({ managerWorktreeId: "x" }) },
    });
    expect(manager.supports("create")).toBe(true);
    expect(manager.supports("archive")).toBe(false);
    expect(manager.isAvailable()).toBe(false);
  });
});

describe("Lifecycle - backend selection", () => {
  const git = new GitWorktreeManager();

  it("prefers a capable managed manager", () => {
    const managed = new ManagedWorktreeManager({
      id: "fake-managed",
      provider: createFakeProvider(),
    });
    expect(selectWorktreeManager({ managers: [git, managed] })).toBe(managed);
  });

  it("falls back to Git when no managed manager is available", () => {
    const managed = new ManagedWorktreeManager({ provider: null });
    expect(selectWorktreeManager({ managers: [git, managed] })).toBe(git);
  });

  it("refuses the Git fallback when it is not permitted", () => {
    const managed = new ManagedWorktreeManager({ provider: null });
    expect(() =>
      selectWorktreeManager({ managers: [git, managed], allowGitFallback: false })
    ).toThrow(WorktreeCapabilityError);
  });

  it("throws when no manager is usable", () => {
    expect(() => selectWorktreeManager({ managers: [] })).toThrow(WorktreeCapabilityError);
  });
});

describe("Lifecycle - managed creation owns the workspace", () => {
  let repo;
  let registry;
  let provider;
  let managed;

  beforeEach(async () => {
    repo = createTempRepo();
    registry = new OrchestrationRegistry(repo, { maxActive: 2 });
    provider = createFakeProvider();
    managed = new ManagedWorktreeManager({ id: "fake-managed", provider });
    await seedJob(registry, { startingSha: headSha(repo) });
  });

  afterEach(() => {
    cleanupRepo(repo);
  });

  it("records the managed owner and identifier on the job", async () => {
    const managedPath = join("/tmp", `managed-wt-${Date.now()}`);
    const result = await assignWorkspace({
      manager: managed,
      registry,
      jobId: "job-1",
      params: {
        repoRoot: repo,
        worktreePath: managedPath,
        branchName: "feat/job-1",
        startingSha: headSha(repo),
      },
    });

    expect(result.created).toBe(true);
    expect(result.owner).toBe("fake-managed");
    expect(provider.calls.create).toHaveLength(1);

    const job = registry.getJob("job-1");
    expect(job.worktreeManager).toBe("fake-managed");
    expect(job.managerWorktreeId).toBe("mgr-job-1");
    expect(job.worktreePath).toBe(managedPath);

    // No git worktree was created: the managed backend owns creation.
    expect(getWorktreeInventory(repo)).toHaveLength(1);
  });

  it("refuses to claim creation when the manager returns no identifier", async () => {
    const unconfirmed = new ManagedWorktreeManager({
      id: "unconfirmed",
      provider: {
        create: async () => ({}),
        archive: async () => ({ removed: true }),
        list: async () => [],
      },
    });

    await expect(
      assignWorkspace({
        manager: unconfirmed,
        registry,
        jobId: "job-1",
        params: {
          repoRoot: repo,
          worktreePath: join(repo, ".worktrees", "job-1"),
          branchName: "feat/job-1",
          startingSha: headSha(repo),
        },
      })
    ).rejects.toThrow(WorktreeCapabilityError);
  });

  it("reuses an existing worktree instead of creating a second one", async () => {
    const worktreePath = join("/tmp", `managed-reuse-${Date.now()}`);
    fs.mkdirSync(worktreePath, { recursive: true });
    await registry.patchJob("job-1", { worktreePath, worktreeManager: "fake-managed" });

    const result = await assignWorkspace({
      manager: managed,
      registry,
      jobId: "job-1",
      params: {
        repoRoot: repo,
        worktreePath,
        branchName: "feat/job-1",
        startingSha: headSha(repo),
      },
    });

    expect(result.reused).toBe(true);
    expect(provider.calls.create).toHaveLength(0);
  });
});

describe("Lifecycle - Git fallback owns creation", () => {
  let repo;
  let registry;

  beforeEach(async () => {
    repo = createTempRepo();
    registry = new OrchestrationRegistry(repo, { maxActive: 2 });
    await seedJob(registry, { startingSha: headSha(repo) });
  });

  afterEach(() => {
    cleanupRepo(repo);
  });

  it("creates a real worktree and records the git owner", async () => {
    const git = selectWorktreeManager({ managers: [new GitWorktreeManager()] });
    const worktreePath = join("/tmp", `lifecycle-git-${Date.now()}`);

    const result = await assignWorkspace({
      manager: git,
      registry,
      jobId: "job-1",
      params: {
        repoRoot: repo,
        worktreePath,
        branchName: "feat/job-1",
        startingSha: headSha(repo),
      },
    });

    expect(result.created).toBe(true);
    expect(result.owner).toBe("git");

    const job = registry.getJob("job-1");
    expect(job.worktreeManager).toBe("git");
    expect(job.managerWorktreeId).toBeNull();
    expect(fs.existsSync(worktreePath)).toBe(true);
  });
});

describe("Lifecycle - cleanup never forces dirty work away", () => {
  let repo;
  let registry;
  let provider;
  let managed;
  let worktreePath;

  beforeEach(async () => {
    repo = createTempRepo();
    registry = new OrchestrationRegistry(repo, { maxActive: 2 });
    provider = createFakeProvider();
    managed = new ManagedWorktreeManager({ id: "fake-managed", provider });
    worktreePath = join(
      "/tmp",
      `managed-cleanup-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  });

  afterEach(() => {
    cleanupRepo(repo);
    fs.rmSync(worktreePath, { recursive: true, force: true });
  });

  it("refuses to archive a dirty managed workspace and keeps it", async () => {
    await seedJob(registry, {
      worktreePath,
      worktreeManager: "fake-managed",
      managerWorktreeId: "mgr-job-1",
    });
    fs.mkdirSync(worktreePath, { recursive: true });
    fs.writeFileSync(join(worktreePath, "uncommitted.txt"), "work in progress");

    const result = await releaseWorkspace({ manager: managed, registry, jobId: "job-1" });

    expect(result.removed).toBe(false);
    expect(result.reason).toBe("DIRTY_WORKTREE");
    expect(result.cleanupAction).toBe("preserve-and-report");
    expect(provider.calls.archive).toHaveLength(0);
    expect(fs.existsSync(join(worktreePath, "uncommitted.txt"))).toBe(true);
    expect(registry.getJob("job-1").worktreePath).toBe(worktreePath);
  });

  it("archives a clean managed workspace through its owner", async () => {
    await seedJob(registry, {
      worktreePath,
      worktreeManager: "fake-managed",
      managerWorktreeId: "mgr-job-1",
    });
    fs.mkdirSync(worktreePath, { recursive: true });

    const result = await releaseWorkspace({ manager: managed, registry, jobId: "job-1" });

    expect(result.removed).toBe(true);
    expect(provider.calls.archive).toHaveLength(1);
    expect(provider.calls.archive[0].managerWorktreeId).toBe("mgr-job-1");
    expect(fs.existsSync(worktreePath)).toBe(false);
    expect(registry.getJob("job-1").worktreePath).toBeNull();
  });

  it("refuses to archive when dirt status cannot be determined", async () => {
    const blind = new ManagedWorktreeManager({
      id: "blind-manager",
      provider: {
        create: async () => ({ managerWorktreeId: "x" }),
        archive: async () => ({ removed: true }),
        list: async () => [],
      },
    });
    await seedJob(registry, {
      worktreePath,
      worktreeManager: "blind-manager",
      managerWorktreeId: "x",
    });
    fs.mkdirSync(worktreePath, { recursive: true });
    fs.writeFileSync(join(worktreePath, "maybe-work.txt"), "unknown provenance");

    const result = await releaseWorkspace({ manager: blind, registry, jobId: "job-1" });

    expect(result.removed).toBe(false);
    expect(result.reason).toBe("DIRTY_STATUS_UNKNOWN");
    expect(fs.existsSync(join(worktreePath, "maybe-work.txt"))).toBe(true);
  });

  it("refuses to archive a dirty Git worktree unless forced", async () => {
    execSync(`git worktree add -q -b feat/job-1 "${worktreePath}"`, { cwd: repo, stdio: "ignore" });
    await seedJob(registry, { worktreePath, worktreeManager: "git" });
    fs.writeFileSync(join(worktreePath, "dirty.txt"), "work");

    const result = await releaseWorkspace({ registry, jobId: "job-1" });

    expect(result.removed).toBe(false);
    expect(result.reason).toBe("DIRTY_WORKTREE");
    expect(fs.existsSync(join(worktreePath, "dirty.txt"))).toBe(true);
    expect(getWorktreeInventory(repo)).toHaveLength(2);
  });

  it("archives a clean Git worktree through the recorded owner", async () => {
    execSync(`git worktree add -q -b feat/job-1 "${worktreePath}"`, { cwd: repo, stdio: "ignore" });
    await seedJob(registry, { worktreePath, worktreeManager: "git" });

    const result = await releaseWorkspace({ registry, jobId: "job-1" });

    expect(result.removed).toBe(true);
    expect(result.owner).toBe("git");
    expect(getWorktreeInventory(repo)).toHaveLength(1);
  });

  it("refuses to guess a lifecycle owner for an unrecorded job", async () => {
    await seedJob(registry, { worktreePath, worktreeManager: null });
    fs.mkdirSync(worktreePath, { recursive: true });

    await expect(releaseWorkspace({ registry, jobId: "job-1" })).rejects.toThrow(
      WorktreeCapabilityError
    );
  });
});

describe("Lifecycle - backend ownership is exclusive", () => {
  let repo;
  let registry;

  beforeEach(async () => {
    repo = createTempRepo();
    registry = new OrchestrationRegistry(repo, { maxActive: 2 });
  });

  afterEach(() => {
    cleanupRepo(repo);
  });

  it("does not touch Git when the managed backend owns the job", async () => {
    await seedJob(registry, { startingSha: headSha(repo) });
    const provider = createFakeProvider();
    const managed = new ManagedWorktreeManager({ id: "fake-managed", provider });
    const git = new GitWorktreeManager();
    const gitCreate = vi.spyOn(git, "create");

    const selected = selectWorktreeManager({ managers: [git, managed] });
    const worktreePath = join("/tmp", `managed-exclusive-${Date.now()}`);

    await assignWorkspace({
      manager: selected,
      registry,
      jobId: "job-1",
      params: {
        repoRoot: repo,
        worktreePath,
        branchName: "feat/job-1",
        startingSha: headSha(repo),
      },
    });
    await releaseWorkspace({ manager: selected, registry, jobId: "job-1" });

    expect(gitCreate).not.toHaveBeenCalled();
    expect(provider.calls.create).toHaveLength(1);
    expect(provider.calls.archive).toHaveLength(1);
  });
});
