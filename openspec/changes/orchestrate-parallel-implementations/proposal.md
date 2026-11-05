# Proposal

## Why

Parallel agents need isolated feature workspaces and a shared assignment record so they
can move implementations toward review without overwriting work or losing ownership.
The current project documents worktrees but has no orchestration registry, dispatcher
or enforced push/PR/merge state machine.

## What Changes

- Add a coordinator workflow for approved requests, each mapped to an OpenSpec change,
  dedicated branch/worktree, owner, reviewer, verifier and dependency list.
- Start with two independent implementation slots and one writer per worktree; support
  real agent launch adapters and honest manual handoff when launch capability is absent.
- Coordinate verification, fetch/integrate the latest `origin/next`, invalidate stale
  evidence, push the owned feature branch and create/update its PR in that order.
- Add restart-safe state, idempotent resume, bounded retries, visible blockers and
  serialized integration/merge decisions across worktrees.
- Default to no automatic merge. Plan a separate opt-in guarded squash-merge mode that
  also requires current checks, accepted review, resolved threads and effective branch
  protection. Conflict-free alone is never sufficient.

This request creates the plan and agent-facing policy only. It does not launch agents,
move the current uncommitted implementation, create feature worktrees, push/open PRs,
enable auto-merge, change GitHub settings or publish a release. Runtime tooling follows
in the apply phase. Existing `main`/release restrictions remain intact.

## Capabilities

### New Capabilities

- `parallel-agent-orchestration`: assign isolated feature jobs and coordinate agent
  handoffs, evidence, branch updates, PR publication and explicitly guarded integration.

### Modified Capabilities

None; no orchestration capability currently exists in `openspec/specs/`.

## Impact

Follow-up implementation affects local coordinator tools, versioned policy, session
records and Git/GitHub adapters. A local private registry is shared through the Git
common directory, not competing per-worktree copies. Existing Codex managed-worktree
APIs and repository GitHub/CI rules must be respected. Verification remains delegated
to Hermes. No application data model or product feature changes are included.
