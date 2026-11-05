# Verification record — <task>

- Date/time and timezone:
- Verifier (agent/model/person):
- Repository root (absolute path):
- Tested worktree/working directory (absolute path):
- Worktree manager/identifier, if applicable:
- OpenSpec change/path:
- Implementation owner and confirmation writer paused:
- Base ref/starting SHA:
- Dependency/local configuration setup provenance:
- Test service ports, disposable data and browser profile identity (no secrets):
- OpenSpec/Hermes skill discovery in this worktree:
- Branch/commit:
- Uncommitted tree/patch identity:
- Built artifact identity/hash:
- Toolchain/browser/OS versions:
- Scope and acceptance criteria source:
- Provenance: directly executed / reported by another agent / artifact inspection:

## Orchestration assignment

- Job ID and coordinator / registry or manual assignment record:
- Dispatch adapter/capability, real execution reference or pending manual handoff:
- Dependency jobs and overlapping areas:
- Remote, target branch and last synchronized base SHA:
- Allowed commit/push/PR actions and authorization source:
- PR URL/number and published head SHA:
- Merge mode (manual unless explicitly opted in) and authority source:
- Pending CI/review/manual acceptance gates and next actor:

## Skill selection

- Relevant skills selected and purpose (or none, with reason):
- SKILL.md source paths / versions, if known:
- Required skills unavailable and fallback:
- Material instruction conflicts and resolution:
- Scope changes requiring reassessment:

## Command results

Leave blank until executed. Use PASS / FAIL / SKIPPED / BLOCKED / NOT RUN.
Never infer PASS from a generated report or from an all-skipped suite.
Confirm the intended worktree before execution. Keep dependency installation and build
commands sequential when they share files. Evidence from another worktree, changed code
or a different combined artifact is not automatically valid for this checkout.

| Exact command and working directory | Actual exit code | Status | Executed/passed/failed/skipped counts | Evidence path | Warnings/limitations |
| ----------------------------------- | ---------------- | ------ | ------------------------------------- | ------------- | -------------------- |
|                                     |                  |        |                                       |               |                      |

## Evidence receipt (required to reuse this verification)

A verification record is only reusable when it is bound to the exact tree it observed.
Create and validate receipts with `packages/build-tools/orchestration/evidence.js`.

- Receipt ID and kind (`verification`):
- Head SHA and tree SHA:
- Base ref and SHA (the `origin/next` snapshot merged by the last sync):
- Commands with their **actual** exit codes (a missing exit code is not evidence):
- Mandatory cases and their PASS status (SKIPPED or absent mandatory case is not a pass):
- Artifact paths with SHA-256 hashes:

Invalidation: any new commit, merge/rebase, artifact edit or target advancement makes the
receipt stale (`STALE_HEAD`, `STALE_BASE`, `STALE_ARTIFACT`, `MISSING_EXIT_CODE`,
`SKIPPED_CASE`). Re-run the affected checks and record a new receipt instead of citing
the old one.

## Behavioral and manual checks

| Scenario | Environment and steps | Expected | Observed | Status | Evidence |
| -------- | --------------------- | -------- | -------- | ------ | -------- |
|          |                       |          |          |        |          |

## Security/dependency findings

| Scope/tree | Package/path or finding | Severity/exposure | Proposed fix or justified disposition | Status/evidence |
| ---------- | ----------------------- | ----------------- | ------------------------------------- | --------------- |
|            |                         |                   |                                       |                 |

## Fixes made while verifying

## Integration verification

- Combined branch/tree identity, if applicable:
- Evidence reused and why it remains applicable:
- Additional checks required after combining changes:

## Checks invalidated by subsequent changes

## Unverified coverage and blockers

## Overall acceptance decision

## Exact next action and owner
