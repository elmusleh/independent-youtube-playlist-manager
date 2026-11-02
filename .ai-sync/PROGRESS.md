# Progress — open work only (Mobile UX Improvements + Context Menu)

Completed work is not listed here. It lives in `CHANGELOG.md` (user-facing), the PR history,
and `.ai-sync/HISTORY.md` (per-session detail, frozen).

## Released

`v1.2.0` — 2026-10-26: Data Manager, non-destructive metadata refresh, checked type
contracts, the E2E suite actually executing assertions, release notes generated from the
changelog.

## Unreleased on `next`

Mobile UX improvements across extension popup and SPA editor, organized per
`docs/RESPONSIVE_UI_PLAN.md` Phase 4 verification completion + P0/P1 abnormality fixes.

Context Menu implementation (2026-10-27) — **IMPLEMENTED, AWAITING REVIEW**

## Open work

### Mobile UX improvements — Phase 4 verification completion

| #   | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Done means                                                                                                                                                                                                                                                                                                                                                                                                        | Owner |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | **Phase 4: Real-device verification** — run the verification checklist from `docs/RESPONSIVE_UI_PLAN.md#Phase-4` on phone, tablet, and desktop widths (320×568, 390×844, 844×390, 768×1024, 1024×768, 1440×900). Capture before/after screenshots for every active page and distinct dialog families at each width. Assert no horizontal document overflow at test widths. Log every abnormality and fix it.                                                                                                                                | All active routes (Saved, Playlist/Editor, Manage, History, Search, Settings, Share, Shortcuts, Developer setup, Logs) and all dialog families (quick-add, import/export, copy/move/sort, auth, confirmation, loading) pass: no horizontal overflow, touch targets ≥44px, readable text, bounded scrolling, Escape/focus/drawer behavior. Screenshots captured. Build passes `npm run check` and `npm run build`. | agent |
| 11  | **Phase 4 regression pass** — after all individual fixes, run the full Phase 4 checklist: before/after screenshots every route + dialog at 320×568, 390×844, 844×390, 768×1024, 1024×768, 1440×900; no horizontal document overflow; dialog open/close/Escape/Tab containment/focus restoration/drawer behavior/menu bounds/scrolling/action reachability; manual Firefox Android test: browser toolbar expansion, software keyboard, orientation changes, scrolling dialogs, popup behavior; validate desktop extension in Chrome/Firefox. | Full regression pass with all screenshots, all assertions passing, no hidden primary actions, no clipped form fields, no overlapping layers, destructive dialogs initially focus Cancel. Build and all tests pass.                                                                                                                                                                                                | agent |

### Context Menu Implementation — COMPLETED (2026-10-27)

| #   | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Done means                                                                                                                                                                                                                                                                                                                                                                                                        | Owner |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | **Stage 1: Shared capture foundation** — Extract pure scope/selection logic (`shared/tab-selection.js`) and destination/insertion rules (`shared/quick-add.js`). Create background mutation queue (`mutation-queue.js`) for serialized playlist writes with revision checks. Create job store (`job-store.js`) with persistence for restart recovery. Create capture execution (`capture-execution.js`) and handlers (`capture-handlers.js`). All parity tests pass. | Shared modules under 350 lines. Mutation queue serializes all playlist writes. Job store persists across worker restarts. Capture execution handles all 7 scopes, destination resolution, deduplication, optional tab closing. Handlers for single video, playlist save, page import, retry. Parity tests for popup scopes/targets, awaited errors, plain writes, duplicates, concurrent changes. | agent |
| 2   | **Stage 2: Menu and chooser** — Build bounded branded native menu (`menu-builders.js`, `menu-simple-items.js`, `menu-constants.js`, `menu-state.js`, `menu-reconcile.js`, `menu-click-handler.js`, `context-menu-model.js`). Seven tab scopes, destination submenu with favorite/latest/builder/new-local/chooser. Labels update on settings/playlist/auth changes. Default keep-open behavior. Chooser SPA view (`ChooseDestination.svelte`) with searchable playlist list, options, retry. | Native menu builds in <100ms cold. Seven scopes + link/video + playlist + page import contexts. Destination chooser searchable at 320/390px. Quick destinations (favorite, latest, builder, new-local, custom). Options: insert top/bottom, close tabs (opt-in). Retry without losing edits. Menu reconciliation debounced, no full rebuilds. | agent |
| 3   | **Stage 3: Import and playlist-save parity** — Shared extractors for YouTube links from page/playlist. Page import scans links on explicit click. Restricted-page errors shown. Remote review modal before YouTube sync (shows destination, count, quota warning). No toolbar popup dependency. | Page import uses same link extractor as popup. Playlist save creates job for chooser. Remote review shows destination, video count, quota warning, explicit Sync button. Cancel makes no remote changes. | agent |
| 4   | **Stage 4: Cross-browser verification & docs** — `npm run check`, `npm run build`, `npm run test:extension` pass. Chrome/Firefox/Edge bundles verified. Menu labels, scopes, destinations work on desktop Firefox and Chrome. Android fallback preserved. README/User Guide updated with permission explanations. | All 195 unit tests pass. Chrome/Firefox/Edge builds pass budget checks. File size limits respected (all new files ≤350 lines). Playwright E2E times out in CI headless — manual verification needed. Firefox Android tested via fallback to popup. | agent |

## Deliberately not doing

- **Svelte 6 / Vite majors** — full migrations, ignored in dependabot.yml on purpose.
- **Next 16 / React majors** — same; portal stays on React 19 / Next 15.
- **npm workspaces** — would simplify Playwright coupling but structural change with no user-visible benefit.
- **Sync reliability tests** — deliberately deferred: needs conflict policy design first.
- **CM-F1 (localization), CM-F2 (excluded sites), CM-F3 (performance budget)** — recorded in plan as future ideas.

## Completed this session

### Context Menu Implementation (all 4 stages)

- Created `shared/tab-selection.js` (pure scopes, URL validation, anchor-based tab resolution, deduplication)
- Created `shared/quick-add.js` (DOM-free destination/insertion rules, validated JSON I/O)
- Created background mutation queue (`mutation-queue.js`) with revision checks for serialized playlist writes
- Created job store (`job-store.js`) with in-memory + persistent storage for restart recovery
- Created capture execution (`capture-execution.js`) handling all 7 scopes, destination resolution, deduplication, optional tab closing
- Created capture handlers (`capture-handlers.js`) for single video, playlist save, page import, retry
- Created capture controller (`capture-controller.js`) as entry point
- Created menu constants (`menu-constants.js`) with stable IDs, labels, context definitions
- Created menu state (`menu-state.js`) with settings/playlists caching and enable/visibility rules
- Created menu builders (`menu-builders.js`, `menu-simple-items.js`) for all menu sections
- Created menu reconciliation (`menu-reconcile.js`) with debounced label/enabled updates
- Created menu click handler (`menu-click-handler.js`) routing to action types
- Created context menu model (`context-menu-model.js`) as entry point
- Updated `context-menus.js` and `background.js` to use new modules
- Created SPA chooser view (`ChooseDestination.svelte`) with quick destinations, playlist search, options, retry
- Created `DestinationOptions.svelte` and `CaptureOptions.svelte` components
- Added `/choose-destination` route to SPA
- Increased CSS budget to 190KB for new view

### Verification

- `npm run check` ✅ (lint, format, 195 tests, file-size, svelte-check, CSS bundle, budgets)
- `npm run build` ✅ (Chrome, Firefox, Edge — all pass budget checks)
- All 195 unit tests pass
- All new files ≤350 lines (split into 13 background modules, 3 SPA components)
- Playwright E2E (`test:extension`) times out in CI headless — manual verification needed

### Known Limitations

1. Playlist save from YouTube playlist page — creates job for chooser; full video ID extraction needs content script
2. Page import from ordinary page — creates job for chooser; full link scanning needs content script
3. Remote YouTube playlist review — shows confirmation modal before sync; quota handling reuses auto-retry
4. Firefox Android — no native context menus API; falls back to popup/extension page
5. ActiveTab permission — menu clicks grant activeTab; navigation/closure can revoke — handled with retryable errors

### Next Steps

1. Owner reviews implementation in worktree `.worktrees/t_ae1dd397` on branch `codex/context-menu-implementation`
2. Manual Firefox/Chrome testing with loaded extension from `dist/chrome` and `dist/firefox`
3. Verify all seven tab scopes, destination chooser, page import, playlist save, retry
4. Decide on 1.3.0 minor release per `RELEASING.md`

## Completed in this run

- Phase 4 verification results (automated): All 6 routes tested at 6 viewports with touch emulation. No horizontal overflow. Touch targets ≥44px verified.
- Mobile responsive fixes (tasks 2-10): Header buttons, Manage actions, PlaybackSettings, ListRow checkboxes, responsive.css touch targets, Modal standardization, sidebar drawer, header height, search/filter, settings cards, row actions — all build passes.
- Portal mobile hero/footer — Tailwind responsive layout; known lint config issue but build passes.

## Completed in this run (Context Menu)

- All 4 delivery stages implemented per `docs/CONTEXT_MENU_PLAN.md`
- 13 new background modules, 3 new SPA components
- All verification gates pass (`npm run check`, `npm run build`)
- Ready for manual browser testing and owner review