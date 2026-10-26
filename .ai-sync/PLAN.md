# Plan

Short by design. This is the sequence, not the history — see `.ai-sync/HANDOFF.md` for state
and `.ai-sync/PROGRESS.md` for open tasks.

## Current cycle: 1.2.1, awaiting the owner

`v1.2.0` shipped on 2026-10-26. Since then `next` has accumulated one user-visible fix — the
popup's page import working on any regular page — alongside infrastructure changes. A bug
fix is a **patch** release: 1.2.1. It needs no further work before shipping, only a decision
to ship it.

## What triggers the next release

A user-facing fix or feature landing on `next`. Then, and only then:

1. Move `[Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` in `CHANGELOG.md`, open a fresh empty
   `[Unreleased]` above it, run `npm run release-notes`.
2. `node packages/build-tools/sync-version.mjs --set X.Y.Z` (never `npm version`).
3. Release prep PR into `next`; then the release PR `next` → `main`, squash-merged.
4. Tag `main`, push the tag, let `release.yml` publish.
5. Merge `main` back into `next`.

Full runbook: `docs/RELEASING.md`.

## Sequencing rules

1. **One logical change per branch.** If the name needs an "and", split it.
2. **A PR is one squashed commit** on its target branch, and the branch is deleted on merge.
3. **`main` only ever receives release PRs.** Nothing else, ever.
4. **Guards over discipline.** When a class of failure repeats, add a check to `npm run
check` rather than a reminder in a document. Existing guards: file size, CSS bundling,
   Vercel config, tooling versions, release-notes freshness.
5. **Verify, then claim.** `npm run check` and `npm run build` output in the PR body, not a
   sentence saying tests pass.

## Deferred on purpose

- Svelte 6, Vite 7+, Next 16, React 20 — migrations, ignored in `dependabot.yml`.
- npm workspaces — would simplify the Playwright coupling but changes the build for no user
  benefit.
- Sync conflict policy and OAuth refresh — need a decision before code.

## Not planned

Nothing else. If you are about to add a phase here, first check whether `PROGRESS.md`
already lists it as open work.
