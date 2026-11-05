# Latest Hermes work — source/evidence review

Reviewer: Codex. Repository/worktree: /home/steve/dev/independent-youtube-playlist-manager.
Observed branch: codex/context-menu-plan, HEAD c2c3b4e. Working tree remains dirty with
many untracked context-menu, contract and evidence files. Review only; no application
source edited and no tests/builds/audits rerun. Verification remains with Hermes.
No selected-environment skill was available; project/OpenSpec instructions used directly.

## Decision

Substantial orchestration implementation exists, with default merge mode manual.
Not fully accepted, not ready for automatic merging, and not release-ready. This
review distinguishes the older context-menu report from newer orchestration evidence.

## Evidence checked

- Newest integrated orchestration evidence: task-7.1-checks.json, generated
  2026-10-31T18:27:15.788Z, bound to cab3ef0 (HEAD has since advanced to c2c3b4e).
  477 tests/45 files passed; contracts-check exited 1. summary.allPassed is false.
  It explicitly says build gates were not run. Its knownUnrelatedFailures annotation
  does not make the combined repository check pass.
- Two-job disposable demo reports two active jobs, third queued, distinct resources,
  manual fallback, review/resume and conflict intervention. This is useful simulated
  evidence, not a live publication pilot.
- Orchestration tasks 7.3/7.4 (authorized live pilot and its review) remain unchecked.
  Task 7.1 is checked despite the recorded failure and omitted build verification;
  reconcile that status before acceptance.
- Existing final context-menu report still says 248 tests/all gates pass and references
  old contract behavior; it predates newer changes and cannot certify this tree.
- Saved dependency audit shows no high/critical findings; editor follow-redirects is
  fixed at 1.16.2. Remaining findings are moderate/low. No fresh audit performed here.
- PR #51 is still open into next. Primary handoff HEAD 6ef6034 is stale.

## Actionable findings

### P1 — merge/integration guards accept incomplete safety inputs

merge.js:56 accepts any present review object unless decision is exactly blocked.
An empty/unknown/manual-ready review can therefore pass this guard when the other
inputs pass. Protection flags at lines 72/75 reject only explicit bad values: missing
allowsAdminBypass/requiresUpToDate data is accepted instead of being unknown/refused.
Require exact guarded readiness and explicit, validated protection data.

integration.js:130 skips PR head validation when the remote response has no PR head;
lines 148 onward reject only blocked review, allowing absent/unknown review if a caller
passes an allowed authority object. Require an observed exact head and current explicit
ready decision before contacting the merge service. These are source-level failure-path
findings, not executed exploit claims. Keep guarded mode off while fixing/testing them.

Acceptance tests: missing/empty/unknown/manual review, missing protection flags,
missing remote head, changed review/CI state immediately before integration — each
must refuse with zero service merge calls. Do not resolve by trusting caller booleans.

### P1 — evidence identity does not cover the dirty tree it executes

orchestration/evidence.js:44 records HEAD and HEAD^{tree}; evidence-integrated.js does
the same before/after. They do not hash modified or untracked source. In the current
checkout, a context-menu/contract edit changes executed code without changing either
recorded identity. Receipts may look unchanged while actually testing different code.
Require a clean committed prerequisite snapshot or bind dirty/untracked content hashes,
then invalidate evidence when that identity changes. Preserve all current work.

### P2 — acceptance claims and pending implementation need reconciliation

Latest saved check failed; no newer successful record was found. Fix TS2367 in
capture-import.js and stale capture-controller.d.ts without suppressing contract checks,
regenerate declarations, then rerun relevant gates with exact exit codes.

Mandatory headed extension tests still contain worker-failure/headless skip paths;
CM-R7 runner pieces exist but are not fully wired, and CM-R9 actual bundle inventory
is absent. These include unfinished work from Codex's interrupted implementation;
they must not be attributed to an older Hermes success report or marked complete.

Three newly oversized orchestration modules (registry/recovery/workspace) were added
to the size allowlist despite the project's rule against growing it for new code.
Plan a focused split and remove those new exemptions after Hermes verifies equivalence.

## Recommended next sequence

1. Stop concurrent edits; make one exact-path handoff to Hermes. Preserve dirty work;
   do not stash/reset or commit everything to manufacture a clean base.
2. Finish contract/error fixes and fail-closed orchestration guards with negative tests.
3. Finish truthful dirty-tree evidence, mandatory headed execution and bundle inventory;
   repair stale handoff/OpenSpec statuses and size-rule exceptions.
4. Hermes sequentially runs check/build/check, orchestration tests/demo, extension E2E,
   headed E2E, safety mutations and audit as relevant, with current identity/exit codes.
5. Review evidence, then native Chrome/Firefox and issue acceptance. Only after that,
   choose a small real pilot with explicit draft-PR publication scope. Keep merging
   manual. No release, auto-merge, account mutations or issue closure inferred.

Next actor: owner can give Hermes this review and ask for fixes/evidence. Codex reviews
that exact resulting snapshot afterward. No further feature expansion is recommended.
