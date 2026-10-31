import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import {
  Roles,
  RoleError,
  acquireWriterLease,
  releaseWriterLease,
  transferWriterRole,
  assertRoleCanWrite,
  assertWriterExclusive,
  findWorktreeWriters,
} from "./roles.js";
import {
  ResourceError,
  allocateJobResources,
  releaseJobResources,
  withSharedInstallLock,
} from "./resources.js";

function createTempRepo() {
  const dir = fs.mkdtempSync(join("/tmp", "roles-test-"));
  execSync("git init -q", { cwd: dir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "ignore" });
  execSync('git config user.name "Test User"', { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(join(dir, "README.md"), "# Test\n");
  execSync("git add README.md", { cwd: dir, stdio: "ignore" });
  execSync('git commit -q -m "init"', { cwd: dir, stdio: "ignore" });
  return dir;
}

async function seedJob(registry, overrides = {}) {
  return registry.createJob({
    id: overrides.id || "job-1",
    schemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    changeName: overrides.changeName || "change-1",
    branch: overrides.branch || "feat/job-1",
    worktreePath: overrides.worktreePath || "/tmp/wt/job-1",
    worktreeManager: "git",
    startingSha: "abc123",
    dependencies: overrides.dependencies || [],
    state: overrides.state || "queued",
  });
}

let repo;
let registry;

beforeEach(() => {
  repo = createTempRepo();
  registry = new OrchestrationRegistry(repo, { maxActive: 2 });
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("Roles - single writer per worktree", () => {
  it("grants the implementer an exclusive writer lease", async () => {
    await seedJob(registry);
    const lease = await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });

    expect(lease.role).toBe("implementer");
    expect(assertWriterExclusive(registry, "/tmp/wt/job-1").exclusive).toBe(true);
    expect(registry.getJob("job-1").writerLease.sessionId).toBe("session-a");
  });

  it("refuses a second job writing the same worktree", async () => {
    await seedJob(registry, { id: "job-1" });
    await seedJob(registry, { id: "job-2", branch: "feat/job-2" });

    await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/shared",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });

    await expect(
      acquireWriterLease({
        registry,
        jobId: "job-2",
        worktreePath: "/tmp/wt/shared",
        role: Roles.IMPLEMENTER,
        sessionId: "session-b",
      })
    ).rejects.toThrow(RoleError);
  });

  it("does not let a verifier start writing while implementation holds the lease", async () => {
    await seedJob(registry);
    await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });

    await expect(
      acquireWriterLease({
        registry,
        jobId: "job-1",
        worktreePath: "/tmp/wt/job-1",
        role: Roles.VERIFIER,
        sessionId: "session-b",
      })
    ).rejects.toMatchObject({ code: "ROLE_HANDOFF_REQUIRED" });

    expect(() =>
      assertRoleCanWrite({ registry, jobId: "job-1", role: Roles.VERIFIER, sessionId: "session-b" })
    ).toThrow(RoleError);
  });

  it("allows an explicit handoff from implementer to verifier", async () => {
    await seedJob(registry);
    await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });

    const transfer = await transferWriterRole({
      registry,
      jobId: "job-1",
      from: Roles.IMPLEMENTER,
      to: Roles.VERIFIER,
      sessionId: "session-a",
      evidence: { reason: "implementation paused for file-writing verification" },
    });

    expect(transfer.pausedRole).toBe("implementer");
    expect(transfer.lease.role).toBe("verifier");

    const job = registry.getJob("job-1");
    expect(job.writerLease.role).toBe("verifier");
    expect(job.roleHistory.map((entry) => entry.event)).toEqual(["acquire", "transfer"]);

    expect(() =>
      assertRoleCanWrite({
        registry,
        jobId: "job-1",
        role: Roles.IMPLEMENTER,
        sessionId: "session-a",
      })
    ).toThrow(RoleError);
    expect(
      assertRoleCanWrite({ registry, jobId: "job-1", role: Roles.VERIFIER, sessionId: "session-a" })
        .allowed
    ).toBe(true);
  });

  it("refuses to transfer from the wrong role or to the same role", async () => {
    await seedJob(registry);
    await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });

    await expect(
      transferWriterRole({
        registry,
        jobId: "job-1",
        from: Roles.VERIFIER,
        to: Roles.REVIEWER,
        sessionId: "session-a",
      })
    ).rejects.toMatchObject({ code: "ROLE_OWNER_MISMATCH" });

    await expect(
      transferWriterRole({
        registry,
        jobId: "job-1",
        from: Roles.IMPLEMENTER,
        to: Roles.IMPLEMENTER,
        sessionId: "session-a",
      })
    ).rejects.toMatchObject({ code: "SAME_ROLE_TRANSFER" });
  });

  it("releases a lease only for its recorded holder", async () => {
    await seedJob(registry);
    await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });

    await expect(
      releaseWriterLease({
        registry,
        jobId: "job-1",
        role: Roles.IMPLEMENTER,
        sessionId: "session-b",
      })
    ).rejects.toMatchObject({ code: "LEASE_OWNER_MISMATCH" });

    const released = await releaseWriterLease({
      registry,
      jobId: "job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });
    expect(released.released).toBe(true);
    expect(findWorktreeWriters(registry, "/tmp/wt/job-1")).toEqual([]);
  });

  it("lets the holder re-acquire idempotently", async () => {
    await seedJob(registry);
    await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });
    const again = await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });
    expect(again.reused).toBe(true);
  });

  it("rejects non-writing roles", async () => {
    await seedJob(registry);
    await expect(
      acquireWriterLease({
        registry,
        jobId: "job-1",
        worktreePath: "/tmp/wt/job-1",
        role: Roles.COORDINATOR,
        sessionId: "session-a",
      })
    ).rejects.toMatchObject({ code: "ROLE_NOT_WRITING" });
  });
});

describe("Roles - two independent jobs proceed safely", () => {
  it("allows separate worktrees to hold writers at the same time", async () => {
    await seedJob(registry, { id: "job-1", worktreePath: "/tmp/wt/job-1" });
    await seedJob(registry, { id: "job-2", branch: "feat/job-2", worktreePath: "/tmp/wt/job-2" });

    await acquireWriterLease({
      registry,
      jobId: "job-1",
      worktreePath: "/tmp/wt/job-1",
      role: Roles.IMPLEMENTER,
      sessionId: "session-a",
    });
    await acquireWriterLease({
      registry,
      jobId: "job-2",
      worktreePath: "/tmp/wt/job-2",
      role: Roles.IMPLEMENTER,
      sessionId: "session-b",
    });

    expect(assertWriterExclusive(registry, "/tmp/wt/job-1").exclusive).toBe(true);
    expect(assertWriterExclusive(registry, "/tmp/wt/job-2").exclusive).toBe(true);
    expect(findWorktreeWriters(registry, "/tmp/wt/job-1")).toHaveLength(1);
    expect(findWorktreeWriters(registry, "/tmp/wt/job-2")).toHaveLength(1);
  });
});

describe("Resources - port and profile allocation", () => {
  it("allocates distinct ports and profiles to two independent jobs", async () => {
    await seedJob(registry, { id: "job-1" });
    await seedJob(registry, { id: "job-2", branch: "feat/job-2" });

    const first = await allocateJobResources({ registry, jobId: "job-1" });
    const second = await allocateJobResources({ registry, jobId: "job-2" });

    expect(first.ports[0]).not.toBe(second.ports[0]);
    expect(first.profile).not.toBe(second.profile);
    expect(registry.getJob("job-1").resources.ports).toEqual(first.ports);
    expect(registry.getJob("job-2").resources.profile).toBe(second.profile);
  });

  it("is idempotent for the same job", async () => {
    await seedJob(registry);
    const first = await allocateJobResources({ registry, jobId: "job-1" });
    const again = await allocateJobResources({ registry, jobId: "job-1" });
    expect(again.reused).toBe(true);
    expect(again.ports).toEqual(first.ports);
  });

  it("reports exhaustion instead of reusing a busy port", async () => {
    await seedJob(registry, { id: "job-1" });
    await seedJob(registry, { id: "job-2", branch: "feat/job-2" });

    await allocateJobResources({
      registry,
      jobId: "job-1",
      portRange: { start: 5000, end: 5000 },
      profiles: ["profile-1", "profile-2"],
    });

    await expect(
      allocateJobResources({
        registry,
        jobId: "job-2",
        portRange: { start: 5000, end: 5000 },
        profiles: ["profile-1", "profile-2"],
      })
    ).rejects.toMatchObject({ code: "RESOURCE_EXHAUSTED" });
  });

  it("releases resources for reuse", async () => {
    await seedJob(registry);
    const allocated = await allocateJobResources({ registry, jobId: "job-1" });
    const released = await releaseJobResources({ registry, jobId: "job-1" });

    expect(released.released).toBe(true);
    expect(registry.getJob("job-1").resources).toBeNull();

    const reallocated = await allocateJobResources({ registry, jobId: "job-1" });
    expect(reallocated.ports).toEqual(allocated.ports);
  });
});

describe("Resources - shared installs are serialized", () => {
  it("runs one install at a time and keeps the lock file out of the way", async () => {
    const order = [];
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = (name, delay) => async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      order.push(`${name}:end`);
      concurrent -= 1;
      return name;
    };

    const [first, second] = await Promise.all([
      withSharedInstallLock(
        { registry, installKey: "node_modules", owner: "job-1" },
        task("first", 30)
      ),
      withSharedInstallLock(
        { registry, installKey: "node_modules", owner: "job-2" },
        task("second", 5)
      ),
    ]);

    expect(first).toBe("first");
    expect(second).toBe("second");
    expect(maxConcurrent).toBe(1);
    expect(order[0]).toBe("first:start");
    expect(order[1]).toBe("first:end");
    expect(order[3]).toBe("second:end");

    const locksDir = join(registry.registryDir, "locks");
    expect(fs.readdirSync(locksDir)).toEqual([]);
  });

  it("reports a timeout when another owner holds the install lock", async () => {
    const lockPath = join(registry.registryDir, "locks");
    fs.mkdirSync(lockPath, { recursive: true });
    fs.writeFileSync(join(lockPath, "install-node_modules.lock"), "{}");

    await expect(
      withSharedInstallLock(
        { registry, installKey: "node_modules", timeoutMs: 50, pollMs: 10 },
        async () => "unreachable"
      )
    ).rejects.toBeInstanceOf(ResourceError);
  });
});
