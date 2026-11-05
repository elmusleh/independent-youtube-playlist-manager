# Toolbar popup: mobile sizing and instant-open plan

**Status:** implemented and verified. `apps/browser-extension/popup/*` was rebuilt around an
explicit `ui-popup` / `ui-page` mode split; Font Awesome was replaced with an inline SVG
sprite; handlers are now wired before any `await`. See `.ai-sync/HANDOFF.md` and
`.ai-sync/PROGRESS.md` for the exact changes and verification evidence.

**Decisions (resolved by owner):** desktop popup 420 px wide (bigger than the previous
effective 360 px); Firefox Android renders full-screen (full width + full height);
Font Awesome replaced with inline SVG (recommended best practice — a 93 KB CSS + 147 KB
font was being shipped for 9 glyphs).

**Scope:** `apps/browser-extension/popup/*` and the popup checks in
`packages/build-tools/`. No storage schema, no capture/menu behavior, no version change.

## How the numbers below were produced

Real browser measurements, not source inspection:

- Built package served from `dist/chrome` over HTTP, driven with Playwright Chromium.
- Layout probes at 280/320/360/375/390/412/430/768 CSS px.
- Timing probes with CDP `Network.setCacheDisabled` + `Emulation.setCPUThrottlingRate = 6`
  (mid/low-tier phone class) and a Pixel-7 user agent.
- Popup-window size simulation: repeatedly re-lay out the document at its own content
  width/height, which is what a browser popup host does (a popup window is sized from the
  document's preferred size and the document is then laid out at that size again).

Reproducing the actual desktop popup window (`chrome.action.openPopup`) needs a user
gesture in this Chromium build, so the **popup window size itself is inferred** from the
measured layout feedback plus the documented host behavior (Chrome: popup ≤ 800×600,
window size = document preferred size). Everything else is measured.

## Measured baseline

| Observation                            | Measurement                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop popup width                    | 360 px, not the 380/400 px the tokens claim. A 380 px viewport yields a 360 px body.                                                                                                                                                  |
| Phone 375 px                           | body 360 px → 15 px uncovered strip on the right                                                                                                                                                                                      |
| Phone 412 px (Pixel 7)                 | body 390 px → **22 px uncovered strip**, transparent `html` → white in dark theme                                                                                                                                                     |
| Phone 430 px                           | body 414 px → 16 px strip                                                                                                                                                                                                             |
| Popup height                           | always equals the popup's own height: `min-height: 100dvh` = current viewport height. Body 600 px tall with the menu ending at 513 px (87 px of empty popup), 1200 px viewport → 1200 px body.                                        |
| Primary button `#open-playlists`       | 26–30 px tall (12 px font, 6 px padding) — the app's main action                                                                                                                                                                      |
| Small hit targets                      | 2 at every width (`#open-playlists`, `#popup-settings-link`)                                                                                                                                                                          |
| Input/select font                      | 13 px at 390 and 412 px (16 px only inside the ≤389 px blocks) → phone autozoom on focus                                                                                                                                              |
| Safe-area padding                      | `padding: 0px` everywhere: `env(safe-area-inset-*)` is used **without** `viewport-fit=cover`, so it is always 0 on notched devices                                                                                                    |
| Theme application                      | `data-theme` set at 52–89 ms locally, after the whole module graph + a storage round-trip; CSS default is light → white flash at every open for dark-theme users. No `color-scheme` meta, so native `<select>`/scrollbars stay light. |
| First paint (throttled 6×, cold cache) | 124 ms, DOMContentLoaded 175 ms, load 187 ms                                                                                                                                                                                          |
| First click handler live               | **189 ms** — every button is inert until then                                                                                                                                                                                         |
| Payload before first paint             | 30 requests: 112 KB CSS (93 KB Font Awesome), 146 KB JS, 147 KB `fa-solid-900.woff2`                                                                                                                                                  |

Layout sizes probed include 280 px (Galaxy Fold cover) where the header wraps to 81 px and
the target row collapses to one column.

## Root causes

### RC-1 — Viewport media queries are being used to describe the popup _window_

A browser popup's viewport **is** the popup. So `@media (max-width: 767px)` matches inside
every desktop popup (popup inner width is content-derived and ≤ 800). Consequences:

- The "mobile" branch (`width: 100%`, `min-height: 100dvh`, safe-area padding, 14 px fonts)
  is the branch the desktop popup actually renders, at all times.
- The `min-width: 768px` and `min-width: 1024px` branches are unreachable in a popup — dead
  code that looks like desktop design.
- `min-height: 100dvh` inside a content-sized window means "be as tall as I currently am".
  The popup can never size to its content: it is pinned to the host maximum (600 px) or
  opens at an unstable height that changes after the click. This is the main reason the
  popup "does not open right" on the first attempt and looks half-empty.

### RC-2 — Width feedback loop plus hard-coded phone widths

`body { width: 380px; max-width: calc(100vw - 32px) }` is self-referential in a popup: the
viewport width comes from the content width, so each layout pass shrinks the body by a
further 32 px. On top of that, two overlapping breakpoint sets (CSS lines 51–114 and
864–1039) disagree and the later set wins, producing fixed 360/390/414 px widths instead of
using the available width. Result: the sheet is narrower than the phone, with a visible
strip — white in dark theme because `html` has no background.

### RC-3 — Touch targets

`#open-playlists` (26–30 px) and the inline settings link fail the 44 px minimum. Header
padding/spacing was never scaled for touch.

### RC-4 — Inputs below 16 px

The 16 px "prevents iOS zoom" fixes exist only inside `@media (max-width: 389px)`. Most
phones are 390–430 px, so the fix never applies where it is needed.

### RC-5 — Dead safe-area code

`env(safe-area-inset-*)` without `viewport-fit=cover` in the viewport meta returns 0. The
notch/home-bar padding is decorative only.

### RC-6 — Theme flash and native-control mismatch

Theme is applied only after `init()` awaits the module graph and `getSettings()`; the CSS
default is light. Dark-theme users get a white flash on every popup open, and native
`<select>`/scrollbars stay light because `color-scheme` is not declared.

### RC-7 — Handlers are wired after await-chains (the "first click does nothing" bug)

`popup.js` does:

```
init() → await log() → await waitForGlobal("videoService", 30)   // up to 3 000 ms
       → await waitForGlobal("getSettings", 20) → await getSettings()
       → setupUI()          // every onclick is assigned only here
       → await loadDefaultTabScope() → await initTargetData()
```

The popup paints immediately but rejects every click until that chain finishes: 189 ms
measured on a 6× throttled CPU with a warm local disk — realistically 0.5–1.2 s on a phone
and worse on a cold start. A user who taps once, sees nothing, and taps again can close the
popup that appeared in between. That is exactly the reported symptom.

### RC-8 — The regression is invisible to CI

`verify-extension.js` checks the popup only as a **regular tab** at 320/390/768 and only
asserts "no horizontal overflow". A tab has a real viewport and therefore exercises different
CSS branches than a popup. `docs/RESPONSIVE_UI_PLAN.md` already warned that "a regular tab
does not reproduce browser-controlled popup dimensions" — but nothing enforced it. Height,
tap targets, input font size and handler readiness are not asserted anywhere.

## Plan

Order is deliberate: harness first so every later step is verifiable, then sizing, then
speed, then handler readiness.

### P0 — Popup-mode harness (test-first, no user-visible change)

1. `packages/build-tools/verify-popup.js`: new check that
   - loads `dist/chrome/popup/popup.html` with `?mode=page` at 320/360/390/412/430/768 and
     with popup mode (fixed width) at 400 px;
   - asserts body width equals the viewport width in page mode (no strip) and equals the
     popup token in popup mode;
   - asserts body content height equals the natural content height (no viewport-driven
     `min-height`);
   - asserts every visible `button`, `select`, `input`, `a` is ≥ 44 × 44 px;
   - asserts `font-size ≥ 16px` for text inputs/selects under `(pointer: coarse)`;
   - static check: no `100vh` / `100dvh` / `100vw` / `calc(*100vw*)` and no
     `env(safe-area` without `viewport-fit=cover` in `popup.css` / `popup.html`;
   - timing budget on a 6× throttled cold load: paint ≤ 250 ms and every click handler
     live ≤ 150 ms.
2. Wire it into `npm run test:extension`; update `verify-extension.js`'s popup loop to call
   the page mode explicitly instead of relying on fortuitous media queries.
3. Confirm the new check **fails** on the current tree (it must reproduce RC-1…RC-7) before
   any fix lands.

### P1 — Explicit popup vs page mode (fixes RC-1, RC-2)

1. Add a tiny synchronous classifier in `<head>` before any stylesheet:
   `chrome|browser.extension.getViews({type:"popup"}).includes(window)` → `ui-popup`,
   otherwise `ui-page`; `?mode=` query overrides it (used by tests and dev). If the API is
   unavailable, fall back to `ui-page`.
2. `html.ui-popup`: fixed `width: var(--popup-w)` (single token, 400 px), `height: auto`,
   **no** `vw`/`vh` units anywhere, no `min-height`. The host then sizes the window to the
   content height once and stops.
3. `html.ui-page`: fluid (`width: 100%`), `min-height: 100dvh` allowed, content column
   `max-width: 640px` centred, safe-area padding.
4. Delete the duplicate breakpoint block (CSS 864–1039) and the unused
   `--popup-width-tablet/-mobile*` tokens. Keep a single ordered set; inside popup mode use
   `@container`/`minmax(0, 1fr)` reflow instead of width media queries, since popup width is
   now constant.
5. Give `html` the theme background (`background: var(--app-bg)`) so no uncovered strip can
   ever be white in dark theme.

### P2 — Expand and adapt for phones (fixes RC-3, RC-4, RC-5)

1. Touch tokens: `--hit-touch: 48px`, `--hit-min: 44px`. Header primary action becomes a
   44–48 px pill with label; below 360 px it becomes 48 × 48 icon-only with
   `aria-label="My Playlists"`.
2. `@media (pointer: coarse)`: 16 px inputs/selects, 15–16 px menu titles, 48 px rows.
   Keep desktop at 13–14 px but never below 44 px hit area.
3. Add `viewport-fit=cover` to the viewport meta; apply
   `padding: max(0px, env(safe-area-inset-*))` to body and to the channel-page footer.
4. Sticky action footer inside the channel page (`position: sticky; bottom: 0`) so Import
   stays reachable on short screens and when the software keyboard is open.
5. Bound the channel page: `max-height` from the visible area with one internal scroll
   region; keep the popup's main menu non-scrolling.

### P3 — First-paint payload (fixes the slow half of RC-7)

1. Replace Font Awesome in the popup (93 KB CSS + 147 KB font, 9 glyphs used:
   list-ul, star, clock, chevron-down, plus, file-import, gear, download, arrow-left) with
   inline SVG `<symbol>` sprite in `popup.html` + small CSS. Target: popup CSS ≤ 22 KB still.
2. Stop loading editor modules eagerly in `popup.html`. Load in `init()` with dynamic
   `import()` **after** paint:
   - `video-service.js` only when a YouTube URL must be parsed (or keep the two-regex
     fallback already in `popup.js`);
   - `storage-service.js` for settings/playlists (needed for the dropdown, not for the first
     click);
   - drop `youtube-api.js` and `youtube-auth.js` from the popup unless a code path truly
     needs them (verify `getPlaylists` contract first — it lives in `storage-service`).
     Target: ≤ 60 KB JS before first paint.
3. Keep `popup.css` linked normally (it is small); move the theme classifier above it.

### P4 — Click-ready before paint (fixes RC-7, RC-6)

1. Restructure `popup.js`: all `onclick` assignments move to top-level module scope and run
   before any `await`. `init()` becomes pure hydration (theme correction, settings, playlist
   dropdown, default scope) and no longer gates `setupUI()`.
2. Actions that need services `await ready` themselves and show a disabled/loading state on
   the button they came from; cap the wait (`waitForGlobal(..., 12)`) and fall back to the
   existing local regex/parse paths instead of blocking the UI.
3. Apply the theme before first paint: reuse `editor/theme-init.js` (or an inline 10-line
   script) reading `prefers-color-scheme` synchronously and mirroring the last choice in
   `localStorage`; `init()` corrects it once storage answers. Add
   `<meta name="color-scheme" content="light dark">` and set `color-scheme` from
   `[data-theme]`.
4. Ensure a single `document.documentElement.dataset.theme` write does not re-trigger layout
   (it will not, once `min-height: 100dvh` is only in page mode).

### P5 — Verification and handoff

1. `npm run check`, `npm run build`, `npm run test:extension`, `npm run audit:all` — all
   sequential, per the workflow traps in `.ai-sync/HANDOFF.md`.
2. New harness green; `verify-budgets.js` popup budget still passing (raise only with a
   written reason).
3. Manual matrix (real devices, not emulation): Chrome desktop popup cold-open ×10 —
   first click must always open at 400 × content with no resize jump; Firefox Android —
   popup/panel, keyboard, rotation, safe area; Chrome Android if the target browser is
   supported.
4. Evidence screenshots at 320/390/412/430 (light + dark) into `docs/assets/`.
5. Update `CHANGELOG.md` under Unreleased, `PROGRESS.md`, `HANDOFF.md`; no version bump,
   no release, no PR without owner authorization.

## Acceptance criteria

| #   | Criterion                                                                      | How it is measured                                         |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| A1  | Desktop popup = 400 px wide, height = content, no post-open resize             | popup-mode harness + manual ×10                            |
| A2  | No uncovered strip at 320–430 px; `html` background always themed              | harness (body width == viewport, `html` bg set)            |
| A3  | Every visible control ≥ 44 × 44 px                                             | harness                                                    |
| A4  | Inputs/selects ≥ 16 px on coarse pointers                                      | harness                                                    |
| A5  | Safe-area padding non-zero under emulated insets                               | harness with `viewport-fit=cover` + CDP safe-area override |
| A6  | No white flash in dark theme                                                   | filmstrip/manual on real device                            |
| A7  | Handler live ≤ 150 ms and paint ≤ 250 ms at 6× CPU throttle, cold cache        | harness timing assertions                                  |
| A8  | Quick add, save playlist, import-from-page, settings/playlists links unchanged | existing unit + `test:extension` suites                    |

## Decisions (resolved)

1. Desktop popup width: **420 px** (chosen; Chrome's `browser_action` default is ~400 px,
   and 420 reads as a popup while giving the controls room).
2. Firefox Android: **full-screen** — `html.ui-page` renders full width and `min-height:
100dvh`, with safe-area insets and a sticky Import footer.
3. Font Awesome: **replaced with an inline SVG sprite** (9 glyphs, FA 6.4.2 solid paths,
   CC BY 4.0) — no external CSS/font on the popup's critical path.

## Non-goals

- No redesign of the popup's information architecture, no new features.
- No changes to capture/menu/worker behavior, storage schema, or dependencies.
- Not a substitute for the pending real-device `RESPONSIVE_UI_PLAN.md` Phase 4 verification.

## Risks

- `extension.getViews` fallback: if a browser blocks it, the popup would render in page mode
  (full-width, 100dvh). Mitigation: `?mode` override, plus a width-based secondary guess
  (`innerWidth <= 800 && innerHeight <= 600` on first layout is not reliable) — prefer
  keeping the API check and adding a one-line log entry so a fallback is visible in Logs.
- Lazy-loading storage modules changes when the dropdown populates; add a loading/disables
  state so the first action cannot run against an empty target list.
- The icon-sprite change touches every icon; verify each `fa-*` usage in `popup/*.js`
  (`setIcon` calls) not only in HTML.
