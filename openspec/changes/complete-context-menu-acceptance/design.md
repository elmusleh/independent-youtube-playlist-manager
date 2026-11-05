# Design

## Context

See proposal.md for motivation. Existing capture, mutation and browser-check modules
already implement much of the feature. `.ai-sync` records reported verification and
remaining gaps. New protocol contracts appeared in the working tree during setup;
review their current contents instead of repeating earlier repairs blindly.

## Goals / Non-Goals

**Goals:** converge existing implementation with the formal acceptance contract and
retain inspectable evidence across agents.

**Non-Goals:** redesign storage, replace the metadata engine, expand permissions,
introduce unrelated product features or decide/publish a release.

## Decisions

- Keep requirements/design/tasks in this change and current state/evidence in `.ai-sync`.
  Link the existing detailed browser matrix rather than duplicating it in every handoff.
  Replacing `.ai-sync` would lose unresolved state; copying full plans would create drift.
- Preserve the shared mutation authority and distinguish direct return values from
  message envelopes. Reuse canonical model types and inspect any claimed generation
  path. Standalone handwritten declarations can satisfy type checking while disagreeing
  with actual JavaScript, so verify both contract and behavior.
- Prefer compatible dependency remediation based on actual dependency paths and
  shipped-code reachability. A production-only install audit cannot classify every
  bundled runtime dependency. Blanket overrides/forced majors are not the default.
- Hermes executes application verification sequentially against an identified tree.
  Record actual exit status and distinguish skipped, reported and executed evidence.
  Native gestures and real hardware remain separate from handler tests and emulation.

## Risks / Trade-offs

- Concurrent agent edits → reread Git status/source before each task and preserve existing fixes.
- Old reports attached to new code → capture tested tree identity and invalidate affected evidence after edits.
- False audit success → retain actual exit codes and unresolved severities, not just generated JSON.
- Manual browser availability → leave acceptance pending; do not replace native gestures with direct handler calls.
- Duplicate sources of truth → OpenSpec owns this change's acceptance tasks; `.ai-sync`
  summarizes status with links, and the original browser matrix supplies detailed procedures.

## Migration Plan

This adopts existing work as an open change; no runtime or data migration occurs now.
Implement follow-up fixes as focused patches after rereading current source. Revert only
those patches if necessary, retaining evidence and pre-existing local edits. Archive only
after acceptance; any future merge/release remains a separate owner-controlled action.
