# Starting prompts for any AI agent

Copy the relevant prompt into Codex, Hermes or another agent. Replace placeholders.
These are reusable instructions, not evidence that any work has been performed.

## Implementation or resumed work

> Work on OpenSpec change `<change-name>` in repository `<absolute-repository-path>`.
> Read AGENTS.md, .ai-sync/AGENT_WORKFLOW.md, HANDOFF.md, PLAN.md and PROGRESS.md,
> then openspec/README.md, config.yaml and the named change's artifacts.
> Inspect available skills and read those directly relevant to this task. Use the
> smallest useful set, briefly state names/purpose, and record their source paths.
> Reassess if scope changes; reuse loaded guidance for follow-up prompts. Report missing
> required skills and use a suitable fallback. Skills do not override owner instructions,
> project rules, test delegation or release restrictions.
> Task: <approved scope>.
> Worktree mode: <reuse the assigned worktree / separate independent implementation>.
> Assigned worktree and branch, if any: <absolute-path and branch>.
> Inspect Git status and existing worktrees. Reuse a suitable worktree for this change;
> otherwise create an isolated one when requested and report its absolute path, branch,
> base ref and starting SHA before implementation. Follow the app's managed-worktree
> lifecycle when available. Do not force an already checked-out branch into another tree.
> Confirm prerequisite code, plans and instructions exist in the starting snapshot.
> Uncommitted/untracked files do not transfer automatically. Preserve all existing edits;
> do not stash/reset/copy everything or commit another agent's work to manufacture a base.
> Work only in the selected worktree with one active writer. Set up dependencies and
> OpenSpec skill discovery for that path; keep secrets, ports, test data and profiles safe.
> Verification owner: <agent/person; state whether you may run checks>.
> Leave delegated verification pending. Use blank .ai-sync/templates in session copies.
> Record exact commands, exit codes, tree/artifact identities and evidence. Distinguish
> PASS, FAIL, SKIPPED, BLOCKED and NOT RUN; label another agent's claims as reported.
> Before stopping, update the worktree's handoff/progress with changed files, remaining
> tasks, verification owner, absolute path/branch and exact next steps. Do not infer
> release readiness or merge/archive/delete/publish/deploy without applicable authority.

## Review after another agent finishes

> Review OpenSpec change `<change-name>` in worktree `<absolute-worktree-path>`,
> expected branch `<branch>`. Confirm that path and branch first. Read project rules,
> the change's requirements/design/tasks, current .ai-sync state and the implementer's
> verification record. Inspect the actual diff and evidence, including any uncommitted
> files; compare with the recorded starting SHA. Do not review a different checkout.
> Inspect the skill catalog and load only relevant review skills. Name them briefly
> and record source paths or limitations. Reuse loaded guidance unless scope changes.
> Keep application code read-only. If another writer is active, coordinate a stable
> snapshot before drawing conclusions or running commands that write files.
> Report actionable findings by severity with file/line, trigger, impact and evidence.
> Check requirement coverage, security, concurrency/recovery, runtime/type consistency,
> skipped tests and unsupported completion claims. Preserve all existing edits.
> Test execution stays with `<verification-owner>`; provide missing-check instructions
> instead of rerunning tests yourself. Record review/handoff updates without overwriting
> another agent's state. Recommend next actions; do not merge, release, archive or remove
> the worktree without applicable authority.

## Coordinate approved parallel implementations

> Coordinate these approved implementation requests: <named changes and scope>.
> Read AGENTS.md, .ai-sync/AGENT_WORKFLOW.md, docs/AI_ORCHESTRATION.md and current
> OpenSpec/.ai-sync state. Assign one stable job, branch and worktree per independent
> change; reuse existing jobs and allow at most two independent implementations initially.
> Record owners, prerequisite SHA, dependencies, exact paths and publication authority.
> Use an authorized supported agent launcher if available; otherwise provide manual
> launch handoffs and leave dispatch pending. Do not claim unavailable tooling exists.
> Preserve current edits; do not create worktrees missing their required committed plans.
> Keep verification with Hermes unless reassigned. Update the owned feature branch
> against origin/next, refresh affected evidence, push that branch, then create/update
> one PR into next when authorized. Report the status, evidence, blocker and next actor.
> Merge mode is manual. Do not merge, change GitHub protections, release or delete work
> based on a conflict-free status. Guarded merge requires separate recorded owner opt-in
> and every gate in docs/AI_ORCHESTRATION.md. The coordinator runtime is still planned;
> do not run fictional commands or start implementation from a proposal-only request.
