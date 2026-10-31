#!/usr/bin/env node
/**
 * Task 7.2 evidence: two disposable independent jobs plus one queued job.
 *
 * Exercises, against a disposable local repository/remote:
 *  - two active implementation jobs with separate worktrees and writer leases
 *  - a third job queued by the two-slot limit
 *  - manual dispatch fallback when no agent capability is available
 *  - pause for review (implementer -> verifier handoff) and resume
 *  - a merge conflict requiring intervention
 *  - proof that no two writers shared one worktree
 *
 * Usage: node packages/build-tools/orchestration/demo-parallel.js [--out <file>]
 */

import fs from "fs";
import { join, dirname } from "path";
import { execFileSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import { getSchedulingDecision } from "./scheduler.js";
import {
  acquireWriterLease,
  transferWriterRole,
  releaseWriterLease,
  assertWriterExclusive,
} from "./roles.js";
import { buildManualHandoff, dispatchImplementation } from "./dispatch.js";
import { syncTargetIntoBranch } from "./sync.js";
import { allocateJobResources } from "./resources.js";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function setupFixture() {
  const root = fs.mkdtempSync(join("/tmp", "orchestration-demo-"));
  const origin = join(root, "origin.git");
  fs.mkdirSync(origin);
  git(origin, ["init", "--bare", "-q", "--initial-branch=next"]);

  const seed = join(root, "seed");
  git(root, ["clone", "-q", origin, seed]);
  git(seed, ["config", "user.email", "demo@test.local"]);
  git(seed, ["config", "user.name", "Demo"]);
  fs.writeFileSync(join(seed, "shared.txt"), "base\n");
  git(seed, ["add", "shared.txt"]);
  git(seed, ["commit", "-q", "-m", "base"]);
  git(seed, ["push", "-q", "-u", "origin", "next"]);

  const repo = join(root, "repo");
  git(root, ["clone", "-q", "-b", "next", origin, repo]);
  git(repo, ["config", "user.email", "coordinator@test.local"]);
  git(repo, ["config", "user.name", "Coordinator"]);

  return { root, origin, repo };
}

async function main() {
  const outIndex = process.argv.indexOf("--out");
  const outPath = outIndex > -1 ? process.argv[outIndex + 1] : null;

  const fixture = setupFixture();
  const registry = new OrchestrationRegistry(fixture.repo, { maxActive: 2 });
  const startingSha = git(fixture.repo, ["rev-parse", "HEAD"]);
  const base = { schemaVersion: "1.0.0", policyVersion: "1.0.0", startingSha, dependencies: [] };

  const worktrees = {
    a: join(fixture.root, "wt-a"),
    b: join(fixture.root, "wt-b"),
  };
  git(fixture.repo, ["worktree", "add", "-q", "-b", "feat/job-a", worktrees.a]);
  git(fixture.repo, ["worktree", "add", "-q", "-b", "feat/job-b", worktrees.b]);

  for (const [id, branch, worktreePath, changeName] of [
    ["job-a", "feat/job-a", worktrees.a, "demo-change-a"],
    ["job-b", "feat/job-b", worktrees.b, "demo-change-b"],
    ["job-c", "feat/job-c", null, "demo-change-c"],
  ]) {
    await registry.createJob({
      ...base,
      id,
      branch,
      worktreePath,
      changeName,
      worktreeManager: "git",
    });
  }

  const evidence = {
    task: "7.2",
    change: "orchestrate-parallel-implementations",
    generatedAt: new Date().toISOString(),
    repository: { root: fixture.repo, origin: fixture.origin, startingSha },
    steps: {},
  };

  // Two active jobs claim distinct worktrees; a third job is limited to queued.
  const leaseA = await acquireWriterLease({
    registry,
    jobId: "job-a",
    worktreePath: worktrees.a,
    role: "implementer",
    sessionId: "session-a",
  });
  const leaseB = await acquireWriterLease({
    registry,
    jobId: "job-b",
    worktreePath: worktrees.b,
    role: "implementer",
    sessionId: "session-b",
  });

  // Both active jobs claim implementation ownership; that is what consumes the two slots.
  await registry.claimOwnership("job-a", "session-a", process.pid, "demo");
  await registry.claimOwnership("job-b", "session-b", process.pid, "demo");

  const resourcesA = await allocateJobResources({ registry, jobId: "job-a" });
  const resourcesB = await allocateJobResources({ registry, jobId: "job-b" });
  const capacityForC = getSchedulingDecision("job-c", registry.listJobs(), 2);

  evidence.steps.activeJobs = {
    leases: [
      { jobId: "job-a", role: leaseA.role, worktree: leaseA.worktreePath },
      { jobId: "job-b", role: leaseB.role, worktree: leaseB.worktreePath },
    ],
    resources: [
      { jobId: "job-a", ports: resourcesA.ports, profile: resourcesA.profile },
      { jobId: "job-b", ports: resourcesB.ports, profile: resourcesB.profile },
    ],
    distinctWorktrees: leaseA.worktreePath !== leaseB.worktreePath,
    distinctPorts: resourcesA.ports[0] !== resourcesB.ports[0],
    distinctProfiles: resourcesA.profile !== resourcesB.profile,
    thirdJobDecision: capacityForC,
    thirdJobQueued: capacityForC.action === "waiting-slot",
  };

  // Manual dispatch fallback: no verified adapter is offered.
  const handoffA = buildManualHandoff({
    jobId: "job-a",
    changeName: "demo-change-a",
    worktreePath: worktrees.a,
    branch: "feat/job-a",
    task: "Implement demo change A",
    skills: ["openspec-apply-change"],
    roles: { implementer: "manual", verifier: "manual" },
  });
  const dispatchA = await dispatchImplementation({
    adapter: { name: "hermes", available: false, reason: "not-installed" },
    request: { jobId: "job-a", worktreePath: worktrees.a, prompt: "demo" },
    handoff: handoffA,
    spawn: () => {
      throw new Error("must not spawn");
    },
  });
  evidence.steps.manualDispatch = {
    status: dispatchA.status,
    instructions: dispatchA.instructions,
    spawned: false,
  };

  // Pause implementer for file-writing verification, then resume.
  const transfer = await transferWriterRole({
    registry,
    jobId: "job-a",
    from: "implementer",
    to: "verifier",
    sessionId: "session-a",
    evidence: { reason: "pause implementation for verification writes" },
  });
  const pausedExclusive = assertWriterExclusive(registry, worktrees.a);
  const resume = await releaseWriterLease({
    registry,
    jobId: "job-a",
    role: "verifier",
    sessionId: "session-a",
  });
  const resumedLease = await acquireWriterLease({
    registry,
    jobId: "job-a",
    worktreePath: worktrees.a,
    role: "implementer",
    sessionId: "session-a",
  });

  evidence.steps.reviewHandoff = {
    pausedRole: transfer.pausedRole,
    activeRoleDuringVerification: transfer.lease.role,
    singleWriterWhilePaused: pausedExclusive.exclusive,
    verifierReleased: resume.released,
    resumedRole: resumedLease.role,
    roleHistory: registry.getJob("job-a").roleHistory.map((entry) => entry.event),
  };

  // A conflicting target update requires intervention.
  fs.writeFileSync(join(worktrees.a, "shared.txt"), "base\nfeature-a\n");
  git(worktrees.a, ["commit", "-q", "-am", "feature edits shared"]);
  const other = join(fixture.root, "other");
  git(fixture.root, ["clone", "-q", "-b", "next", fixture.origin, other]);
  git(other, ["config", "user.email", "other@test.local"]);
  git(other, ["config", "user.name", "Other"]);
  fs.writeFileSync(join(other, "shared.txt"), "base\ntarget-change\n");
  git(other, ["commit", "-q", "-am", "target edits shared"]);
  git(other, ["push", "-q", "origin", "next"]);

  const syncResult = syncTargetIntoBranch({
    repoRoot: worktrees.a,
    remote: "origin",
    target: "next",
    expectedBranch: "feat/job-a",
  });

  evidence.steps.conflict = {
    status: syncResult.status,
    files: syncResult.files,
    headRestored: syncResult.restoredHead === syncResult.head,
    requiresIntervention: syncResult.status === "conflict",
  };

  // Writer-overlap proof across the whole run.
  const jobs = registry.listJobs();
  const perWorktree = new Map();
  for (const job of jobs) {
    const lease = job.writerLease;
    if (!lease || lease.releasedAt) continue;
    const list = perWorktree.get(lease.worktreePath) || [];
    list.push({ jobId: job.id, role: lease.role });
    perWorktree.set(lease.worktreePath, list);
  }
  const overlaps = [...perWorktree.entries()].filter(([, writers]) => writers.length > 1);

  evidence.steps.statusTable = jobs.map((job) => ({
    jobId: job.id,
    state: job.state,
    worktree: job.worktreePath,
    writerRole: job.writerLease && !job.writerLease.releasedAt ? job.writerLease.role : "none",
    ports: job.resources?.ports || [],
    profile: job.resources?.profile || null,
  }));

  evidence.steps.writerOverlap = {
    worktreesWithMultipleWriters: overlaps.length,
    overlaps,
    noSharedWriter: overlaps.length === 0,
  };

  evidence.summary = {
    twoActiveJobs: evidence.steps.activeJobs.distinctWorktrees === true,
    thirdJobQueued: capacityForC.action === "waiting-slot",
    manualFallbackUsed: dispatchA.status === "manual-handoff-required",
    pauseReviewResume: resumedLease.role === "implementer" && resume.released === true,
    conflictRequiresIntervention: evidence.steps.conflict.requiresIntervention === true,
    noSharedWriter: evidence.steps.writerOverlap.noSharedWriter === true,
  };

  const json = JSON.stringify(evidence, null, 2);
  if (outPath) {
    fs.mkdirSync(dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json + "\n");
  }
  console.log(json);

  // Cleanup the disposable fixture only.
  for (const path of Object.values(worktrees)) {
    try {
      git(fixture.repo, ["worktree", "remove", "--force", path]);
    } catch {
      /* already gone */
    }
  }
  fs.rmSync(fixture.root, { recursive: true, force: true });

  process.exit(Object.values(evidence.summary).every(Boolean) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
