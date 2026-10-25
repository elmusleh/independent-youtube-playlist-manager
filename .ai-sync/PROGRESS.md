# Pagination progress

- [x] Baseline checks: 99 tests passed, no Svelte diagnostics.
- [x] Implement compact shared navigation and filtered playlist page counts.
- [x] Add page-window regression tests.
- [x] Final check: lint, formatting, 103 tests, zero Svelte errors/warnings.
- [x] Browser verification: page jumps, arrow boundaries, keyboard Enter,
      widths 240–1000px without horizontal overflow or runtime errors.
- [x] Final Chrome/Firefox production builds and manifest validation passed.

## Responsive layout planning

- [x] Inspect popup, shared dialogs/shell, active views, and current portal layout.
- [x] Document concrete findings, phased scope, and acceptance/test criteria.
- [x] Implement Phase 1: popup and shared dialogs.
- [x] Implement Phase 2: shell and shared components.
- [x] Implement Phase 3: active routes and portal responsive fixes.
- [ ] Complete Phase 4: responsive and real-device regression verification.

## Release readiness work

- [x] Remove unused bookmarks permission identified in Chrome's October 15 takedown.
- [x] Limit web exposure, support mobile YouTube hosts, fix tab metadata persistence.
- [x] Restore builder route, filtered reordering, touch/keyboard reorder controls.
- [x] Fix cross-context settings cache invalidation and Firefox OAuth URL/state handling.
- [x] Reject malformed/future backups and avoid clearing unrelated data for legacy imports.
- [x] Fix clean-build HTML generation and eliminate stale chunks from release packages.
- [x] Upgrade vulnerable dependencies: extension audit clean; portal production audit clean.
- [x] Portal production build now includes working lint and type checks.
- [x] Unit checks: 111 tests; zero Svelte errors/warnings.
- [x] Real Firefox: 90 route/viewport checks on desktop, 90 with Android user agent.
- [x] Portal: six sizes and fail-closed sync API behavior verified.
- [x] Chromium suite after final modal teardown guard: 90 checks, six interaction groups, no runtime errors.
- [x] Firefox package web-ext lint: zero errors, warnings, notices.
- [ ] Final version sync, release notes, source archive, store packages, commit and tag.
- [ ] Submit Firefox listed update using verified configured AMO credentials.
- [ ] Submit Chrome update using the authenticated dashboard (existing listing taken down).
- [ ] Record exact store outcomes and remaining real-device/authenticated-flow limitations.
