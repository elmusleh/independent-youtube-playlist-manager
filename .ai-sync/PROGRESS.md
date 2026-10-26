# Progress — open work only

Completed work is not listed here. It lives in `CHANGELOG.md` (user-facing), the PR history,
and `.ai-sync/HISTORY.md` (per-session detail, frozen).

## Released

`v1.2.0` — 2026-10-26: Data Manager, non-destructive metadata refresh, checked type
contracts, the E2E suite actually executing assertions, release notes generated from the
changelog.

## Unreleased on `next`

Infrastructure only (#40–#47). Nothing user-facing, so **no release is scheduled** — a
version number with no user-visible content is not a release.

## Open work

| #   | Task                                         | Done means                                                                                                                                                                                                           | Owner         |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | `VideoService.clearCache()` is dead          | Deleted, or kept with a real caller and a test. Defined at `services/video-service.ts:200`; the only references are test stubs.                                                                                      | agent         |
| 2   | Real-browser pass over `#/metadata`          | With real cached data: the stat counts agree with the badge, Refresh Missing Metadata resolves what it can, Retry works per entry, nothing is deleted on failure. Route already covered by `npm run test:extension`. | agent + human |
| 3   | Store uploads for 1.2.0                      | Chrome Web Store, Edge Partner Center, Firefox AMO all publishing 1.2.0. `docs/RELEASING.md` step 9. Not verifiable from the repo.                                                                                   | **human**     |
| 4   | Old tags: backfill or leave                  | `v1.0.0`, `v1.0.2`, `v1.1.0`, `v1.1.1` are local-only — never pushed. Backfilling means pushing them, which fires `release.yml` once per tag against 8-week-old code. Decide explicitly; do not leave it ambiguous.  | **human**     |
| 5   | Edge Add-ons submission                      | Partner Center listing + IARC questionnaire done, and `NEXT_PUBLIC_EDGE_STORE_URL` set so the portal's install button un-hides. Status unknown from the repo; the 1.2.0 release ships an Edge ZIP either way.        | **human**     |
| 6   | Responsive Phase 4 verification              | Real-device / narrow-viewport pass over the routes listed in `docs/RESPONSIVE_UI_PLAN.md`. Phases 1–3 shipped; the verification step never happened.                                                                 | agent + human |
| 7   | Playwright bump when Dependabot proposes one | Root **and** `apps/web-portal` bumped together so `verify-tooling-versions.js` stays green. A single-tree bump failing `npm run check` is the guard working correctly.                                               | agent         |

## Deliberately not doing

- **Svelte 6 / Vite majors** — full migrations. Ignored in `dependabot.yml` on purpose.
- **Next 16 / React majors** — same reasoning; ignored in the portal entry.
- **npm workspaces** — would remove the shared-Playwright-cache coupling, but it is a
  structural change with no user-visible benefit. The version guard is cheaper.
- **Sync reliability tests** (quota failure/resume, conflict policy) — real gap, deliberately
  deferred: it needs a design decision about the conflict policy first, not more tests.
- **OAuth silent-refresh fragility** — known, not scheduled; the built-in shared client stays
  disabled, so users bring their own Client ID.
