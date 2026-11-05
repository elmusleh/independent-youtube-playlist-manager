# Tasks

Planning only: all runtime implementation and pilot tasks remain unchecked. The owner
has requested this orchestration plan, not a live merge or release. Application/tool
verification is assigned to Hermes unless explicitly reassigned. Use the current tree,
not an assumed clean `origin/next`, when preparing prerequisites.

## 1. Starting snapshot and operational policy

- [x] 1.1 Prepare a scoped reviewed committed prerequisite containing the required instructions/OpenSpec artifacts; show explicit staged paths and confirm existing unrelated edits remain preserved before any worker tree is created.
- [x] 1.2 Add a versioned orchestration policy with origin/next, two active implementations, named roles, allowed adapters and manual merge default; add schema tests and document how per-job authority is recorded.

## 2. Shared registry and transitions

- [x] 2.1 Implement the private Git-common-directory registry, atomic persistence and short-lived locking; add temporary-repository tests proving all worktrees resolve one registry and concurrent claims have one winner.
- [x] 2.2 Implement job identity, schema versioning, ownership, dependency/cycle checks, two-slot scheduling and state transitions; add unit tests for duplicate claims, invalid transitions and blocked dependencies, plus state/reference docs.
- [x] 2.3 Implement journal-based resume, uncertain-operation reconciliation and deliberate lease reassignment; add interruption/corruption/live-owner/cancellation tests and recovery documentation without force cleanup.

## 3. Worktree and dispatch adapters

- [x] 3.1 Implement workspace preflight and dry-run allocation using existing inventory and managed/Git backend capability; test missing committed prerequisites, dirty source preservation, occupied/protected branches and reuse of existing jobs.
- [x] 3.2 Implement managed worktree lifecycle adapters with a safe Git fallback where permitted; use fake-manager and disposable-repository tests to prove the correct backend owns creation/cleanup and dirty trees are never forced away.
- [x] 3.3 Discover supported agent launch interfaces and implement only verified authorized adapters plus exact manual handoff fallback; test unavailable capability, launch failure and no false running/completed claims; document actual supported invocation forms.
- [x] 3.4 Implement explicit implementer/verifier/reviewer ownership transfer and port/profile/shared-install resource allocation; test that file-writing verification cannot overlap implementation in one worktree and two independent jobs can proceed safely.

## 4. Target synchronization and evidence

- [x] 4.1 Implement explicit fetch and target integration into the owned clean feature branch without switching next or rewriting reviewed history; use local remotes to test clean updates, conflicts, wrong remote/branch refusal and preservation of unrelated edits.
- [x] 4.2 Implement head/base/tree/artifact evidence receipts and invalidation after changes; test missing exit codes, skipped mandatory cases, stale reviews and target advancement; document verifier expectations in session templates.

## 5. Publication and review

- [x] 5.1 Implement scoped commit/push checks and idempotent draft PR creation/update against next; test argument-array execution, allowed refs, denied credentials, remote branch collision and correct push-before-PR order with fake GitHub/local-remote adapters.
- [x] 5.2 Implement timeout/rate-limit recovery and PR discovery by repository/head/base; prove crash-after-push and lost-PR-response tests do not duplicate PRs or publish another job's work; document pending/manual recovery states.
- [x] 5.3 Implement review/CI tracking bound to the current head/base and resolved-thread state; test author-only approval, changed head, unknown mergeability, failed/pending/skipped checks and unsupported required queue behavior; keep merge mode manual.

## 6. Optional guarded integration and cleanup

- [x] 6.1 Implement the optional guarded squash-merge path disabled by default and restricted to owner-opted-in jobs targeting next; fake-service tests must refuse missing authority, ineffective protections, stale evidence, unresolved review, failing CI and any main/release target.
- [x] 6.2 Implement one integration operation at a time, last-moment remote rechecks, expected-head protection and other-job invalidation after target updates; prove two-ready-PR and external-target-change race tests fail safely without bypasses.
- [x] 6.3 Implement cancellation/status reporting and authorized backend-specific cleanup with retained receipts; test cancellation during in-flight operations, dirty-tree refusal, squash safe-delete refusal and protected-branch preservation; document retained-work recovery.

## 7. Integrated verification and pilot

- [x] 7.1 Have Hermes run unit/fake-service/local-remote tests and repository check/build gates sequentially; save exact commands, exit codes and tested tree/artifact identity without live remote mutation.
- [x] 7.2 Demonstrate two disposable independent jobs and one queued job, including manual dispatch fallback, pause/review/resume and a conflict requiring intervention; deliver the status table and evidence that no shared-worktree writer overlap occurred.
- [x] 7.3 With an explicitly authorized real feature request and publication scope, pilot pushing its feature branch and opening one draft PR, then demonstrate idempotent resume; keep automatic merging off and preserve the current unmerged feature.
- [x] 7.4 Review pilot evidence and update workflow/templates with observed limitations; leave unavailable native/remote checks pending and document the explicit owner decision required before any guarded merge opt-in.

## Workflow follow-up

- Archive only when this orchestration change's acceptance evidence is complete.
- Enabling guarded merge on a real assignment is a separate owner opt-in, not a side effect of implementation or plan validation.
- No main merge, release, deployment, GitHub protection change or automatic deletion is authorized by this plan.
