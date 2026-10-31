# Spec Delta

## Purpose

Coordinate approved AI implementation requests in isolated worktrees while preserving
ownership, trustworthy verification and controlled publication into the integration branch.

## ADDED Requirements

### Requirement: Every implementation has an explicit assignment

The coordinator SHALL map each approved implementation request to one job identity,
OpenSpec change, dedicated branch/worktree, starting commit, implementer, reviewer,
verification owner, dependencies and publication/merge authority. Planning messages
and follow-ups to the same change SHALL NOT create duplicate implementations.

#### Scenario: Resume the same request

- **WHEN** another agent session resumes an existing change
- **THEN** it receives the existing assignment and its current state rather than a duplicate worktree or PR

#### Scenario: Request has only planning authorization

- **WHEN** a user requests a proposal without authorizing implementation
- **THEN** no worker is launched and no feature branch is pushed by that request

### Requirement: Starting snapshots preserve existing work

An assignment SHALL start only after its required code, plan and instructions are
present in an identified committed snapshot. The coordinator SHALL preserve dirty
or untracked work in other checkouts and SHALL NOT silently stash, reset, copy secrets,
commit unrelated edits or force an occupied branch into another worktree.

#### Scenario: Prerequisite plan exists only as an untracked file

- **WHEN** a new worktree would omit a required plan or implementation prerequisite
- **THEN** assignment reports the missing starting snapshot and waits for a reviewed authorized preparation step

### Requirement: Parallel work has bounded exclusive ownership

The coordinator SHALL allow at most two independent active implementation jobs by
default and only one writer per worktree. Conflicting dependencies SHALL be sequenced.
Verification or review that writes files SHALL require an explicit ownership handoff.

#### Scenario: Two workers claim the same job concurrently

- **WHEN** separate sessions attempt to claim one assignment
- **THEN** exactly one obtains write ownership and the other sees the recorded owner

#### Scenario: Third implementation exceeds the limit

- **WHEN** two implementations are active and another independent job is ready
- **THEN** the third remains queued without writing in an active job's checkout

### Requirement: Agent dispatch reports actual capability

Dispatch SHALL use a supported authorized launch mechanism and report its real result.
When an agent cannot launch the designated worker, the coordinator SHALL issue a manual
handoff with exact workspace, task, skills and role information and retain a pending state.
It SHALL NOT claim the worker ran merely because a prompt was generated.

#### Scenario: Hermes launch adapter is unavailable

- **WHEN** a job is assigned to Hermes but the caller has no working authorized launch interface
- **THEN** it returns the handoff and pending assignment without fabricating execution or verification

### Requirement: Workspaces isolate local runtime resources

Workers SHALL use the assigned checkout, repository conventions, relevant skills and
checkout-specific setup. Concurrent services SHALL use nonconflicting ports and disposable
profiles/data where needed. Secrets and full user configurations SHALL NOT be copied
into feature trees or execution logs automatically.

#### Scenario: New worktree lacks Hermes skill lookup

- **WHEN** the designated agent cannot discover that checkout's required workflow skills
- **THEN** setup reports the limitation and provides an authorized configuration or explicit-read handoff before implementation

### Requirement: Target updates occur inside the owned feature branch

Before publication or guarded integration, the worker SHALL fetch the named remote
and integrate the current target into its own clean, committed feature branch. It SHALL
record the target SHA and invalidate evidence affected by the update. It SHALL NOT
switch or push another worker's branch or force-rewrite reviewed history.

#### Scenario: Update introduces a merge conflict

- **WHEN** the current integration branch conflicts with the feature branch
- **THEN** the job records the conflict and stops publication/merge until an assigned agent resolves and reverifies it

#### Scenario: Target advances after verification

- **WHEN** another feature merges after this job's target snapshot was tested
- **THEN** the coordinator requires target synchronization and affected revalidation before considering this job integration-ready

### Requirement: Verification is tied to the exact revision

A job SHALL retain verifier identity, tested head/base identities, commands, exit codes,
required coverage and evidence paths. Delegated, skipped, missing or stale checks SHALL
remain pending rather than passed. A changed head SHALL invalidate earlier review and
verification where applicable.

#### Scenario: Report exists but mandatory tests skipped

- **WHEN** a verifier supplies a report with no executed mandatory tests or no successful exit evidence
- **THEN** the coordinator rejects verification readiness and leaves the required gate pending

### Requirement: Publication pushes before creating or updating a PR

For assignments with publication authority, the coordinator SHALL push only the owned
feature branch before creating or updating one PR against the configured integration
branch. Draft PRs SHALL identify unfinished verification. Lost responses SHALL be
reconciled against remote head/PR state before retrying publication.

#### Scenario: PR creation succeeds but the response is lost

- **WHEN** the coordinator resumes publication after a timeout
- **THEN** it finds the matching repository/head/base PR and records it instead of creating a duplicate

#### Scenario: Publication permission is absent

- **WHEN** a job lacks repository access or authorization to push/open a PR
- **THEN** it preserves local work and reports the exact missing capability without claiming remote publication

### Requirement: Conflict-free code does not authorize merging

Merge mode SHALL default to manual. Guarded automatic squash merging SHALL require
explicit recorded owner opt-in, the allowed integration target, accepted non-author
review, resolved conversations, current required checks, satisfied manual acceptance,
verified server-side protections and a current head/base. Unknown or failed gates SHALL
block merging. Protected-branch bypasses and release merges SHALL NOT be used.

#### Scenario: Mergeable PR has failing CI

- **WHEN** GitHub reports no conflicts but a required check fails
- **THEN** the PR remains unmerged even in guarded mode

#### Scenario: Merge authority or effective protections cannot be verified

- **WHEN** owner opt-in is missing or the service cannot establish effective merge protection
- **THEN** automatic merging remains disabled and the coordinator reports the pending decision or capability

### Requirement: Integration is serialized and rechecked

Only one coordinator-controlled integration operation SHALL run per repository at a
time. It SHALL recheck remote state and the expected PR head immediately before the
merge request. Other jobs SHALL resynchronize after an integration target change.
External actors SHALL NOT be assumed to obey a local coordination lock.

#### Scenario: Two PRs become ready together

- **WHEN** two guarded-mode PRs qualify for integration
- **THEN** one integrates first and the other rechecks its updated base and required evidence before merging

### Requirement: Resume and cancellation preserve observable state

A job SHALL persist state, ownership and remote operation receipts across coordinator
restarts. Recovery SHALL reconcile uncertain effects before repeating them. Cancellation
SHALL stop future dispatch/publication steps without discarding existing work, cancelling
an already committed remote effect or deleting a dirty worktree.

#### Scenario: Coordinator restarts after branch push

- **WHEN** push completion is uncertain following a crash
- **THEN** resume checks the remote branch SHA before retrying or creating the PR

#### Scenario: Stale ownership record exists

- **WHEN** a session appears inactive but its worktree may still have a writer
- **THEN** the coordinator requires liveness/reassignment evidence instead of stealing ownership based only on elapsed time

### Requirement: Cleanup preserves work and evidence

Worktree cleanup SHALL follow its manager's lifecycle and applicable owner authority.
Dirty or unpreserved work SHALL prevent removal. Evidence and assignment history SHALL
remain available after cleanup. No job SHALL delete protected branches or infer that
squash merging makes forced local branch deletion safe.

#### Scenario: Squash-merged branch cannot be deleted safely

- **WHEN** normal cleanup refuses deletion or finds unpreserved local changes
- **THEN** the coordinator retains the worktree/branch and reports a cleanup action without forcing deletion
