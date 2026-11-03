## Sync v2 — encrypted cross-device sync (in progress on `feat/sync-hardening`)

Full status: `docs/SYNC_V2_STATUS.md`. Phases 0–3 done; Phase 3 follow-up (adapter wiring),
Phase 4 (UI split), Phase 5 (extras) remaining.

## 2026-11-03 — Dependency modernization plan (completed)

- Goal: update all dependencies to latest compatible versions and fix resulting issues.
- Completed in isolated worktree `chore/dependency-modernization`:
  - Next.js 15→16.4.4, React 19.3.1, ESLint 9→10, Rollup 4.67.4, Svelte-check 4.7.8
  - Portal Radix/Supabase/Tailwind deps upgraded
  - minimatch override 11.0.4 applied (fixes Dependabot alerts #104-#107)
  - Portal lint migrated from `next lint` to `eslint .`; eslint.config.mjs flat config
- `npm run check` exit 0, `npm run build` exit 0 after all changes.
- Remaining: `deepmerge` (no patched version), `@sveltejs/vite-plugin-svelte` (dev-only).

## Pinned favorites pin-button regression — fix in progress (2026-11-02)

The sidebar pinning implementation is present; the missing editor affordance was caused by
placing the control in `ViewHeader`'s `rightActions` slot while that slot is shown only when
the title is not being edited. The editor starts in editable-title mode, so the control never
rendered in the user's normal view. A fix now renders the dedicated pin button in the title
action row next to—but independent from—the unique Watch Later star. Regression coverage
proves multiple offline pins, sidebar visibility, and Watch Later independence; `npm run check`,
build, extension UI checks and the packed Chrome ZIP runtime smoke check passed. All three
packages were refreshed. Local changes are not yet committed/pushed to PR #81; do not claim
manual user installation is verified—only isolated Chromium package verification is.

## Pinned favorites pin-button regression — fix in progress (2026-11-02)

The sidebar pinning implementation is present; the missing editor affordance was caused by
placing the control in `ViewHeader`'s `rightActions` slot while that slot is shown only when
the title is not being edited. The editor starts in editable-title mode, so the control never
rendered in the user's normal view. A fix now renders the dedicated pin button in the title
action row next to—but independent from—the unique Watch Later star. Regression coverage
proves multiple offline pins, sidebar visibility, and Watch Later independence; `npm run check`,
build, extension UI checks and the packed Chrome ZIP runtime smoke check passed. All three
packages were refreshed. Local changes are not yet committed/pushed to PR #81; do not claim
manual user installation is verified—only isolated Chromium package verification is.

## Ship remaining unshipped work — plan (2026-11-01)

**Base branch: `next` @ `669049d`** (synced; already includes #63 ui-polish, #64
context-menu-gates, #65 theme-choice). All new branches cut from `next`; PRs target `next`.

Verified unshipped (git cherry vs `origin/next`):

- `fix/portal-logo-weight` (e2223fc, worktree `~/dev/iypm-worktrees/portal-logo`) — 1 commit;
  rebase off `next` → PR. Ready.
- `docs/improvement-plan` (161ff05, worktree `~/dev/iypm-worktrees/improvement-plan`) — 1 commit;
  rebase off `next` → PR. Ready.
- Modal backdrop-dismiss fix (uncommitted `Modal.svelte` + `verify-extension.js`, verified) —
  commit on `fix/dialog-backdrop-dismiss` off `next` → PR. Ready.
- `feat/ui-polish` (16 commits, HEAD 4745849) — net-only **18 files / 518 insertions** vs
  `next`, so most is already shipped by #63/#65; extract the genuinely-new remainder
  (`theme.store.ts` + a few files) after a targeted diff → one small follow-up commit.
  Do NOT blanket-cherry-pick the 16 commits.
- Context-menu feature (large, acceptance-pending): `codex/context-menu-plan` (42 commits,
  112 files, 5362 deletions), `codex/context-menu-implementation` (1 commit + uncommitted
  worktree), `feat/context-menu-capture` (3), `test/native-menu-acceptance` (1). Consolidate
  into ONE branch off `next`, finish CM-R7/R8/R9 + native/device evidence → one PR.
  Separate, careful session — not part of the quick ship.

Cleanup after shipping: archive `feat/orchestration-coordinator` (pilot #52), `ci/beta-release*`
(superseded by #57), `backup/codex-context-menu-plan-pre-split` (after context-menu ships);
drop the 3 lint-staged stashes; inspect `stash@{0}` (vercel rootDirectory) before discarding.

## Pinned favorites — pending (PR #75 open; NOT yet on next)

PR #75 (`feat/pinned-favorites`) is open but has not merged. `favoritePlaylistIds`,
`Favorites.svelte`, `FavoritesManager.svelte` are NOT yet on `next`. Do not treat this
as complete until #75 merges and verification passes. Full detail in
`.ai-sync/sessions/2026-11-01-pinned-favorites-planning.md` and `.ai-sync/HANDOFF.md`.

## Modal dismissal on outside click — planning authorized 2026-11-01 (no code yet)

Owner asked to fix dialogs that only dismiss via `X`/`Cancel`, not by clicking outside.
Root cause: `Modal.svelte` gates backdrop dismissal to `size === "drawer"` only. Locked scope:

- Dismiss any dismissible dialog on backdrop click/tap, all sizes (small/standard/wide/drawer).
- Preserve the `dismissible` guard (LoadingModal, progress modals stay open).
- Backdrop dismissal routes through cancel/close, never confirm.
- Ignore interactions that begin inside and end on the backdrop (drag-select safety).
- Single component change (`Modal.svelte`); OpenSpec change
  `openspec/changes/dismiss-dialogs-on-outside-click/` (proposal/spec/design/tasks, validated strict).

Sequencing: implement → Playwright interaction check → Hermes `check`/`build`/`test:extension`
→ manual device matrix. All tasks unchecked; implementation awaits owner go.

## Encrypted cross-device sync — planning authorized 2026-11-01 (no code yet)

Owner approved the formalized plan after the 2026-11-01 discussion. The OpenSpec change
`openspec/changes/add-encrypted-cross-device-sync/` (proposal, specs, design, tasks — all
validated strict) and `docs/ENCRYPTED_SYNC_PLAN.md` hold the full scope. Locked decisions:

- Zero-knowledge sync key as the only credential (no email, no recovery; loss disclosed).
- End-to-end encrypted whole-state snapshots (AES-256-GCM, PBKDF2 key, SHA-256 address).
- Automatic triggers (debounced push, startup pull, manual Sync now), LWW by revision,
  pre-import local backup safety net.
- Pluggable backends, all planned: File, Supabase bring-your-own, Google Drive
  (`appDataFolder`, reuses Google OAuth). Backends implement one 3-method interface.
- Selectable sync contents (playlists, metadata, thumbnails, history, settings).
- Module registry + Plugins screen in the sidebar footer; API Setup becomes toggleable.
- Excluded: mp3/mp4 downloads, media content storage, web-portal/manifest/release changes.
- SOLID: engine depends on injected interfaces; backends are interchangeable adapters.

Sequencing: core+File backend → Supabase BYO → Drive → Plugins screen → retire the
unwired plaintext `supabase-sync.ts`/`supabase-client.ts` after acceptance. All change
tasks are unchecked; implementation awaits a new owner request (planning only this pass).

## Context-menu completion (existing, still open)

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

## File splitting plan (future sessions)

The following files exceed the 350-line limit and need splitting. Each should be a dedicated session.

### storage-service.ts (1230 lines)

- **Split strategy**: Extract into 3 modules:
  - `cache-service.ts` — persistent cache (PERSISTENT_CACHE_KEY, getCacheTTL, isFresh, bustCache)
  - `playlist-crud.ts` — local playlist CRUD (saveLocalPlaylist, removeLocalPlaylist, getLocalPlaylists)
  - `settings-service.ts` — settings management (invalidateSettingsCache, migrateSettings, _cachedSettings)
- **Risk**: Side-effect registration pattern (imported for side effects in main.ts). Must preserve window.* assignments.
- **Verification**: Run full test suite + build after split.

### youtube-api.ts (1770 lines)

- **Split strategy**: Extract into 3 modules:
  - `innertube-client.ts` — multi-client Innertube engine (MWEB, WEB, TVHTML5)
  - `oembed-scraper.ts` — oEmbed and embed page scraping
  - `api-quota.ts` — YouTube Data API v3 batch queries
- **Risk**: Complex internal dependency chain. Must verify compiled bundle includes all modules.
- **Verification**: Run `npm run build` and check dist/ output.

### Manage.svelte (2137 lines)

- **Split strategy**: Extract sub-components:
  - `PlaylistList.svelte` — playlist list with search/filter
  - `PlaylistDetail.svelte` — single playlist detail view
  - `BulkActions.svelte` — bulk delete/move operations
- **Risk**: Heavy prop drilling and event handlers. Must preserve reactivity.
- **Verification**: Svelte-check + manual UI testing.

### PlaylistEditor.svelte (1930 lines)

- **Split strategy**: Extract sub-components:
  - `VideoList.svelte` — video list with drag-and-drop
  - `VideoEditor.svelte` — single video edit form
  - `PlaylistHeader.svelte` — playlist title/description editing
- **Risk**: Complex state management with autosave debounce.
- **Verification**: Svelte-check + manual UI testing.

### Immediate (before release)

1. **Wire up context menu capture flow.** The cherry-picked files (ChooseDestination.svelte, CaptureOptions.svelte, DestinationOptions.svelte, menu-state.js, mutation-queue.js) exist but may not be fully wired into App.svelte routes. Verify the capture flow works end-to-end.
2. **Fix a11y warnings.** Svelte-check reports a11y_click_events_have_key_events in FavoritesManager.svelte. Add keyboard handlers or use `<button>` elements.
3. **Fix non_reactive_update warnings.** HeaderSearchBar.svelte uses non-$state variables that are updated. Declare with $state().
4. **Remove unused CSS selectors.** FavoritesManager.svelte and Sidebar.svelte have unused CSS selectors that inflate bundle size.

### Short-term

5. **Split large files.** Several files exceed 350 lines and are allowlisted: PlaylistEditor.svelte (1930), Manage.svelte (2137), youtube-api.ts (1770), storage-service.ts (1230). Split these in dedicated sessions.
6. **Migrate Next.js middleware to proxy.** Next.js 16 deprecates `middleware.ts` in favor of `proxy`. Run `npx @next/codemod@canary middleware-to-proxy .` in apps/web-portal.
7. **Add `type: module` to playlist-manager package.json.** Eliminates the rollup ESM warning during builds.
8. **Monitor bundle budget.** CSS bundle is at 217.5/220 KiB. Future CSS additions may exceed the limit.

### Long-term

9. **Consolidate sync branches.** All future sync work should go through a single branch to avoid the overlap that occurred.
10. **Automate branch cleanup.** Consider adding a CI check or GitHub Action that flags branches older than 30 days without PRs.
11. **Add dependency update automation.** Consider configuring Dependabot to auto-merge patch/minor updates with passing CI.
12. **Improve test coverage.** The sync modules have tests but the new capture flow modules (menu-state, mutation-queue) may not have tests yet.
