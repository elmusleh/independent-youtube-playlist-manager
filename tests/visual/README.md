# Visual regression tests

Pixel baselines for the extension SPA's primary views, run with Playwright's
`toHaveScreenshot()`. They exist because the structural E2E (`npm run test:extension`)
only asserts _no horizontal overflow_ — it cannot catch a card-grid that reorders into
column-major order, loses column balance, or drifts in spacing.

## What is covered

Four views × two widths × two themes:

| View     | Route        | Screenshot target    |
| -------- | ------------ | -------------------- |
| Settings | `#/settings` | `.settings-grid`     |
| Saved    | `#/saved`    | `.playlist-grid`     |
| Manage   | `#/manage`   | `.list-container`    |
| History  | `#/history`  | `.history-container` |

Widths: `mobile` (390×844) and `desktop` (1440×900). Themes: `light` and `dark`.

## Running

The extension must be built first (the fixture loads `dist/chrome`):

```bash
npm run build          # produces dist/chrome
npm run test:visual    # compare against committed baselines
```

## Regenerating baselines

Baselines are only ever regenerated for an **intentional** visual change. Before you run
the update, you must be able to name exactly what moved the pixels (a spacing rule, a
touch-target height, copy, a font change). If you cannot name it, you are about to
ratify a regression.

```bash
npm run test:visual -- --update-snapshots
```

Then verify it is stable across three consecutive comparison runs (an `--update-snapshots`
run always passes because it rewrites the file — it proves nothing on its own):

```bash
npm run test:visual && npm run test:visual && npm run test:visual
```

The baselines are committed under `tests/visual/views.spec.ts-snapshots/`.

## Determinism pins

The suite pins every input that would otherwise vary between runs or hosts:

- **Font** — `body *` is forced to **DejaVu Sans**. The app's own stack
  (`-apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, …`) resolves to _different_
  faces on a desktop vs the CI runner (Ubuntu/Cantarell present or not). DejaVu Sans is
  the Ubuntu default and is present on both. Icons are inline SVG (`svelte-fa`), so they
  are unaffected. DejaVu Sans ships in the `fonts-dejavu-core` package — the CI job is
  pinned to `ubuntu-24.04` so that font dependency cannot drift on a runner-image update.
- **Theme** — the browser `colorScheme` is set and a fresh profile means `data-theme`
  follows it (light/dark).
- **Locale & timezone** — pinned to `en-US` / `UTC` so date labels are stable.
- **Timestamps** — the fixture seeds a fixed epoch, so "Today"/"11/14/2023"-style labels
  and date grouping cannot drift with the wall clock.
- **Motion** — `prefers-reduced-motion: reduce` is emulated (transitions/animations off).
- **Images** — external requests are stubbed to a grey SVG.

## Non-Linux contributors

Baselines are captured with DejaVu Sans and are therefore **Linux-specific**. On macOS or
Windows the default `sans-serif` metrics differ enough that a freshly-cloned repo will show
"pixels are different" failures that are _not_ regressions. In that case regenerate the
baselines locally (above) and keep them out of the commit, or run the suite in the Linux CI
environment. CI (GitHub Actions, the `test-web` job pinned to `ubuntu-24.04`) is the source
of truth — the pin keeps `fonts-dejavu-core` present and stable across runs.
