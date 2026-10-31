# Plan — context-menu completion

Owner authorized implementation on 2026-10-31. Follow `docs/CONTEXT_MENU_PLAN.md` and
its four delivery stages. Do not merge, publish, tag, deploy or change release versions.
Existing 1.2.1 patch preparation remains separate; the context menu is a feature and
needs the release decision/version under RELEASING.md after verification.

## Authorized delivery sequence

1. Shared capture foundation: pure scope/URL/destination rules; worker authority for
   all local playlist-array/builder writers; atomic revision checks and visible conflicts.
2. Bounded native menu and accessible chooser: settings/default/custom parity, cached
   labels, lifecycle reconciliation, Android fallback and independent close setting.
3. Import/playlist-save and remote parity: explicit source permissions, quantity/order,
   bounded channel scanning, review/consent, persisted progress, safe retry/cancellation.
4. Browser verification/docs: actual Firefox/Chromium gestures and activeTab on a
   non-YouTube fixture, large destinations, narrow chooser, issue regressions and all gates.

Implementation for stages 1–3 is written. Hermes reported automated check/build/unit/E2E
successes, but audit status is disputed and headed/native/manual gates remain open. Owner explicitly delegated execution to Hermes; use
`docs/testing/HERMES_CONTEXT_MENU_VERIFICATION.md` before claiming completion.

## Recommendations accepted in this cycle

- CM-R1: consistent destination glossary and help copy.
- CM-R2: audit all three lockfile trees, separate runtime/build advisories, triage and
  apply compatible remediation based on actual findings. Reporter written; execution
  and dependency fixes pending remediation. Do not force major upgrades.
- CM-R3: prove safety assertions with selective mutations in disposable copies.
  Hermes reports all four safety mutations caught.

## Additional verification scope

Review open issues #10/#11/#13/#14 against existing fixes and this pass's improvements.
Do not close issues based on source inspection alone. Mobile real-device verification
remains open under RESPONSIVE_UI_PLAN.md; desktop emulation is not a substitute.

## Deferred

Svelte/Vite/Next/React major migrations, npm workspaces, broad sync conflict-policy
redesign and OAuth refresh remain outside this cycle. CM-F1/F2/F3 remain later ideas.

## Post-Hermes priorities (2026-10-31)

Follow `docs/testing/POST_HERMES_PLAN.md`: repair declarations that disagree with JS,
resolve the high dependency advisory and correct audit status, then headed E2E and actual
native/issue acceptance. Owner continues to delegate test execution to Hermes. No release.

## OpenSpec tracking

The existing remaining sequence is tracked in
`openspec/changes/complete-context-menu-acceptance/tasks.md`; its proposal/spec/design
formalize the already approved scope. Use that checklist for active change tasks, and
keep .ai-sync summaries/evidence linked to it. Setup is not feature acceptance.

## Worktree coordination standard — 2026-10-31

Independent implementation changes use a suitable separate branch/worktree where
needed; resumed work reuses that change's assigned checkout. Follow AGENT_WORKFLOW.md
for prerequisites, one-writer ownership, exact-path review/verification and integration.
Use START_HERE.md and the blank templates for handoff. This documentation task does
not create worktrees, redistribute current edits, alter product scope or authorize a merge.

## Parallel orchestration implementation plan: 2026-10-31

The owner requested a documented semi-automatic feature workflow and an implementation
plan. New change: `openspec/changes/orchestrate-parallel-implementations/`. It plans a
private shared assignment registry, two-job scheduling, worktree/agent adapters,
revision-bound verification, safe target updates, push-then-PR publication, recovery
and a separately opted-in guarded merge mode. See `docs/AI_ORCHESTRATION.md`.

This turn prepares planning/documentation only. All runtime tasks remain pending; no
workers, worktrees, publication or merge are started. Default merge mode is manual.
The existing context-menu acceptance change and its pending checks remain separate.
Before live parallel work, prepare a reviewed committed prerequisite snapshot because
the current checkout contains uncommitted/untracked implementation and instructions.

## Active post-Hermes implementation — 2026-10-31

Resume complete-context-menu-acceptance in the existing assigned checkout. Latest
Hermes changes already include follow-redirects 1.16.2; preserve them. Implement
CM-R7 evidence receipts, CM-R8 canonical/generated checked contracts and fail-on-skip
headed acceptance, and CM-R9 actual bundle dependency inventory. Task/constraints:
`.ai-sync/sessions/2026-10-31-evidence-contracts-task.md`. Tests/build/audits stay with
Hermes; orchestration runtime, release preparation and remote publication stay separate.
