# Native context-menu verification gate

`npm run test:native-menu` proves, against the **real native browser menu**, that the
context-menu entries and their labels follow the user's settings. It replaces the
hand-run screenshot session in
[NATIVE_MENU_CHROMIUM_2026-11-01.md](NATIVE_MENU_CHROMIUM_2026-11-01.md) (Chromium captures for
four settings variants) as the repeatable source of truth.

## Why it cannot live in `npm run check`

Native context menus are drawn by **Chrome itself**, not by the page. Playwright and CDP
can neither read them nor drive them, and a headless browser has no such menu at all. The
gate therefore needs an X server, a headed browser, OS-level input and OCR — minutes of
wall time and a browser-version dependency. It runs on a schedule and on demand, never as a
required per-PR check.

## What it asserts

Two independent layers, both deterministic:

| Layer        | Source of truth                                                                                                                                   | Catches                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Registration | `menuModel(settings)` imported from source, compared with the ids the extension actually created (`chrome.storage.local["yph_context_menu_ids"]`) | wrong gating, orphaned entries, ids that survive a settings change                                                           |
| Pixels       | OCR of the actual menu panel, captured from the X framebuffer                                                                                     | a label that names the wrong destination, an entry that is registered but not rendered, a disabled family that leaks back in |

The pixel layer is self-calibrating: each capture is OCR'd once to _locate_ the panel from
the words it contains (menus are dark, so that pass runs on an inverted frame), then
re-OCR'd as a tight, inverted crop. No screen coordinates are hard-coded, so a Chrome
update that moves the menu cannot silently break the assertion.

## Variants

| Variant        | Settings                            | Expectation                                                                                                                                           |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`      | none                                | 22 entries; `My Playlists`, `Destination`, `Import YouTube links`, `Add YouTube tabs to` visible, `Playlist Builder` absent, all 7 scope rows present |
| `saved-off`    | `disableContextSaved`               | 13 entries; saved family gone entirely, label switches to `Playlist Builder`                                                                          |
| `builder-off`  | `disableContextBuilder`             | builder destination gone, saved family intact                                                                                                         |
| `menu-off`     | `disableContextMenu`                | no entries at all, and no `Playlist Manager` row in the native menu                                                                                   |
| `link-context` | none, right-click a `watch?v=` link | `Add this YouTube link to …` is offered                                                                                                               |

Every variant writes an **explicit base** (`disableContextMenu/Saved/Builder: false`) before
its own settings: `chrome.storage.sync.set({})` is a no-op, so an omitted key would leak
from the previous variant and produce a false pass.

## Usage

```bash
npm run build              # the gate refuses to run on a stale dist/
npm run test:native-menu   # verify; screenshots -> dist/verification/native-menu/
npm run test:native-menu -- --record   # also refresh docs/testing/native-menu-chromium-<date>/
```

| Environment                  | Effect                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| `IYPM_NATIVE_DISPLAY=:99`    | reuse an existing display instead of starting `Xvfb`       |
| `IYPM_REQUIRE_NATIVE_MENU=1` | a missing display fails instead of skipping (CI sets this) |
| `XVFB_BIN=/path/to/Xvfb`     | override the X server binary                               |

Requirements: `Xvfb`, `xdotool`, `ffmpeg`, `tesseract`, and a built `dist/chrome`. Without
them the gate prints `SKIP:` and exits 0 unless `IYPM_REQUIRE_NATIVE_MENU=1`.

## Proven to fail

A verification gate that cannot fail is decoration. Both layers were mutation-tested:

| Mutation                                                                | Result                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| drop the `savedAllowed` guard in `context-menu-model.js`                | `FAIL saved-off: registered ids differ - missing [yph:saved]`                                          |
| rename the scope label to `Add tabs to …` (ids unchanged), then rebuild | `FAIL default: menu is missing "Add YouTube tabs to"` — OCR shows `Add tabs to`                        |
| make the tree newer than `dist/`                                        | `FAIL: … is newer than dist/chrome - run \`npm run build\` first.`                                     |
| rename the `current` scope label, rebuild                               | `FAIL default: scope submenu is missing "Only this video tab"`                                         |
| never open the menu (harness right-click removed)                       | `FAIL menu-off: native menu was not recognised on screen` + `only 0 standard browser entry recognised` |

The last two exist because an earlier revision of this gate could pass in both cases: it
matched probes against single OCR _words_ (so the scope panel was never located and the
full-screen text was asserted instead), and its `menu-off` check only looked for an absent
label, which an unopened menu satisfies. Both are fixed structurally, not by loosening
the assertions: rows are rebuilt from OCR words split at column gutters, a crop must be
located before anything is asserted about it, and "must not appear" additionally requires
two recognised standard browser entries.

## Limits — do not over-read a pass

- **Chromium only.** Nothing here says anything about Firefox (OpenSpec 3.3); Gecko is a
  separate problem (unsigned MV3 loading in a disposable profile).
- **Menu inventory, not behaviour.** The gate asserts what is offered, not that choosing
  `Add this YouTube link to …` performs the capture, nor the `activeTab` import flow
  (OpenSpec 3.2's second half).
- **This fixture page only.** Concurrency, worker-restart and tab-closing cases
  (OpenSpec 3.4) are covered by unit tests and the extension suite, not by these pixels.
- **OCR is probabilistic.** Assertions use short substrings and a positional fallback for
  the branded row (its icon defeats OCR); a failure message always prints the OCR text.
