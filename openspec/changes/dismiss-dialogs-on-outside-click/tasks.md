# Tasks

Verifier note: the owner delegates application test/build execution to Hermes. Every
verification below requires exact command output and exit codes. All tasks start
unchecked; nothing is implemented yet.

## 1. Implementation

- [ ] 1.1 In `Modal.svelte`, remove the `size === "drawer"` gate and dismiss on backdrop
      click for any dismissible dialog, using pointerdown + click backdrop tracking so a
      press that begins inside does not dismiss; verify `npm run check` shows no new
      failures beyond the known pre-existing `contracts:check` stale-declaration issue
- [ ] 1.2 Add a Playwright interaction check (in the `test:extension` interaction suite)
      covering: backdrop click dismisses a small dialog, a non-dismissible dialog stays
      open, and a drag that starts inside does not dismiss; verify `npm run test:extension`
      exits 0 with the new checks passing

## 2. Verification (Hermes executes; evidence required)

- [ ] 2.1 Run `npm run check` and record exact exit codes for lint, format, tests and the
      known `contracts:check` failure
- [ ] 2.2 Run `npm run build` and record exact exit codes for Chrome/Firefox/Edge and
      bundle budgets
- [ ] 2.3 Run `npm run test:extension` and record exact exit codes
- [ ] 2.4 Manual device matrix (owner or delegated real-device pass): mouse and touch
      backdrop dismissal on desktop and Firefox Android across small/standard/wide/drawer —
      leave unchecked until evidence exists

## Workflow follow-up

- Archive the change only after task 2.4 evidence and the project's review requirements
  are complete.
- Release authorization and version bumps remain separate from this change.
- Record new suggestion ideas in `.ai-sync/PROGRESS.md` so they are never repeated.
