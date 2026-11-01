# Session — context menu + theme: fixes merged to `next` (version stays 1.2.1)

Date: 2026-11-01, 19:30–21:05 local. Agent: Hermes. Worktrees: `../iypm-cm`,
`../iypm-theme` (both created off `origin/next`, both now removable).

Owner instruction for this pass: **do not** merge to `main`, tag, publish or bump the
version; update the Markdown documents only. Release is deferred until after the owner's
next batch of changes.

## What landed on `next`

| Commit    | PR  | Scope                                                                                                        |
| --------- | --- | ------------------------------------------------------------------------------------------------------------ |
| `c1a9849` | #63 | editor UX polish incl. `themeChoice` as the persistent storage key (merged by a concurrent session at 20:15) |
| `d74e0ad` | #65 | persisted theme choice applied at startup + regression guard                                                 |
| `669049d` | #64 | context-menu gating, link resolution, reconciliation, advertised destination                                 |

`next` head after this pass: **`669049d`**. `package.json` version: **1.2.1** (unchanged).

## Defects fixed in #64

1. `disableContextSaved` was ignored: "My Playlists" stayed in the menu. Disabled families
   are now absent (hidden, not greyed) and the scope label always names a reachable
   destination.
2. A YouTube **non-video** link (channel / playlist / search) on a watch page captured the
   open video. `shared/link-capture.js` now resolves a `link` context from `info.linkUrl`
   only; page/media contexts keep their existing fallbacks.
3. Reconciliation could never remove `yph:saved`, `yph:scopes`, `yph:link`,
   `yph:destination`, `yph:settings`, and forgot owned ids when the service worker
   restarted. Replaced with `staleMenuIds(desired, previous ∪ persisted)` plus
   `yph_context_menu_ids`, written only on change.
4. `contextMenus.update` was called with `type`, which Chrome rejects; `properties.type` is
   deleted before the update while the signature stays stable.
5. Codex review (P2) on the PR: the menu advertised "Playlist Builder" while
   `startCapture()` still used the disabled configured target and threw on click. Fixed
   with a shared `effectiveDestinationMode()` used by both the label and the capture, plus
   two regression tests and a new mutation. Thread answered and resolved.

## Defect fixed in #65

Found while writing the guard for #63 — the merged theme fix was incomplete.

With `themeChoice: "dark"` in extension storage, a fresh page rendered **light**. Probe
evidence: `getSettings()` and a later `fetchObject("themeChoice")` both returned `dark`,
while the very first extension-storage read at startup returned `{}`, so `initTheme()`
fell back to the pre-paint cache and the choice was dropped. Practical impact: the theme
does not survive a fresh install, cleared storage, or a synced profile.

- Fix: `readStoredChoice()` retries the persisted read (4 × 120 ms) before falling back.
- Guard: a new interaction group in `packages/build-tools/verify-extension.js` writes
  `themeChoice` via `chrome.storage.sync`, forces a **real reload** (a hash-only `goto` is
  a same-document navigation and never re-runs startup), then asserts `data-theme` and the
  `yph-theme-choice` cache for both `dark` and `light`.
- Guard proven to bite: restoring the pre-#63 key (`yph-theme-choice`) makes it fail with
  `Persisted theme "dark" did not reach the page; rendered "light"`.
- A/B on the same probe: single read → `light` / cache `device`; retried read → `dark` /
  cache `dark`.

## Verification on the merged tree (`669049d`)

```
npm run check           exit 0   lint 0 errors (46 warnings), format clean, 573 tests
npm run build           exit 0   chrome/firefox/edge, all bundle budgets pass
npm run test:extension  exit 0   102 route/viewport checks, 8 interaction groups, no runtime errors
npm run test:capture-mutations  exit 0   7/7 mutants CAUGHT
```

Headed acceptance evidence (OpenSpec task 3.1):

```
cd apps/web-portal
HEADED=true IYPM_REQUIRE_EXTENSION_E2E=1 xvfb-run -a npx playwright test e2e/extension.spec.ts
  -> 2 passed (7.4s), exit 0, zero skipped
```

## Still open

- OpenSpec 3.2 / 3.3 / 3.4 — native context menus in a disposable Chrome and Firefox
  profile. Playwright and CDP cannot open a native menu, so these require a human; no
  result has been recorded and none may be inferred from the handler tests.
- OpenSpec 3.5 — issue evidence for #10 (narrow pagination), #11 (preserved thumbnails),
  #13 (first paint), #14 (duration badges). #13's first-paint half is covered by the new
  theme guard; the other three are not.
- CM-R7 / CM-R8 / CM-R9 (CI receipts, contract coverage, bundle triage).
- Popup theme path has no end-to-end assertion (only the popup sizing contract).
- Dependabot #60 / #61 / #62 remain red and untriaged.

## Housekeeping

- Editing locks released in all worktrees; no foreign file in the main checkout was
  modified except the Markdown files named above.
- Worktrees `../iypm-cm` and `../iypm-theme` can be removed; the local branches are merged
  (`fix/context-menu-gates`, `fix/theme-apply-persisted`) and deleted on the remote.
- No version bump, tag, release, store upload or `main` merge was performed.
