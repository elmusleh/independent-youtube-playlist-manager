# Design

## Context

See proposal.md for motivation. The repository has OpenSpec, `.ai-sync` templates,
worktree guidance and GitHub CI. It has no coordinator runtime. Feature PRs target
`next`; `main` receives releases only. Existing instructions permit agent-owned PRs
but current owner scope forbids merging/publishing this in-progress feature. The new
policy makes merge authority explicit per assignment and defaults automation to manual.

The current checkout contains substantial uncommitted/untracked code and planning
files. No new worktree may assume they are present in `origin/next`. Existing pending
acceptance is a separate OpenSpec change and must not be silently certified by this work.

## Goals / Non-Goals

**Goals:** coordinate independent feature requests, preserve exclusive ownership,
automate supported handoffs and publication, and expose exact pending gates to the owner.

**Non-Goals:** install every agent, invent unavailable Hermes commands, implement a
multi-host service, copy credentials, enable GitHub settings, bypass protections, launch
unspecified requests, redesign application data, or auto-release. Planning remains
read-only for product code. Default workflow stops at a reviewed PR awaiting merge authority.

## Decisions

### 1. Local coordinator, versioned policy, private shared registry

Implement small Node tools under `packages/build-tools/orchestration/` using the existing
runtime and standard library; keep modules under 350 lines. Prefer this to introducing
an external service/database before two-job coordination is proven.

A versioned policy declares `target=next`, `remote=origin`, `maxActive=2`,
`mergeMode=manual` and the allowed provider adapters. Runtime job records live under a
private `agent-orchestration` directory resolved through Git's absolute common directory.
Each worktree otherwise has separate `.ai-sync` files, so a registry inside one feature
checkout would not safely coordinate the others. The registry coordinates one clone
on one host, not unrelated clones or external GitHub writers.

Use schema versioning, validated job IDs/paths/ref names, exclusive lock acquisition,
atomic file replacement and an append-only transition journal. Record previous state,
owner/liveness reference, policy version, worktree manager ID/path, branch, starting SHA,
dependencies, head/base SHA, review/verification records, authorization, PR and operation
receipts. Do not store credentials, environment dumps or arbitrary shell commands.
Coordinator tools alone mutate the registry; feature workers request transitions.

Acquire locks only for short state changes; do not hold a registry lock throughout a
build or network wait. Never steal a live or uncertain lease on a timeout alone. Expose
reconciliation/reassignment as deliberate operations. Corrupt/incompatible records block
mutation with recovery guidance and preserve original bytes.

### 2. Explicit state machine and role handoffs

Represent queued, dispatch-pending, implementing, verification-pending/verifying,
review-pending/reviewing, sync-required/syncing, publication-pending, PR-open/CI-pending,
merge-ready/merged, blocked and cancelled states. Each transition checks role, revision,
expected ownership and prerequisite evidence. Verify/review ownership transfers pause
feature writers before commands or report edits mutate their checkout.

Allow two implementation slots by default, not two writers in one worktree. Dependency
edges and declared overlapping areas can serialize jobs despite available slots. Detect
cycles and duplicate branch/job claims. Allocate ports and named disposable profiles;
serialize shared dependency/browser-cache installations if they collide.

### 3. Capability-based worktree and agent adapters

Use app-managed create/archive APIs when available, retaining manager identifiers;
otherwise use Git worktree adapters. Read existing worktree inventory and reuse the
job's assignment. New branches follow this repository's `<type>/<slug>` convention.
Reject protected branches, occupied branches, ambiguous paths and missing prerequisites.
Do not automatically snapshot the current dirty checkout. Preparing its initial reviewed
commit(s) is an explicit task with scoped staging and existing owner/repository authority.

Adapters declare support for dispatch/status/cancel rather than pretending every agent
shares a launcher. Discover actual Codex/Hermes launch capabilities during implementation;
use argument arrays and approved executables, never evaluate a request as shell code.
Where launch is unavailable, emit the exact worktree, OpenSpec skill, task, roles and
resume instructions, then wait for manual dispatch. Prompt generation is not execution.
No user-owned Codex chats are created without an explicit request to create them.

### 4. Target synchronization and safe publication

Preflight verifies the assigned repository/path/branch and a clean worker-owned commit.
Fetch the explicit remote, then merge the current `origin/next` into the feature branch
without switching/checking out `next`. This preserves reviewed history; an automatic
rebase plus force push is excluded. If this repository's effective policy disallows the
merge strategy, block and request an approved alternative rather than rewriting history.

Conflicts become a recorded blocked state with the affected files. An assigned agent
can resolve within scope, then Hermes reruns affected checks and the reviewer inspects
new changes. Capture a fresh target/head pair; a clean textual merge is not a test pass.
Stage only owned explicit paths, including needed change notes; never stage all local work.

Publish to the verified feature remote ref, then discover/create one PR by repository,
head and base. Draft is the default until required evidence and review are complete.
Use structured bodies or a body file. Record push/PR receipts and reconcile remote SHAs
and existing PRs after timeouts. Unknown publication never triggers blind duplicate PRs.
Handle declined credentials, remote collisions, rate limits and unavailable APIs with
bounded retries and pending status. Never change branch protection to get a PR through.

### 5. Evidence and optional guarded merge

Keep verification records in per-job session paths and link tested tree/artifact hashes,
exit codes, mandatory executed tests, manual cases, review identity and accepted head.
The coordinator consolidates shared handoff summaries; workers do not edit another
checkout's state. Avoid a single versioned registry edited by every feature PR.

Manual is the initial merge mode. Implement optional guarded mode behind explicit
owner opt-in recorded for a job/policy version. Verify effective server-side required
checks, accepted non-author review, resolved threads and up-to-date requirements;
missing access to inspect these is a blocker, not evidence they are enabled. Include
required manual acceptance. Do not count skipped mandatory tests as successful just
because a hosting status is green.

A serialized integration worker rechecks current head/base/review/check state and uses
a merge request pinned to the expected head. Require server-side up-to-date rules (or
an approved merge queue adapter) to close the race with external base updates; a local
lock alone cannot protect GitHub. If a required merge queue is unsupported, block.
Guarded mode can squash only into `next`; never use an admin override or merge a release.
After one merge, mark dependent/open jobs sync-required and invalidate affected evidence.

GitHub's native auto-merge is a possible backend only where the same effective policy
is enforceable; it is not enabled by this plan. No bare "mergeable" flag grants authority.
References: GitHub auto-merge and protected-branch docs, Git worktree docs, linked in
`docs/AI_ORCHESTRATION.md`.

### 6. Recovery, reporting and cleanup

Record intent before external operations and reconcile their receipts afterward.
Restart reads the journal/registry, verifies actual worktree and remote state, and
resumes from a safe boundary. Cancellation prevents future steps, reports any operation
already in flight, and does not claim to undo an already completed push/merge.

Expose a compact status table with owner/worktree/branch/PR, current state, blocker and
next actor. Save evidence outside disposable build output. Retain worktrees until review
and integration permit cleanup; use managed archive tools for managed trees and normal
Git removal otherwise. Dirty work, uncertain ancestry or squash-related safe-delete
refusal leaves a cleanup task; no force removal and no protected-branch deletion.

## Risks / Trade-offs

- Dirty starting checkout → explicitly prepare/review a scoped prerequisite snapshot before parallel work.
- Independent features interact semantically → declare shared-area dependencies and test the combined code.
- Multiple clones/outside actors bypass local locks → server protection and fresh remote checks remain required.
- Markdown mistaken for executable automation → label runtime tools/adapters as unimplemented until evidence exists.
- Agent hangs or loses tools → bounded dispatch/status waits, persisted ownership, deliberate recovery and manual handoff.
- CI green with skipped mandatory cases → examine required execution evidence, not status color alone.
- Excess autonomy during cleanup or merging → immutable per-job authority, manual default and fail-closed checks.

## Migration Plan

1. Adopt the documented policy and blank assignment fields without moving current work.
2. Prepare a reviewed committed baseline containing instructions/OpenSpec/tools before worker worktrees start.
3. Build/test registry, transitions and read-only dry-run first; do not perform remote mutations in tests.
4. Add local workspace/dispatch adapters and prove two independent disposable jobs.
5. Add verified publication with fake/local-remote tests, then an explicitly authorized real PR pilot.
6. Keep manual merging in the pilot. Add and verify guarded-mode refusal tests before any owner opt-in.
7. Revert focused tooling/policy commits if needed; preserve assignments/evidence and all worker code.

No deployment or public release is part of this rollout.
