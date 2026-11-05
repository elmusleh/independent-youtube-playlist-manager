# Native context-menu verification — Chromium, 2026-11-01

Evidence for OpenSpec `complete-context-menu-acceptance` §3.2 (Chromium half). Captured
from the **real, native browser menu** — not from the menu model, not from handler tests.
These screenshots are the source for every claim below; do not read more into them than
they show.

## Artifact identity

|                                               |                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Commit                                        | `669049d` (`origin/next`, the merge of #64)                          |
| Build                                         | `npm run build` from that commit, `dist/chrome/` (Chrome MV3 target) |
| `dist/chrome/manifest.json` sha256 (first 16) | `1bff3eb345911cce`                                                   |
| Extension ID                                  | `dapjjdcnolpmfcnobilphjfpkmmokgid`                                   |
| Browser                                       | Google Chrome 156.0.8078.79                                          |
| Display                                       | disposable `Xvfb :99` (1400×1000×24), fresh temp profile per run     |

## Method

Native menus live in Chrome's Aura layer, so neither Playwright nor CDP can read them
(CDP input reaches the renderer only). The run therefore:

1. starts a headed Chrome with `--load-extension=dist/chrome` on a throwaway `Xvfb`
   display and a temp profile;
2. writes the settings variant into `chrome.storage.sync` from an extension page, then
   waits for reconciliation and reads back `chrome.storage.local["yph_context_menu_ids"]`;
3. serves a local fixture page over `http://127.0.0.1:8765/` and right-clicks a paragraph;
4. opens the submenu with arrow keys (`xdotool` on the disposable display only);
5. captures the X11 framebuffer with `ffmpeg -f x11grab`.

Nothing here touches the user's desktop session, profile or cursor.

## Results

| Variant          | Settings                          | Registered menu ids                                                                                                                              | Visible in the native submenu                                                                                                                                        |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| default          | `{}`                              | 22 ids incl. `yph:saved`, `yph:sep-saved`, `yph:sep-actions`, `yph:save-playlist`, `yph:import`, 5 destinations                                  | `My Playlists` · `Add YouTube tabs to New local playlist ›` · `Destination ›` · `Import YouTube links from this page…` · `Settings` — `default-submenu.png`          |
| saved disabled   | `{"disableContextSaved": true}`   | 13 ids; **no** `yph:saved`, `yph:sep-saved`, `yph:sep-actions`, `yph:save-playlist`, `yph:import`; destinations = `yph:destination:builder` only | `Destination ›` · `Settings` · `Add YouTube tabs to Playlist Builder ›` — no saved entries at all — `saved-disabled-submenu.png`                                     |
| builder disabled | `{"disableContextBuilder": true}` | saved ids retained; **no** `yph:destination:builder`                                                                                             | `My Playlists` · `Add YouTube tabs to New local playlist ›` · `Destination ›` · `Import YouTube links from this page…` · `Settings` — `builder-disabled-submenu.png` |
| menu disabled    | `{"disableContextMenu": true}`    | `[]`                                                                                                                                             | no Playlist Manager entry in the top-level menu — `menu-disabled.png`                                                                                                |

This is direct evidence for the three defects PR #64 fixed:

- **`disableContextSaved` was ignored** → with it set, `My Playlists`, the import entry and
  every saved destination are gone from the native menu (not greyed).
- **Disabled families are absent, not disabled** → the label switches to
  `Playlist Builder` when the saved family is off, so it always names a reachable target.
- **Full teardown** → `disableContextMenu` leaves no orphan entry and the persisted id set
  is emptied.

Context filtering that is visible in the same captures and is expected, not a defect:
`Add this YouTube link to …` does not appear for a **page** context, and
`Save this YouTube playlist…` does not appear off `youtube.com` (its
`documentUrlPatterns` is `*://*.youtube.com/*`).

## Not covered here — do not infer these

- **Link context** (`Add this YouTube link to …` presence and that it captures the clicked
  link rather than the open video): covered by unit tests and a mutation
  (`link context isolation`, CAUGHT), **not** by a native capture in this run.
- **Scopes submenu** contents and every scope action executing correctly.
- **Action execution end-to-end** (choosing an item and seeing the capture land), the
  `activeTab` import flow, and the "three unique IDs" case from §3.2.
- **Firefox** (§3.3) — nothing here implies anything about Gecko.
- Concurrency / worker restart / tab-closing cases (§3.4).

Because of those gaps, OpenSpec 3.2/3.3/3.4 remain **unchecked**; this file only records
what the screenshots prove.

## Reproduce

```bash
Xvfb :99 -screen 0 1400x1000x24 &
cd <worktree-at-669049d> && npm run build
ACC_SETTINGS='{"disableContextSaved":true}' ACC_LABEL=savedOff ACC_SEQ='Down*8,Right' \
  node .hermes-scratch/native-menu-probe.js     # probe kept outside the repo
```

Arrow-key counts are menu-position dependent: the fixture page puts the branded entry
ninth in a page-context menu.
