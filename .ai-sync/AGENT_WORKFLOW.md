# Shared workflow for any AI agent

Use this standard with Hermes, Codex or another agent. It complements AGENTS.md;
the owner's current instructions take priority. These files organize work, not enforce
permissions or guarantee that an agent follows instructions.

## Start

1. Read AGENTS.md, HANDOFF.md, PLAN.md and PROGRESS.md. Inspect Git status and the
   relevant source. Preserve existing edits and keep scope within the approved plan.
   Confirm the selected worktree and starting snapshot using the rules below.
2. Copy templates/TASK.md into sessions/<date>-<task>-task.md. Record scope, acceptance
   criteria, constraints, agent/model if known, and who implements, reviews and verifies.
3. If verification is delegated, name the verifier and leave it pending. Do not run
   tests against the owner's instruction or assume a delegation completed successfully.

## Select relevant skills

Follow AGENTS.md's skill rule before starting work, and reassess when the task changes.
Check the catalog first; read only the relevant SKILL.md files and necessary references.
Reuse loaded guidance across follow-up prompts instead of rereading every skill each time.

Use the smallest useful set and avoid overlapping instructions without a reason. Briefly
name selected skills and their purpose. Record source paths, missing required skills,
fallbacks and any material instruction conflicts in the session copy of a template.
If no skill fits, use project guidance and record that choice without blocking the task.

Skills support implementation, review or verification; they do not extend authorization.
Preserve owner scope, worktree ownership, test delegation and release restrictions.
Do not mark verification complete merely because a skill was invoked.

## Worktrees and parallel agents

- Use one branch/worktree per independent implementation change, not per message or
  agent. Reuse its suitable worktree when resuming the same change. Small sequential
  edits and planning can stay in the current checkout when isolation is unnecessary.
- Inspect existing worktrees, branch names and Git status before choosing a workspace.
  Record the repository root, absolute worktree path, branch, base ref and starting SHA,
  OpenSpec change, implementation owner and verification owner in the task record.
- Before implementation, confirm the chosen starting commit includes all prerequisite
  code, approved OpenSpec files and agent instructions. Independent work normally starts
  from the integration branch (`next` here); dependent work needs an explicit prerequisite
  snapshot. A new worktree does not inherit uncommitted or untracked files from another
  checkout. Preserve that checkout; do not silently stash, reset, copy its entire contents
  or commit another agent's edits. Establish a reviewed, authorized starting snapshot.
- Use the app's worktree management tools when available, and their archive/restore
  lifecycle for managed worktrees. Otherwise use Git worktree commands. Give each
  implementation a distinct branch following repository conventions; do not force the
  same branch into multiple worktrees. Never manually delete a managed worktree folder.
- Keep one writer per worktree. Codex and Hermes can take turns in the same worktree.
  Pause the implementer before verifier commands that install dependencies, generate
  files or write reports. Parallel implementation belongs in separate worktrees.
- Start each agent in the exact absolute worktree path and confirm its branch before
  writing. Codex review must inspect that worktree's current diff and evidence, not the
  original checkout. A read-only reviewer must not silently become a second writer.
- Treat dependencies, ignored local configuration and generated builds as worktree-local.
  Install using repository-approved lockfile/toolchain commands when authorized. Do not
  automatically copy `.env`, credentials, browser profiles or secret-bearing user configs.
  Use separate development-server ports and disposable test data/browser profiles.
- Ensure generated OpenSpec skills exist in this checkout. Hermes must discover this
  worktree's `.hermes/skills` path through its configured lookup, or be explicitly
  directed to read the checked-in workflow instructions. Never copy its whole user
  configuration into the repository; do not assume another checkout's absolute path works.
- Separate worktrees prevent accidental file overwrites, not integration conflicts or
  shared-service collisions. Review overlapping files and dependency ordering before
  combining changes. Integration needs verification against the combined code.
- Keep the worktree until its work and evidence are reviewed and no longer needed.
  Archive/remove it only under applicable owner/repository authority with no unpreserved
  work. Do not force removal, force branch deletion, or treat cleanup as merge approval.

## Coordinate feature jobs and publication

Follow `docs/AI_ORCHESTRATION.md`. Assign each approved implementation a stable job,
OpenSpec change, worktree/branch/base, implementer, reviewer, verifier, dependencies
and allowed remote actions. Reuse the job on resume and limit independent active
implementations to two initially. Planning alone does not authorize worker dispatch.

Runtime tooling is planned, not active. Use real authorized launch/status tools when
available, or provide an exact manual handoff and leave dispatch pending. A prompt is
not evidence that an agent ran. Keep one coordinator responsible for assignment state.

After implementation and verification, fetch/integrate origin/next into the clean,
committed owned feature branch, resolve conflicts and refresh affected evidence. Push
that branch before creating/updating its PR. Record PR/head/base and remote receipts;
reconcile uncertain pushes/PR creation instead of blindly repeating them.

Default merge mode is manual. Do not merge from a conflict-free flag alone. Any future
guarded mode needs recorded owner opt-in, current required verification/review/manual
acceptance, resolved threads and effective server protections. Serialize integration,
refresh other jobs after next advances, and preserve dirty work/evidence during cleanup.

## Implement and review

- Make the smallest coherent change; follow existing patterns and project checks.
- Distinguish observed facts, another agent's reports, assumptions and recommendations.
- Review failure paths, privacy/permissions, concurrency, retries, compatibility and UX
  where relevant. Verify declarations match runtime behavior, not just the compiler.
- Use templates/REVIEW.md for actionable findings with file/line, impact and evidence.
  Do not weaken tests, disable guards or introduce casts simply to hide failures.

## Verify or delegate

- Copy templates/VERIFICATION.md for the actual tested tree. Record exact commands,
  working directory, exit codes, tool/browser versions and persistent evidence paths.
- Allowed statuses: PASS, FAIL, SKIPPED, BLOCKED, NOT RUN. A skipped test is not a pass;
  a failed command that writes a report still failed. Missing exit-code evidence is
  NOT RUN/unconfirmed, not proof of success. A report from another agent is REPORTED
  until its supporting evidence is inspected; this describes provenance, not a pass.
- Explain warnings and pending manual coverage. Keep unit, browser automation, real
  native gestures and real-device results separate. A zero production-only audit does
  not clear the full audit or every dependency emitted into application bundles.
- Record the absolute worktree path, branch, commit and working-tree patch identity; if code changes afterward, mark
  affected evidence stale and ask the designated verifier to rerun relevant checks.
- Keep logs outside disposable dist when needed for handoff. Never include tokens,
  credentials, raw page contents or private source URLs; redact before saving/sharing.

## Finish and switch agents

1. Fill templates/HANDOFF.md into a session file with changed files, unresolved findings,
   verification provenance, exact worktree path and branch, and the next action. Do not copy a template over live state.
2. Update the canonical HANDOFF.md and PROGRESS.md; adjust PLAN.md only for authorized
   changes. Keep history separate from current state. Leave unverified work open.
3. Tell the owner what changed, what is evidenced, what remains and who should act next.
   Do not merge, release, deploy, close issues or post messages without applicable authority.

Keep templates blank. Replace placeholders only in session copies; mark genuinely
irrelevant fields N/A with a reason. Never prefill a successful result. For a tiny edit,
use short entries and one session file rather than unnecessary duplicate paperwork.

## OpenSpec integration

Read `openspec/README.md` and `openspec/config.yaml`. OpenSpec owns the active change's
requirements/design/tasks; this workflow owns truthful evidence and session handoffs.
Link tasks instead of copying their checklist into multiple competing files. Preserve
existing detailed plans and owner delegation. A completed proposal/status is not a
passed application check, accepted feature or authorization to archive/release.
