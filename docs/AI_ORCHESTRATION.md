# Coordinating parallel AI implementations

Use this policy to assign independent feature requests to separate agent sessions and
worktrees. It defines the agreed workflow; the supporting coordinator runtime is planned,
not yet implemented. Markdown does not launch agents or enforce GitHub merge protection.

Implementation plan: `openspec/changes/orchestrate-parallel-implementations/`.
Existing worktree/skill rules: `.ai-sync/AGENT_WORKFLOW.md`.

## Default operating policy

| Decision               | Default                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| Unit of work           | One approved OpenSpec change per independent implementation job               |
| Workspace              | Dedicated branch/worktree, reused on resume                                   |
| Active implementations | At most two independent jobs initially                                        |
| Writers                | One at a time per worktree, with explicit role transfer                       |
| Implementer            | Named capable agent; no assumption it can launch another agent                |
| Reviewer               | Named reviewer, distinct from implementer where available                     |
| Verifier               | Hermes unless the owner explicitly reassigns execution                        |
| Integration target     | `origin/next`; never direct feature work on next/main                         |
| Publication            | Push owned branch, then create/update one PR under the assignment's authority |
| Initial PR             | Draft until its required verification/review is complete                      |
| Merge                  | Manual by default; no automatic merge from conflict-free status               |
| Release/deployment     | Separate owner authorization; never implied by a feature job                  |

The owner accepted this workflow for future implementation assignments. This planning
session does not authorize pushing or merging the current unfinished checkout. Scope,
publication authority and any guarded-merge opt-in must be recorded in each assignment.
OpenSpec proposal-only requests remain planning, not implementation/dispatch authority.

## Coordinator and worker responsibilities

The coordinator assigns a stable job ID, OpenSpec change, base/starting SHA, branch,
absolute worktree path, implementer, reviewer, verifier, dependencies and allowed remote
actions. It avoids duplicate assignments and starts only ready independent jobs.
Feature workers edit only their assigned checkout and publish only their owned branch.

All agents inspect their available skill catalog and load the smallest relevant set.
Resume reuses existing assignment state; a new chat alone is not a new feature/worktree.
If the available tools cannot start Hermes or another agent, produce a manual launch
handoff with exact path, branch, task, skills and verifier. Leave dispatch pending until
execution is observed. Never claim generated prompts are completed delegation.

Before runtime tooling exists, the coordinator can maintain a session assignment table
in its own checkout and send or present handoffs through authorized channels. Workers
record per-job evidence under their own `.ai-sync/sessions` paths. The future shared
registry belongs in Git's private common directory and is mutated through the coordinator;
separate worktrees do not share a live versioned Markdown file automatically.

## Feature lifecycle

1. Define and review the change's requirements, scope and acceptance criteria. Record
   the user's implementation/publication authority and keep merge mode manual.
2. Inspect worktrees and local edits. Choose a clean committed starting snapshot that
   contains the plan and prerequisite code. Preserve other edits; do not auto-stash,
   mass-copy, stage everything or assume the current dirty work exists in `origin/next`.
3. Create/reuse the assigned feature worktree with its own branch. Use app-managed tools
   when available. Confirm the exact path, branch and starting SHA with the worker.
4. Set up checkout-specific dependencies, skill discovery, ports, disposable data and
   profiles. Do not automatically copy secrets or whole user configurations.
5. Implement and maintain the change's tasks. Transfer write ownership before Hermes
   executes checks or the reviewer edits session reports. Record actual outcomes.
6. When owned changes are committed and the checkout is clean, fetch the explicit
   remote and integrate current `origin/next` into the feature branch. Do not run a
   vague "pull latest", switch a shared checkout to next, or force-rewrite reviewed history.
7. Resolve conflicts through the assigned worker and rerun affected verification/review.
   A target/head change invalidates affected prior evidence even without textual conflicts.
8. Push the owned feature branch first. Then create/update one PR targeting next with
   the exact commands/results, skipped checks and limitations. Keep it draft when needed.
9. Wait for required CI and review. Review findings return to the assigned implementer;
   new commits require relevant revalidation and review. Record blockers rather than
   polling forever or bypassing requirements.
10. Integrate only under explicit authority and the gates below. After a merge, refresh
    other affected jobs against the new next and verify their combined behavior.
11. Preserve evidence and use the proper worktree manager to clean up only when authorized
    and safe. Do not force removal/deletion, including when squash history prevents safe deletion.

Different worktrees isolate working files, not shared browser caches, credentials,
services, remote branches or semantic dependencies. Parallelize independent areas;
sequence shared foundations or record explicit dependent starting snapshots.

## Merge policy: conflict-free is one condition

Manual mode stops with a PR/status report for the owner. In the future optional guarded
mode, merging can proceed only if every required condition is established:

- The owner explicitly opted this job/policy into guarded merging; its target is next.
- The correct feature head and target snapshot are current and the PR is not a draft.
- Required local/manual acceptance and server-side checks have valid current evidence.
- Required non-author review is accepted and conversations are resolved.
- Effective server protections enforce the required checks/review and current base, or
  an approved merge queue enforces the equivalent. Missing/unknown protection is a blocker.
- One coordinator integration operation owns the merge slot, remote state is rechecked,
  and the merge request protects the expected head. External actors can still change
  GitHub, so a local lock does not replace server protection.

No admin bypass, force push of reviewed history, direct next/main push or release merge
is allowed through this workflow. Do not enable repository auto-merge/settings merely
to complete a job. If required capabilities/permissions are unavailable, retain manual
mode and report the specific missing action.

GitHub's own auto-merge waits for required checks and reviews; it must be configured
for the repository where applicable. See [GitHub auto-merge](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request)
and [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
For local isolation, see [Git worktrees](https://git-scm.com/docs/git-worktree).

## Workspace lifecycle adapters

`packages/build-tools/orchestration/lifecycle.js` selects who owns a job's workspace:

- **Managed first.** An app-managed create/archive API is used when the provider exposes
  `create`, `archive` and `list`, and returns a workspace identifier. A provider that
  cannot return an identifier is treated as unavailable — creation is never assumed.
- **Git fallback, only where permitted.** `selectWorktreeManager({ allowGitFallback })`
  falls back to Git worktree adapters; passing `allowGitFallback: false` makes the
  missing managed capability a hard error instead of silently degrading.
- **Recorded ownership.** `assignWorkspace` stores `worktreeManager` and
  `managerWorktreeId` on the job, so later archive/cancel uses the same backend and
  never guesses. An existing worktree is reused rather than recreated.
- **Dirty work is never forced away.** `releaseWorkspace` refuses a dirty or
  status-unknown workspace (`DIRTY_WORKTREE` / `DIRTY_STATUS_UNKNOWN`) and reports a
  `preserve-and-report` cleanup action. Removal happens only when the workspace is
  verifiably clean or an owner explicitly forces it.
- **Preflight before allocation.** `workspace.js` inspects existing worktree inventory,
  rejects protected/occupied branches and untracked paths, reports missing committed
  prerequisites and warns about (but preserves) dirty source.

Tests: `vitest run packages/build-tools/orchestration/` covers fake-manager, Git and
disposable-repository behaviour. Task 3.1 evidence is reproducible with
`node packages/build-tools/orchestration/evidence-preflight.js`.

## Review and CI readiness

`packages/build-tools/orchestration/review.js` evaluates one PR against its expected
head/base and reports `blocked` or `ready-for-manual-merge`:

- Head/base binding: `HEAD_CHANGED` and `WRONG_BASE` block reuse of stale evidence.
- `STALE_REVIEW` catches approvals made on an earlier commit; `AUTHOR_ONLY_APPROVAL`
  and `NON_AUTHOR_REVIEW_REQUIRED` enforce independent review.
- `UNKNOWN_MERGEABILITY` and `MERGE_CONFLICT` block; `UNRESOLVED_THREADS` blocks.
- Required checks must be `completed/success`: failed, pending, skipped or missing all
  block (`CHECKS_FAILED`, `CHECKS_PENDING`, `CHECKS_SKIPPED`).
- A required merge queue that this workflow cannot use is
  `MERGE_QUEUE_UNSUPPORTED`.
- `evaluateGuardedMerge` returns readiness only. In manual mode (the default) it refuses
  with `GUARDED_MERGE_DISABLED`; no merge is ever performed by the coordinator.

## Publication and recovery states

`packages/build-tools/orchestration/publication.js` handles the write path:

- `commitScoped` stages only explicit owned paths, refuses `.`/`-A`/outside/missing paths
  and fails if unrelated files are already staged (`UNEXPECTED_STAGED_FILES`).
- `pushFeatureBranch` requires the expected branch to be checked out, refuses
  `next`/`main` and unconfigured remotes, never forces, and reports
  `REMOTE_COLLISION` or `DENIED_CREDENTIALS` instead of retrying blindly.
- `createOrUpdateDraftPr` runs after the push receipt, targets `next`, and updates the
  existing PR (found by repository+head+base) instead of creating a duplicate.
- Calls use argument arrays with no shell, so commit messages and prompts stay literal.

`packages/build-tools/orchestration/reconcile.js` covers uncertain remote effects:

- `withBoundedRetry` retries only rate limits, timeouts and transport errors; exhaustion
  returns `pending` with `retry-later-or-manual-review` (or `manual-intervention`).
- `reconcilePublication` requires the observed remote head to equal the local head, so a
  job cannot publish another job's commit. Create is attempted once; a lost response is
  reconciled by discovery (`reconciled`), never by a second create.
- Pending states are `discover`, `update` or `create`, and ambiguous PR matches are
  refused rather than guessed.

## Target synchronization and evidence receipts

`packages/build-tools/orchestration/sync.js` merges the live target into the owned
feature branch:

- `fetchTarget` fetches only the configured remote and target, then resolves the
  fetched SHA — a stale local `origin/next` is never reused.
- `syncTargetIntoBranch` requires the expected feature branch, a configured remote and a
  clean tree; it merges (`--no-ff`) rather than rebasing, so reviewed history is
  preserved and `next` is never checked out.
- Conflicts are reported with the affected files and the merge is aborted; the branch
  and its content stay exactly where they were.
- Dirty or unexpected state is refused (`DIRTY_WORKTREE`, `WRONG_BRANCH`,
  `WRONG_REMOTE`, `TARGET_BRANCH`) instead of stashing, resetting or discarding work.

`packages/build-tools/orchestration/evidence.js` binds a verification or review result
to its tree:

- A receipt records head SHA, tree SHA, base/target SHA, command exit codes, mandatory
  case statuses and artifact SHA-256 hashes.
- Validation reports `STALE_HEAD`, `STALE_BASE`, `STALE_ARTIFACT`, `MISSING_EXIT_CODE`,
  `SKIPPED_CASE` or `MISSING_REQUIRED_CASE`; only a problem-free receipt is reusable.
- Receipts are stored under the registry directory and linked from the job.
- Session templates (`.ai-sync/templates/VERIFICATION.md`, `REVIEW.md`) require the
  receipt identity and an invalidation check.

## Role handoff and shared resources

`packages/build-tools/orchestration/roles.js` enforces one writer per worktree:

- `acquireWriterLease` grants a file-writing role (implementer/verifier/reviewer) the
  worktree. A different job on the same worktree is refused (`WRITER_CONFLICT`).
- `transferWriterRole` is the only way writing moves between roles. It records the
  handoff in `roleHistory` and pauses the previous role, so file-writing verification
  cannot overlap implementation.
- `assertRoleCanWrite` is checked before a role runs commands or edits; a mismatched
  role gets `ROLE_HANDOFF_REQUIRED` instead of silently writing.
- `releaseWriterLease` only succeeds for the recorded holder.

`packages/build-tools/orchestration/resources.js` allocates the shared resources two
parallel jobs otherwise collide on: one free port from a configured range, one named
disposable profile, and requested shared installs. Exhaustion is reported
(`RESOURCE_EXHAUSTED`) rather than reusing a busy port. `withSharedInstallLock`
serializes dependency/browser-cache installs through a lock file in the registry
directory, so concurrent jobs never write the same install at once.

## Verified agent launch capabilities

Adapters are discovered, never assumed. Re-probe the machine with:

```bash
node packages/build-tools/orchestration/dispatch.js discover \
  --out openspec/changes/orchestrate-parallel-implementations/evidence/task-3.3-capabilities.json
```

Discovery requires a successful `--version` and `--help` output containing every flag
the adapter will pass. Verified forms at the time of writing (Hermes v0.22.5,
Claude Code 2.1.310):

| Adapter  | Verified invocation                                   | Notes                                         |
| -------- | ----------------------------------------------------- | --------------------------------------------- |
| `hermes` | `hermes -z "<prompt>" --in <worktree> [--skills a,b]` | One-shot, non-interactive                     |
| `claude` | `claude -p "<prompt>" --add-dir <worktree>`           | Print mode, non-interactive                   |
| `codex`  | not installed on this machine                         | Treated as unavailable                        |
| manual   | instructions only                                     | Worktree, branch, task, roles and resume text |

Launch uses an argument array with `shell: false`; a prompt is never evaluated as shell
code. A launch receipt only claims `dispatched` — `running`/`completed` require separate
journal evidence. When capability is missing or launch fails, the result is
`manual-handoff-required` or `launch-failed`, never a running or completed job.

### Pinning launch executables

Discovery also reports the SHA-256 of the resolved executable. Record machine-local pins
in a file that is **not** committed, then enforce them:

```json
{
  "hermes": { "path": "/home/steve/.local/bin/hermes", "sha256": "<from discover>" },
  "claude": { "path": "/home/steve/.local/bin/claude", "sha256": "<from discover>" }
}
```

```bash
node packages/build-tools/orchestration/dispatch.js discover \
  --pins orchestration.pins.json --require-pins
```

With `requirePins: true`, an executable that is unpinned, has no hash, resolves to a
different path or has different bytes is reported as `unpinned-executable` or
`executable-pin-*` with no dispatch capability, so a hijacked `PATH` entry cannot receive
a worktree-writing prompt.

## Guarded merge, integration and cancellation

`packages/build-tools/orchestration/merge.js` describes the optional guarded squash path:

- Disabled unless `mergeMode: guarded`, the job records `mergeOptIn: true` and the policy
  requires owner opt-in (`GUARDED_MERGE_DISABLED`, `MERGE_NOT_AUTHORIZED`).
- Only `next` is a valid target (`PROTECTED_TARGET`); main/release/production are refused.
- Refuses stale evidence, blocked review, failing CI and ineffective protections
  (`STALE_EVIDENCE`, `REVIEW_NOT_READY`, `INEFFECTIVE_PROTECTIONS`).
- `performGuardedSquashMerge` makes one call with `expectedHead` and reports
  `merged: false` when the service does not confirm.

`packages/build-tools/orchestration/integration.js` keeps one integration in flight:

- A single `.integration.lock` slot means a second attempt returns `busy`.
- Target SHA and PR head are re-read immediately before merging; movement yields
  `recheck-required` instead of forcing the merge.
- After a merge, every other job is marked `requiresRecheck` with a `target-advanced`
  invalidation record.

`packages/build-tools/orchestration/cancellation.js` preserves work:

- `requestCancellation` records intent, reports whether a remote step was in flight, and
  never interrupts or reverses a committed effect.
- `cleanupJob` requires owner authorization, retains dirty worktrees with a receipt and
  never deletes protected branches; squash-merged branches without proof of containment
  are retained (`SQUASH_SAFE_DELETE_REFUSED`).
- Retained-work recovery: the job keeps its worktree path, `cleanupReceipts` (files and
  reason) and evidence receipts, so the owner can commit, push or discard deliberately.

## Pilot status and owner decisions

- **No live pilot has run.** Task 7.3 (push a real feature branch and open one draft PR)
  requires explicit owner authorization for remote mutation; it remains pending.
- Consequently no GitHub-side checks, reviews, merge-queue behaviour or protection state
  has been observed. The readiness gates in `review.js` are therefore verified only
  against fake services and local remotes.
- **Guarded merge is off and requires an owner decision.** Enabling it means setting
  `mergeMode: guarded`, recording `mergeOptIn: true` per job and confirming that branch
  protection requires the checks/review and forbids admin bypass. Until then the
  coordinator reports `ready-for-manual-merge` and never merges.
- Native/managed worktree APIs were not available on this host, so the Git adapter and the
  manual dispatch handoff are the verified paths.

## What is implemented now

The workflow, blank assignment fields and OpenSpec implementation plan are documented.
Implemented coordinator modules live in `packages/build-tools/orchestration/` (policy,
registry, scheduler, state machine, recovery, workspace preflight, lifecycle and launch
adapters) and are covered by unit tests against disposable repositories, fake services
and stub executables. There is still no long-running dispatcher loop, automatic
publisher/merger, and no live PR has been piloted from this workflow. Enabling real
automatic merging remains a later explicit owner decision.
