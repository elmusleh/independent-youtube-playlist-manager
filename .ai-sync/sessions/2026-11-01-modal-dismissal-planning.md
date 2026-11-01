# Session record — 2026-11-01 — modal dismissal on outside click (planning)

Owner: asked to fix dialogs that only dismiss via X/Cancel, and to formalize a plan
before code. Planning only.

## Skills used

- `repo-planning-pass` — source path `~/.hermes/skills/software-development/repo-planning-pass/SKILL.md`
  (used for the planning-boundary, OpenSpec flow, state-update and lock-release pitfalls).
- `openspec-propose` — project skill at `openspec/changes/../.hermes/skills/openspec-propose/SKILL.md`
  (CLI workflow: context, new change, status, validate).

## Context snapshot

- Branch `feat/ui-polish`, ahead 1, dirty tree with the owner's concurrent edits (Data
  Manager explainability, metadata services, etc.) — preserved exactly as found.
- Editing lock acquired (agent hermes) and released with `--force` (see pitfall).

## Root cause recorded

`Modal.svelte` `onclick` handler only closes on backdrop click when `size === "drawer"`;
all other sizes require X/Cancel. `Modal.svelte` is the single `<dialog>` component, so
the fix covers every modal. `dismissible` guard must be preserved (LoadingModal,
progress modals).

## Files created/changed

- Created `openspec/changes/dismiss-dialogs-on-outside-click/` (proposal.md, specs/
  modal-dismissal/spec.md, design.md, tasks.md).
- Updated `.ai-sync/PLAN.md`, `.ai-sync/PROGRESS.md`, `.ai-sync/HANDOFF.md`.

## Verification evidence

- `openspec validate --all --strict --no-interactive` → "4 passed, 0 failed", exit 0.
- `openspec status --change dismiss-dialogs-on-outside-click` → 4/4 artifacts complete.

No application tests/builds ran (no application code changed).
