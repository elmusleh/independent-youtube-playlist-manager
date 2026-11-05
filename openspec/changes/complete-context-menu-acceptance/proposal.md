# Proposal

## Why

The context-menu feature has substantial implementation and reported automated successes,
but its native-browser acceptance and security evidence remain incomplete. A shared
OpenSpec change lets Codex, Hermes and future agents finish the agreed scope without
mistaking a previous agent's summary for verified completion.

## What Changes

- Formalize the existing capture acceptance requirements from `docs/CONTEXT_MENU_PLAN.md`.
- Recheck and repair protocol/type mismatches against the current tree; concurrent fixes
  may already exist and must be preserved rather than repeated.
- Resolve audit findings with compatible fixes and retain actual command results.
- Complete headed, real native-browser and issue-regression acceptance evidence.
- Keep `.ai-sync` as the current-state/evidence handoff; link it to these change tasks.

No new product features, storage migration, permission expansion, major framework
upgrade, version bump, release or merge are included. This proposal imports existing
approved work, not a new release decision.

## Capabilities

### New Capabilities

- `context-menu-capture`: first formal OpenSpec representation of the already planned
  native capture, safe persistence, consent and browser acceptance behavior.

### Modified Capabilities

None; this project had no existing OpenSpec specifications at initialization.

## Impact

Potential follow-up edits affect background/shared protocol declarations, dependency
lockfiles and focused tests. Hermes owns execution of application checks/builds/audits;
native browsers and issue regressions require their own evidence. Implementation remains
in the existing working tree and is not certified or overwritten by adopting OpenSpec.
