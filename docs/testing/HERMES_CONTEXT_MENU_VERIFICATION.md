# Hermes handoff — context-menu verification

The owner explicitly delegated test execution to Hermes. **No tests, build,
typecheck, audits, or native-browser verification have run for this implementation
pass.** Earlier green results describe the previous code, not the current changes.

Repository: `/home/steve/dev/independent-youtube-playlist-manager`
Branch: `codex/context-menu-plan` (PR #51 into `next`). Keep all work local; do not
merge, publish, tag, deploy, close issues, or post GitHub comments. Preserve existing
uncommitted release preparation, package version/lockfile and README edits. Read
`AGENTS.md`, `.ai-sync/HANDOFF.md`, `PROGRESS.md`, `PLAN.md`, and
`docs/CONTEXT_MENU_PLAN.md` before starting. User delegation overrides the repository's
normal requirement for the implementation agent to execute verification itself.

## Automated commands — sequentially, from repository root

1. `npm run check` — lint, formatting, all unit tests, Svelte diagnostics and guards.
2. `npm run build` — production bundles, all three packages, manifest/CSS/module/budget gates.
3. `npm run check` — verify installed dependencies and generated notes after build.
4. `npm run test:extension` — previous failure was `/playlist-builder` waiting for
   `.playlist-video`. Builder now renders IDs without awaiting remote metadata; the
   package also includes `shared/`, which was previously omitted. Investigate any
   remaining timeout rather than increasing its duration or skipping assertions.
5. `npm run test:capture-mutations` — deliberately breaks privacy, scheme validation,
   revision checks and durable storage in disposable copies. Baseline must pass;
   every mutation must be CAUGHT, not SURVIVED. The worktree is never mutated by it.
6. `npm run audit:all` — full and production-only audits across all three trees.
   Save/triage advisories per `docs/DEPENDENCY_TRIAGE.md`; failures are not permission
   to run `npm audit fix --force`. Do not mark remediation complete without evidence.
7. `npm --prefix apps/web-portal run build` and the existing portal E2E suite after
   confirming its dependencies/browsers are installed and versions are aligned.
8. Firefox manifest lint using the installed/pinned web-ext tooling against `dist/firefox`.

Do not run `check` and `build` concurrently: build reinstalls the editor dependencies.
If a command fails, save its exact command, exit status, relevant output and suspected
cause. Fix test mocks only when they model the real protocol; never restore direct UI
storage writes or weaken privacy/conflict assertions to make old tests pass. The new
`test-support/library-fixture.ts` uses the actual mutation authority in memory.

## Native browser gesture matrix — mandatory, separate from unit/E2E claims

Start `npm run native:fixture` (loopback only, port 43177). Use disposable Chrome and
Firefox desktop profiles. Load **rebuilt** `dist/chrome` and `dist/firefox`; do not use
or modify the owner's regular profile. For Firefox, use temporary add-on loading or
approved local web-ext tooling. Open `http://127.0.0.1:43177/`.

- Open the **real browser-native** page menu and select Import YouTube links. It must
  use the gesture's actual activeTab grant on this non-YouTube origin. Confirm three
  unique IDs, excluding the duplicate and spoof. Do not substitute a direct handler
  call or pre-granted all-sites host permission.
- Open page/link/image/video/frame/selection contexts; verify one bounded root,
  My Playlists, Settings, target choice and seven scopes. Traverse using keyboard.
  Check light/dark/high contrast and OS/browser-native menu rendering.
- Current, selected, left, right, window, other and normal-windows scopes: include an
  inactive anchor, highlighted/unhighlighted anchors, multiple windows, moved tabs,
  duplicate IDs, pinned tabs and private tabs. Expected order: anchor window first,
  other window IDs ascending, each by tab-strip index. Private invocation explains
  exclusion. No private data may enter a normal playlist.
- Destination selection must only remember the next destination. Test favorite,
  latest (including a cached remote latest), builder, new local and searched custom
  targets. Missing/deleted targets show chooser and explanation. Test independent
  saved/builder disables and master switch, top/bottom insertion and open-after-add.
- Opening the menu must cause no remote playlist fetch. Rename/delete a destination,
  restart the worker/browser, and verify reconciliation without duplicate menu entries.
- Source navigation/closure/window movement during import must fail safely. Test a
  protected browser/store page without widening permissions. Quantity 0 = all;
  reverse order, cancellation, retry and 320/390px chooser must remain usable.
- Popup and menu capturing into different playlists concurrently must both survive;
  stale dirty editor save must display a conflict and preserve edits. A clean editor
  should receive additions without a full page reload. Save a builder while another
  source appends; clearing consumes only saved IDs and preserves the addition.
- Remote Sync: use a dedicated test account/playlist only with explicit owner approval
  for live mutations. Until then, unit tests with API fakes verify no remote writes
  without consent, quota failure progress and restart reconciliation. Cancel must
  send no new requests; partial/uncertain operations must not close tabs or resend an
  uncertain request. Report live-account checks as unverified when not authorized.
- Default native-menu capture keeps tabs open even when popup closing defaults true.
  When enabled, close only newly saved, unchanged, unpinned source tabs. Duplicate-only,
  failed, moved, navigated, private and partially synced tabs remain open.
- 14,000-video destination and large tab batches: no menu growth with playlist count,
  bounded metadata requests, visible progress and meaningful retry.
- Firefox Android: popup/extension-page paths continue to work; no native-menu parity
  claim. Real phone testing is separate from desktop emulation.

## Firefox Android watch-history acceptance (manual)

> **Status: pending manual check.** Not yet run on a physical device — this section is
> the manual checklist to execute, not a record of completed verification. Automated
> coverage uses desktop browsers and a Firefox Android user-agent only.

Real phone (Fenix 142+), not desktop emulation. Load the rebuilt `dist/firefox`
package via `about:debugging` or the signed unlisted `.xpi`.

- Play a video from a local playlist on `m.youtube.com` (Fenix serves mobile there).
  Confirm a `[Watch Tracker] Initializing for video …` log and that the video appears
  in Watch History with the correct title/channel.
- Watch partway, background the app (or lock the screen) and foreground it. Reopen the
  same video: it must resume from the recorded timestamp.
- Open a `/shorts/ID` video and confirm it is recorded in Watch History.
- Rotate the device, open/close the software keyboard and navigate away mid-video:
  the last position must still be saved (no debounce drop on suspend).

History must record and resume on `m.youtube.com`, `www.youtube.com` and `youtube.com`
alike. If it only works on one host, re-check the content-script `matches` against the
`validate-manifests.js` wildcard guard.

## Open issue regression checks

- #14: import many IDs, fetch missing titles/durations, verify duration badges and
  explicit missing-duration messaging. Repeat with unavailable providers: IDs and
  existing metadata must survive. The fetch action is optional and cancellable.
- #13: set dark theme and reload; inspect the first rendered frame. Test explicit
  light/dark choices against the opposite device theme and device-theme changes.
- #11: enable optional thumbnail archiving, view a playlist, block thumbnail network,
  mark a video deleted, and confirm archived bytes still render and round-trip through
  full backup/restore. Images never archived before deletion cannot be recovered.
- #10: first/last/previous/next pagination at 320/390px, 205 and 14,000 items, filtering
  while on the last page, keyboard controls and 44px touch targets.

## Report back

Write `.ai-sync/sessions/2026-10-31-hermes-verification.md`, update HANDOFF/PROGRESS,
and return exact pass/fail evidence, any fixes made, and remaining manual checks.
Do not claim release readiness from unit tests alone. Dependency remediation and
native/browser evidence remain gates until their actual results are reviewed.
