# Pagination handoff

## Branch model changed: `next` integrates, `main` releases (2026-10-26)

- `next` is the integration branch. Every feature, fix, chore and doc change branches off
  `next` and PRs back into `next`, squash-merged.
- `main` only receives release PRs from `next`, squash-merged, then tagged `vX.Y.Z`.
  Followers see one commit per release.
- CI and security workflows now trigger on PRs and pushes to `next` as well as `main`;
  without that, required checks on `next` would never report and every PR would hang.
- **Post-release sync is mandatory.** Squash merges leave `next` and `main` with identical
  content but no shared commits, so the merge-base goes stale and the next release PR
  re-displays shipped work. After tagging: `git switch next && git merge origin/main &&
git push`. That empty merge commit is the only direct push allowed on `next`, which is
  why `next` runs without admin enforcement and `main` runs with it.

Full rules: `AGENTS.md` → _Git Workflow_. Release steps: `docs/RELEASING.md`.

## Vercel was red because of an invalid config key (2026-10-26)

Every deployment failed at config parse, before any build step:

```
The `vercel.json` schema validation failed with the following message:
should NOT have additional property `rootDirectory`
```

`rootDirectory` is a **project setting**, not a `vercel.json` property, and the schema is
`additionalProperties: false`. The root `vercel.json` has been deleted;
`packages/build-tools/verify-vercel-config.js` (in `npm run check`) now rejects it.

**Owner action required:** set Project `iypm` → Settings → Build & Development Settings →
Root Directory = `apps/web-portal`. Until that is set, deployments from the repo root will
fail with a different error (no build output) — the repo fix removes the invalid config,
the dashboard fix is what restores deploys. Details: `docs/DEPLOYMENT.md`.

## Latest work — 1.2.0 released (2026-10-26)

Tag `v1.2.0` on `main`, GitHub Release published by `.github/workflows/release.yml`
with the four store ZIPs attached.

What the release changed beyond the code:

- **`docs/RELEASING.md` is the release runbook** — version decision, `sync-version`,
  changelog, `npm run release-notes`, docs, PR, tag, workflow, verification, store
  uploads, checklist. `AGENTS.md` points at it.
- **In-app release notes are generated.** `packages/build-tools/gen-release-notes.mjs`
  turns `CHANGELOG.md` into `src/generated/release-notes.ts`, which
  `ReleaseNotesModal.svelte` renders. The modal used to carry a hand-copied history
  (30 sections, a 2020 `[1.2.0]` entry that contradicted the real one); that history is
  gone and only versions in the changelog appear. `npm run check` fails if the generated
  file is stale, so the two cannot drift again.
- **The release page body comes from the changelog** (`--release-body vX.Y.Z`) instead of
  GitHub's generated notes, so release notes and changelog always agree.
- Also fixed in the same PR: `README.md`'s Current Status block and its outdated
  "NEVER git push" rule, which contradicted the PR workflow.

Next time: follow `docs/RELEASING.md`. The only manual step that can bite is store
uploads — the workflow cannot do those.

## Latest work — protected main, branch/PR workflow, CI repaired (2026-10-26)

### Repository workflow changed

`main` is now a protected branch: pull request required, admin enforcement on, no
force-push, no deletion, conversation resolution required. AGENTS.md documents the
workflow (branch naming, required PR evidence, no self-merge, no admin override).
Agents push branches and open PRs; the owner merges.

Undo in an emergency:
`gh api -X DELETE repos/elmusleh/independent-youtube-playlist-manager/branches/main/protection`

### CI had been red for two real reasons, both fixed in #28

1. `apps/browser-extension/playlist-manager/package-lock.json` was missing
   `picomatch@4.0.7`. npm 11 accepted it, npm 10 (what CI runs) refused with
   `npm ci can only install packages when ... in sync`, so every workflow died at the
   install step in ~14s. Regenerated with `npm@10.8.2`.
2. `undici@8.12.3` requires Node >= 22.19 and threw
   `Cannot read properties of undefined (reading 'bind')` on the Node 20 runner,
   killing the vitest forks pool. CI now runs Node 22.

`vitest.setup.mjs` (Node's experimental `localStorage` shadowing jsdom's) also lives in
#28, so every branch is green locally and in CI.

### 1.2.0 landed — every slice merged

All six review slices plus three follow-ups are on `main`. Merging used
`--merge` (history preserved). Order was: #28 -> #34 -> #33 -> #31 -> #29 -> #30 -> #32.

| PR  | What it carried                                                                                 |
| --- | ----------------------------------------------------------------------------------------------- |
| #28 | 10 unpushed release commits, npm-10 lockfile, Node 22, vitest `localStorage` fix, Builder fixes |
| #34 | E2E suite had never run: extension resolved to `apps/dist/chrome`, now `<root>/dist/chrome`     |
| #33 | Dropped the duplicate CodeQL job (repo uses default setup)                                      |
| #31 | Modal system, theme picker, OAuth copy, proxy `DataCloneError` on save                          |
| #29 | Metadata correctness + Data Manager, bulk bar restored to `StickyHeader`                        |
| #30 | Size/budget/CSS gates, release workflow, `iypm.sh` (clean keeps the lockfile)                   |
| #32 | Version 1.2.0, CHANGELOG, USER_GUIDE Data Manager section                                       |
| #35 | Thumbnail archive cleared on every overwrite restore; build uses `npm ci`                       |

Review findings that were fixed rather than dismissed: Builder saving against a
nonexistent YouTube playlist, quick-added videos being dropped, the Manage bulk bar
never rendering (P1), closed dialogs painting as empty boxes, `iypm.sh reset` failing
because `clean` deleted the lockfile.

### Branch protection now enforces CI

Required status checks on `main` (admin-enforced):

- Quality & Security (Lint, Format, Audit, Unit Tests)
- Extension CI (Svelte Diagnostics & Manifest Validation)
- Web & Extension E2E Integration (Typecheck, Build, E2E)

`strict` is false, so a PR does not need to be rebased first. Conversation resolution
is required, which means an unresolved Codex/CodeRabbit thread blocks the merge —
resolve it with a reply.

### Still open

- **#27 (dev-deps bump)** cannot merge: it raises Playwright, so CI installs
  `chromium-1234` (portal) while `test:extension` wants `chromium-1248` (root).
  Align one Playwright version across root and `apps/web-portal` first.
- **#9** is conflicted and stale; a rebase was requested from Dependabot.
- **Vercel** still fails on every PR. The local CLI token is expired
  (`vercel whoami` -> "token is not valid"); needs `vercel login` and then
  `vercel inspect <deployment> --logs`. Project settings, not code.

### Watch out

- `dist/chrome/editor/main.js` is ~98 bytes under its 380 KiB budget. The next
  feature added to the editor will trip `verify-budgets`.
- Never run `npm install` in `apps/browser-extension/playlist-manager` with npm 11: it
  prunes the nested `picomatch@4.0.7` entry npm 10 needs and breaks CI. The build now
  uses `npm ci`, which is safe.

### Next steps

1. Merge #28, then #31, then rebase #29 (its checks re-run against the new base).
2. After the first green run on `main`, add the two CI job names as required status
   checks — deliberately left off until CI was proven green.
3. Then the Edge submission (rebuilt ZIP replaces the stale Partner Center package).

## Latest work — sorted local playlist save failure (2026-10-26)

User log shows 1,404 videos and `DataCloneError: Proxy object could not be cloned`
after sorting by channel; user also requested coverage for 14,000 videos. Nested
Svelte sortRules proxies survived shallow playlist spreads into Firefox storage.

- `services/storage-service.ts`: detach incoming local playlist JSON data before
  browser storage writes, preserving order and nested sort rules.
- `services/storage-service.test.ts`: regression at both sizes using structured
  cloning, plus storage failure preservation and successful retry. Original nested
  proxy tests failed before the fix.
- `components/SaveStatus.svelte`, `components/ViewHeader.svelte`: visible error
  explanation below the header and Retry action instead of tooltip-only Error;
  standalone SaveStatus retains an inline error option.
- `components/PlaylistEditor.svelte`: consume save rejections after StatusManager
  records them, retain dirty edits, avoid refresh after a failed save, and suppress
  misleading Sorted/Reversed success messages after save failure.
- `services/status-manager.svelte.ts`: silent saves also mark the save in progress,
  so the editor's existing saving guard applies to autosaves.
- `packages/build-tools/verify-large-playlist-save.py`: disposable Firefox test of
  actual UI channel sort, saving 14,000 videos, reload persistence, injected save
  failure, visible desktop/mobile feedback, retained stored data, and Retry.

Verification: `npm run check` passed (184 tests, zero Svelte errors; two pre-existing
unused CSS warnings); `npm run build` passed Chrome/Firefox/Edge and bundle gates.
Firefox 158.0.1 passed the 14,000-video UI flow, reload, failure/retry and zero
unhandled-rejection assertions; Chromium passed 96 route/viewport checks and six
interaction groups. Browser evidence: `dist/verification/large-playlist-save-report.json` and retry
screenshots. This task did not alter manifests, publish, or push. All pre-existing
working changes (including user CHANGELOG) were preserved; this fix remains in the
working tree alongside them, so do not commit all files indiscriminately.

Next: review/integrate the intended release changes, produce a newly versioned
tester package, and have the user verify their own playlist. Store candidates
already under review do not contain this fix. Do not reload their unsaved editor
as part of installing a test update without first preserving their edits.

## Latest work — Data Manager hardening + checked type contracts (2026-10-26)

Follow-up to a self-review of the Data Manager work. Every item below is covered by
tests or by the type checker.

### Correctness fixes

- **Refresh no longer destroys cached data.** A forced refresh used to call
  `videoService.clearCache()`, i.e. `dbDeleteMetadata()`, _before_ fetching — so an
  entry that only lacked a duration could lose its title and channel when the refetch
  failed. `services/refresh-registry.ts` now records a per-pass in-memory intent;
  `shouldSkipFetch`/`fetchVideo` bypass the cache for those ids, results overwrite the
  old rows on success, failures leave the previous entry untouched.
- **One definition of "incomplete".** `collectMetadataGaps()` counts resolved entries
  (`hasCompleteMetadata`: field-complete OR terminal) and exposes `needsAttention`, so
  `complete + needsAttention === total`. The nav badge, the stat cards and the gaps
  list now all read the same number; the badge used to include private/deleted videos
  that the list deliberately hides.
- **Zero-length durations are missing, not zero.** `durationStringToSeconds()` decodes
  ISO-8601 / clock notation / seconds and returns 0 for `PT0S`, `0:00`, `00:00:00`.
  Before, `"PT0S"` was a truthy string and satisfied the duration requirement — the
  exact bug the module's own header describes.
- **Accurate refresh reporting.** The view consumed `metaMap.size` and
  `unavailableIds` instead of claiming `ids.length` were refreshed.
- `refreshMetadataGaps()` returned `ids.length` when nothing resolved; now returns 0.
- `reasonLabel` was a divergent re-implementation of `getMetadataGaps()`; the gaps list
  now renders `reasons` from the util.

### Checked type contracts

- `types/services.d.ts` → `types/services.ts` and `types/window.d.ts` → `types/window.ts`,
  both wrapped in `declare global` + `export {}`. `skipLibCheck: true` (from
  `@tsconfig/svelte`) skips **all** `.d.ts` files, so the entire `window` API contract
  was never type-checked. Proof: conflicting `interface Window` members error with
  `--skipLibCheck` off and are silent with it on.
- That blind spot had been hiding real defects: `saveUserProfile`, `getUserProfile` and
  `ytGetMyChannel` were declared twice with different shapes; `services.d.ts` referenced
  `Playlist` / `Settings` / `PlaylistExport` without importing them; `getPlaylist` was
  declared `Promise<Playlist>` while returning `Promise<Playlist | null>`.
- Making `getPlaylist` truthful surfaced two real null-handling gaps:
  `PlaylistEditor.svelte` (copy/move target) and `Manage.svelte` (bulk delete). Both now
  guard.

### UI structure

- `views/MetadataManager.svelte` (295 lines) is now orchestration only. The three
  sections are `components/metadata/{MetadataStatGrid,MetadataEngineList,MetadataGapList}.svelte`
  with **scoped** styles. `css/metadata-manager.css` is deleted — as a plain imported
  stylesheet its `.card`, `.loading-state` and `.progress-text` were global and collided
  with `css/settings.css`, `Card.svelte`, `PlaylistLoader.svelte` and `ProgressBar.svelte`.
- The gaps list renders at most 100 rows with a "Show N more" control instead of
  thousands of thumbnails.
- Progress text is a `role="status" aria-live="polite"` region; the badge carries an
  `aria-label` with the exact count.
- Engine labels/order come from `services/metadata-engines.ts` (`METADATA_ENGINES`)
  instead of being copied into the view.
- The Sidebar badge is computed on idle (`requestIdleCallback`, 3s timeout) rather than
  competing with first paint, and is guarded against concurrent loads.

### Tests added (+30, total 181)

- `utils/metadata-completeness.test.ts` — 23 tests: duration decoding (incl. `PT0S`
  regressions), placeholders, terminal entries, `needsDurationRefresh`, and the
  `complete + needsAttention === total` invariant across record/iterable/empty inputs.
- `services/enrichment-service.test.ts` — 7 tests: force never deletes cached rows,
  forced ids are scoped to the pass and cleared on throw, unavailable ids are reported.

### Verification

- `npm run check` → PASS: 19 test files / 181 tests, Prettier clean, file-size gate
  clean (163 files, 22 allowlisted), svelte-check 0 errors (only the 2 pre-existing
  unused-CSS warnings in `PlaylistModals.svelte`), CSS bundle gate passes.
- `npm run build` → PASS for chrome, firefox, edge; all bundle budgets pass.
- `tsc --noEmit -p tsconfig.json` is now meaningful for `src/types/**`.

### Next steps

1. `VideoService.clearCache()` has no remaining callers (`enrichment-service` was the
   only one). Decide whether to keep it as a deliberate "delete cached metadata" API or
   remove it.
2. Run `npm run test:extension` for a real browser pass over `#/metadata`.
3. Everything in the older sections below about store submissions still applies.

## Latest work — Data Manager view + Node 26 localStorage fix (2026-10-26)

### Data Manager (`#/metadata`)

- New `views/MetadataManager.svelte` (323 lines, at the 350-line budget): stat grid
  (cached / complete / missing duration / live / terminal), engine-status list,
  bulk "Refresh Missing Metadata", "Remove Incomplete Entries", "Clear All Cache",
  and a per-entry retry list with thumbnails and a reason label.
- View CSS lives in `css/metadata-manager.css` (imported by the view), NOT in an
  in-component `<style>` block — the file was 511 lines and failed the size gate.
- `Sidebar.svelte` has a bottom "Data Manager" nav item with a badge fed by
  `window.getMetadataGapSummary()`; it refreshes on the `yph-metadata-changed` event.
- `MetadataSettings.svelte` links to the view and can clear the cache.
- Route added in `App.svelte` (`"/metadata": MetadataManager`).
- `types/services.d.ts` was trimmed back under the limit (323 lines) by replacing
  four duplicated 11-field inline return types with a shared `YtVideoMetaResult`
  interface. No type semantics changed.

### Test environment fix (root cause, not a workaround)

- Node >= 22.4 exposes an experimental `localStorage` global that is `undefined`
  unless the process is started with `--localstorage-file`.
- Vitest's jsdom environment copies jsdom's window keys onto `globalThis` via
  `populateGlobal()`, but _skips keys Node already defines_ — so the broken Node
  getter won and bare `localStorage` was undefined. Vitest then sets
  `globalThis.window = globalThis`, so `window.localStorage` was undefined too.
- Fix: `vitest.setup.mjs` re-points `globalThis.localStorage` at
  `globalThis.jsdom.window.localStorage`; registered via `setupFiles` in
  `vitest.config.mjs`. `theme.store.test.ts` passes untouched — do not "fix" it by
  editing the assertion or switching to `window.localStorage`.

### Verification

- `npm run check` → PASS: 17 test files / 151 tests, Prettier clean, file-size gate
  clean (158 files, 22 allowlisted legacy files), svelte-check 0 errors and only the
  2 pre-existing unused-CSS-selector warnings in `PlaylistModals.svelte`, CSS bundle
  gate passes.
- Directly run: `npx vitest run` → 17/17 files, 151/151 tests.

### Next steps

1. Give the Data Manager a manual smoke test in a loaded unpacked extension:
   badge count, refresh-missing progress, retry-one failure path, clear-all confirm.
2. Do not add `MetadataManager.svelte` to the file-size allowlist; split it instead
   if it grows past 350 lines.
3. Everything in the older sections below about store submissions still applies.

## Latest work — CI gates, onboarding, Svelte repair, OAuth UX (2026-10-26)

### CI / quality gates

- `.github/workflows/ci.yml`: Node 20 → 22 in all jobs.
- High-severity root `npm audit` is now blocking.
- `npm run test:extension` added to the PR `test-web` job after Playwright install.
- New `packages/build-tools/verify-budgets.js` wired into `npm run build`. Ceilings:
  `main.js` 380 KiB, `bundle.css` 175 KiB, `popup.css` 22 KiB, `background.js` 16 KiB.
- New `packages/build-tools/verify-file-size.js` with an exact-path allowlist for
  22 legacy files >350 lines; wired into `npm run check` / `check:file-size`.

### Onboarding

- `Saved.svelte` now distinguishes a true first run from filtered-empty results.
  First-run CTA “Create your first playlist” → `#/new`; copy explains local-first
  usage and that no Google account is needed.
- `PlaylistGrid.svelte` passes empty-state action props; `EmptyState.svelte` gained
  `focus-visible` styling.

### Cleanup and tests

- Deleted unused `services/sync-service.ts` and `views/Saved-refactored.svelte`.
- Removed dead `_syncServiceLoaded` / `SyncService` window declarations.
- Added `services/playlist-actions.test.ts` with 16 tests; fixed stale sync-state
  cleanup when a remote playlist no longer exists.

### Svelte repair

- `Modal.svelte` now supports a `footer` snippet; all 15 legacy `slot="footer"`
  callers converted.
- Restored missing `Modal` / `ProgressBar` imports in `Manage.svelte`; fixed
  `Settings.svelte` to `bind:showPlayAllInfo`.
- Restored metadata types (`isShorts`, `liveBroadcastDetails`,
  `RawVideoMeta.isShort`) so youtube-api typechecking passes.

### OAuth UX

- Built-in shared OAuth is NOT enabled. BYO Google OAuth Client ID remains required;
  the API key is now optional and only used for signed-out metadata fallback.
- Added `utils/youtube-credentials.ts` + 5 tests; updated auth guard/messages,
  `Header` / `ProfileDropdown` / `AuthPlaceholder` / `OfflineNotice` /
  `FavoriteSettings` copy, and `DeveloperSetup` copy/labels.
- `docs/USER_GUIDE.md` updated: API key optional, no source editing, redirect URI
  copied from API Setup, quota per Google Cloud project.
- Do not claim the shared `CLIENT_ID` is operational; it remains effectively
  unused/legacy.

### Verification (run after all code changes)

- `npm run check` → PASS: 17 test files, 151 tests; 0 svelte-check errors, 2
  pre-existing unused-CSS warnings in `PlaylistModals.svelte`; file-size and CSS
  gates pass.
- `npm run build` → PASS for Chrome, Firefox, Edge; manifest validation and bundle
  budgets pass.
- `npm run test:extension` → PASS: 90 route/viewport checks, 6 interaction groups,
  no runtime errors.
- `npm audit --audit-level=high` was previously clean at root; playlist-manager
  install reports 0 vulnerabilities.
- Working tree remains dirty with pre-existing Edge, modal/theme, portal, and docs
  changes. No commit or push was performed.

### Next steps

1. Split/commit the intended release scope; Edge/issue fixes should not be mixed
   with unrelated UI work.
2. Add Phase 1 reliability tests for active sync: quota failure/resume, local-wins
   overwrite/conflict policy, and `savePlaylist` failure handling.
3. Real Microsoft Edge smoke test and IARC/submission remain external. A Partner
   Center draft now exists: Store ID `0RDCKFZCVDRK`, CRX ID
   `ncmipojoamaoacinccopmdkflgocghno`, Product ID
   `20f9b17d-73e7-45f8-8692-796867b7ec80`. The draft package was replaced locally
   with the rebuilt ZIP. The uploaded package must still be replaced with that
   rebuilt ZIP before certification; real Edge browser smoke test, IARC
   questionnaire, and submission remain pending.
4. OAuth silent-refresh fragility and the unused built-in `CLIENT_ID` remain known
   risks; do not ship a shared built-in client without Google verification/quota
   plan.

### Useful files

`.github/workflows/ci.yml`, `package.json`,
`packages/build-tools/verify-budgets.js`, `packages/build-tools/verify-file-size.js`,
`apps/browser-extension/playlist-manager/src/views/Saved.svelte`,
`apps/browser-extension/playlist-manager/src/services/playlist-actions.ts`,
`apps/browser-extension/playlist-manager/src/services/playlist-actions.test.ts`,
`apps/browser-extension/playlist-manager/src/components/Modal.svelte`,
`apps/browser-extension/playlist-manager/src/services/youtube-auth.ts`,
`apps/browser-extension/playlist-manager/src/utils/youtube-credentials.ts`,
`docs/USER_GUIDE.md`.

## Latest work — Microsoft Edge support and store submission prep (2026-10-25)

Edge (Chromium/MV3) support is implemented and verified locally. `dist/edge/manifest.json`
is generated from `manifest.chrome.json` with `key`/`browser_specific_settings`
removed; there is no static Edge manifest. `docs/EDGE_STORE_SUBMISSION.md` contains
the Partner Center checklist, listing copy, IARC/certification notes, and post-approval
wiring. `docs/edge-release-metadata.json` holds the listing fields; the 300×300 store
logo is `docs/assets/edge-store-logo-300x300.png`. The portal Edge button is hidden
unless `NEXT_PUBLIC_EDGE_STORE_URL` is set.

Verification on the current working tree:

- `npm run check`: 130 unit tests pass, zero Svelte diagnostics, CSS gate passes.
- `npm run build`: Chrome, Firefox, and Edge builds pass; manifest validation passes.
- `npm run pack:edge`: 64-entry ZIP, no maps, no `key`, no `browser_specific_settings`.
- Negative validation: adding `browser_specific_settings` makes validation fail.
- Portal production build passes; Edge button is absent with the env var unset.
  A dev build with a test URL renders the button and inlines the URL client-side.
- `npm run web:test`: exit 0; both extension tests skip in headless mode by design.
- Chromium 151 loaded `dist/edge` unpacked: popup and Settings rendered, no errors.
  A real Edge browser smoke test is still required.
- Edge ZIP SHA-256: `4696ecfad281a050ad292b53ee9441c67ec23293b992712f4e7b1254274ca377`.

The rebuilt ZIP comes from the current verified `dist/edge`. Before uploading, push
`main` so the privacy policy URL is current; the draft listing is still version 1.1.1.
A Partner Center draft exists (Store ID `0RDCKFZCVDRK`, CRX ID
`ncmipojoamaoacinccopmdkflgocghno`, Product ID
`20f9b17d-73e7-45f8-8692-796867b7ec80`), but submission, IARC, listing publication,
and a real Edge smoke test remain external user actions. The earlier uploaded ZIP was
stale (required an API key, lacked the new first-run onboarding) and must be replaced
before certification. No commit or push was performed.

During verification, two unresolved identifiers in the unrelated dirty `Manage.svelte`
broke `svelte-check`; they were restored to the existing names (`executeChangePrivacy`,
`faEarthAmericas`). No other unrelated runtime edits were made.

## Previous work — GitHub issues #10/#11/#13/#14 and Dependabot

All four issues addressed locally; details and usage in docs/GITHUB_ISSUE_FIXES.md.
45 open remote Dependabot alerts checked against local lockfile ranges: no
vulnerable matches remain; all three full npm audits are clean. Root unused Next
lock entries pruned; Vitest/mocker, Vite, Undici updated; portal selector-parser
override fixes the remaining Tailwind 3 dependency without framework migration.

Duration fixes cover partial cache/import hydration, normalized durationISO display,
and title-only oEmbed blocking later tiers. Pre-paint theme initialization has its
own external script/CSS and the build uses the canonical public HTML. Thumbnails
are opt-in, request only optional ytimg host access, use a separate IndexedDB
archive and shared preview component, and support raster-validated full backups.
Already missing images cannot be recovered. No archive data goes to cloud sync.

Verification: 130 units, zero Svelte diagnostics, check/build and portal build;
Chromium 90 checks, Firefox 90 checks, portal six sizes, focused issue suite,
web-ext lint all pass. Physical phones/real external account flows not retested.

Current store submissions were not changed. No push/issue closure/comment/alert
dismissal. Local version still 1.1.1: bump a NEW release before any future upload.
Next: owner pushes the local fix commit to the default branch so GitHub can
clear dependency alerts, then confirm/close issues when release fixes are available.
Pre-existing dirty layout/CSS/workflow files and iypm.sh must remain uncommitted
except the relevant root unused dependency removal required for lockfile consistency.
Own changes in shared PlaylistEditor/History/ManagePlaylistRow were staged as
partial patches using /tmp/iypm-issue-baseline snapshots. No Git push.

## Current continuation — Firefox Unlisted Test Release (v1.2.0.1) & v1.1.1 Status

CURRENT STATUS:

1. **Firefox Unlisted Test Release Created**:
   - Manifest temporarily bumped to `1.2.0.1` for unlisted beta channel signing.
   - Submitted to AMO under the unlisted channel (Version ID `6620940`, File ID `5165054`).
   - Package artifact saved locally at `dist/firefox/web-ext-artifacts/independent_youtube_playlist_manager-1.2.0.1.xpi`.
   - Local manifests restored to clean state `1.1.1`.
   - Current AMO state: `unreviewed` (automated review/signing pending for host/data permissions).
   - AMO Developer URL: https://addons.mozilla.org/en-US/developers/addon/iypm/versions/6620940
   - **Local Testing**: Can be loaded immediately via `about:debugging#/runtime/this-firefox` ("Load Temporary Add-on...").
   - **Public Test Link**: Once automated AMO validation attaches Mozilla signature, the direct link will install without warnings.

2. **Official Store Status (v1.1.1)**:
   - Chrome Web Store: Version 1.1.1 is submitted and pending review (automatic publication on approval).
   - Firefox AMO (Listed): Version 1.1.1 (ID 6620554) submitted with source code, pending review.
   - Web Portal: https://iypm.vercel.app/ remains deployed.
   - **NEXT STEP FOR USER**: Awaiting user confirmation to publish/push official release once store approvals complete. No AI auto-push permitted.

---

## Previous continuation — replacement release 1.1.1

FINAL STATUS: 1.1.1 is submitted to BOTH stores. Chrome dashboard: Pending review,
automatic publication on approval. Firefox listed version 6620554: unreviewed,
not disabled, source uploaded, correct data declarations confirmed by API.
Source commit dff9c9c, annotated local tag v1.1.1. Never pushed. The owner must
push main/tag, including the updated public privacy policy. User CHANGELOG.md
remains untouched/untracked. docs/RELEASE_READINESS.md records exact outcomes,
package hashes and limitations. Final check/build/pack and all browser suites pass:
120 units; Chromium 90, Firefox desktop 90, Android-UA 90, portal six sizes;
web-ext lint clean. Physical Android and real account/provider flows remain untested.
No implementation work remains in the approved plan; store approvals are external.
Next: owner pushes; review any marketplace feedback if received. No scheduled
monitor was created. The chronological notes below predate the final submission.

Earlier implementation and version 1.1.0 were committed as c4a1960/bdeb550 with
local v1.1.0 tag (no push). Firefox candidate 6620498 was submitted with source,
then disabled by authenticated PATCH after discovering its incorrect required
[none] data declaration. It is confirmed disabled. Do not re-enable it.

Replacement 1.1.1 declares required browsingActivity/websiteContent and optional
authenticationInfo/personallyIdentifyingInfo/searchTerms. New data-consent helper
requests optional consent directly in user actions. YouTube token reads/refresh,
Supabase initialization/session/SDK fetches and search enforce consent. Revocation
stops Supabase refresh and realtime. Tests now total 120; check/build pass. Native
Firefox persisted-token guard added to browser suite. Versions/lockfiles synced.

Chrome privacy disclosures and listing description saved accurately via CUA;
package draft still 1.1.0 until replacement upload. storeTab is on package page.
No 1.1.1 store submission yet. Final browser suites and web-ext lint running.
Next: finish final checks, commit/tag 1.1.1, archive committed source, pack, submit
Firefox and Chrome replacement; record exact store statuses. Preserve user untracked
CHANGELOG.md. Never push. Physical-device and real account/provider tests remain
unverified, as detailed in docs/RELEASE_READINESS.md.

Changed in this continuation: manifest/version/lockfiles, data-consent.ts and tests,
supabase-client.ts and consent tests, youtube-auth/api.ts, Search.svelte,
DeveloperSetup.svelte, verify-firefox.py, privacy/release notes and tracking docs.

The following older active-state notes are historical and superseded above.

## Active task: broad UX and release readiness implementation

User authorized implementation of all responsive improvements and publication to
Firefox/Chrome. Candidate version: 1.1.0 (not yet bumped or submitted). Work is
uncommitted on main. Preserve pre-existing untracked CHANGELOG.md. No Git push.

Implemented: adaptive popup/native dialogs, focus trap and nested scroll locks,
responsive shell/search/header/rows/forms, touch reorder buttons, filtered reorder
identity fix, builder route, mobile YouTube support, IndexedDB popup metadata writes,
settings cache invalidation, backup validation, OAuth state/redirect validation and
correct SHA-1 Firefox Android redirect. Portal fails closed on unconfigured sync,
patched Next.js, restored strict build checks. Build now creates index.html and
cleans stale generated chunks; package builder copies only runtime assets.

Latest verification: 111 unit tests, zero Svelte errors/warnings; Firefox desktop
90 route/viewport checks passed; another 90 passed with Android UA (not real Android).
Portal six sizes and sync rejection checks passed. Chromium 90-layout/interaction
suite caught a modal teardown error (`dialog` null in queued close event), now fixed
by guarding the reference. Re-run final suite after current build completes.

Tools/scripts added: packages/build-tools/extension-fixture.js, verify-extension.js,
verify-firefox.py (requires Selenium), verify-portal.js, build-extension.js. Screenshots
and reports in dist/verification. Firefox testing Python is /tmp/iypm-release-venv/bin/python;
uses disposable profiles and geckodriver Service(--allow-system-access). Actual Firefox
158.0.1 runs successfully. Chromium uses installed Playwright full channel chromium.
Portal production server is running on localhost:3050 (session 81481).

Publishing access: .env contains AMO_API_KEY and AMO_API_SECRET; authenticated AMO
profile GET succeeded. Never print their values. web-ext 10.8.0 is available via npx.
Public AMO addon ID 3059579, slug iypm, current listed version 1.0.1.
Chrome user reauthenticated via CUA; `storeTab` in cua_repl is live on package screen.
Publisher e070ead7-65ee-442e-8bc2-3a6a2b3c5f60; item dapjjdcnolpmfcnobilphjfpkmmokgid.
Existing version 1.0.1 was TAKEN DOWN Oct 15 for unused bookmarks permission; fixed
in source. Must submit updated package for review, not claim live reinstatement.
CUA mouse clicks timed out, but locator.press('Enter') works (e.g. Published tab).
Use observed dashboard links and keyboard activation. No uploads yet. Read CUA
file-upload docs before upload. Need source-code ZIP for Firefox minified sources.

Next: wait for current build, rerun Chromium; finish final package validation;
add release notes/readiness report; commit implementation; sync version and lockfiles,
build/package/test final release, commit bump and tag, create source archive, submit
both stores, inspect exact review status. Physical Android, OS keyboard, and real
Google/Supabase account flows remain untested and must be stated honestly.

## Latest task: responsive layout plan

Completed a source-based review of the toolbar popup, shared dialogs, shell,
active extension routes, settings and portal. Saved the proposed phased work in
docs/RESPONSIVE_UI_PLAN.md; linked it from PLAN and added pending implementation
phases to PROGRESS. No application UI code changed for this planning task.

Static popup browser check with app JavaScript disabled confirmed body width
stays 360px at 320/360/390px viewports; at 320px document content is 360px wide.
Six visible popup controls are below the proposed 44px touch-target height.
This is layout evidence, not a functional test of a live extension popup.

Validation: baseline check passed (103 tests; zero Svelte errors/warnings), and
Chrome/Firefox production builds passed. Existing warnings listed below remain.

Next: implement Phase 1 popup and shared dialogs according to the proposed plan,
then shell/shared components and the route coverage table. Full route screenshots,
keyboard-open behavior and Firefox Android real-device testing are still pending.
Planning files changed: docs/RESPONSIVE_UI_PLAN.md and .ai-sync/{PLAN,PROGRESS,HANDOFF}.md.

## Previous completed task

Changed PaginationNav.svelte, PlaylistEditor.svelte, History.svelte, and added
utils/pagination.ts and pagination.test.ts. Shared navigation uses native buttons
and bounded page windows. Editor clamps invalid pages and counts filtered videos.

Completed: responsive windows (seven items wide, five narrow), inert ellipses,
native previous/next buttons with disabled boundaries, current-page semantics,
and keyboard focus indicators. Editor uses filtered videos for page counts and
metadata loading; Editor and History clamp pages after results shrink.

Validation: npm run check passed (103 tests, zero Svelte errors/warnings).
Final npm run build passed for Chrome and Firefox with manifest validation.
Isolated browser harness passed page jumps, arrow boundaries, keyboard Enter,
and 240–1000px widths without horizontal overflow or runtime errors.
The harness used installed Chrome because Playwright's bundled Chromium was absent.
Live extension integration has not been manually exercised.

Existing warnings remain: dependency advisories, ESLint ignore configuration,
Rollup empty facade/Supabase circular dependency, Chrome missing fixed-ID key.
Build-induced lockfile changes were reverted. No dependency changes are intended.
Existing untracked CHANGELOG.md belongs to the user and remains untouched.

Next steps: reload the built extension from dist/chrome or dist/firefox and review
a large playlist visually. No remaining implementation work for this request.
