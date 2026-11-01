# UI Design Consistency Guidelines

Rules for keeping the SPA editor visually consistent. Apply these on every new
view, component, and style change. All tokens live in
`apps/browser-extension/playlist-manager/src/css/design-tokens.css` — never
hardcode colors, sizes, or radii.

## 1. Scroll model (the most common source of bugs)

Every view is `<main class="view-scroll-container"><div class="view-body">…`.
The **window never scrolls** — `.view-body` is the scroller (`overflow-y: auto`).

- For anything scroll-aware (sticky headers, back-to-top, progress), find the
  real scroller with `getScrollParent(el)` from `src/utils/scroll-parent.ts` and
  read `scrollTop` / call `scrollTo` on it — NOT `window`.
- `position: sticky` works only inside `.view-body`. A sticky element sticks at
  `top: 0` _within `.view-body`_ (the fixed app header is already outside it), so
  never use `top: var(--app-header-height)` for an in-view sticky element.

## 2. Sticky sub-bars

Selection/toolbars (`list-header`, `playlist-btns`) live in `StickyHeader`'s
`subBar` and stick while the title scrolls away. They use:
`background: var(--color-bg-secondary)`, a top-only rounded corner
(`border-radius: 12px 12px 0 0`), and `border: 1px solid var(--border-color)`
with `border-bottom: none` so they visually attach to the list below.

## 3. Icons

- Center every icon with `display: inline-flex; align-items: center;
justify-content: center` inside a fixed-width wrapper (e.g. `.icon-box`,
  `.opt-icon`).
- Never pass a `class` to a third-party component (`<Fa class="x">`) expecting
  it to forward — wrap it in a native element that carries the class.
- The project assumes `box-sizing: border-box` (set on `*, *::before, *::after`
  in design-tokens.css). Do not remove it.

## 4. Colors & surfaces

- Use semantic tokens (`--color-bg-secondary`, `--color-border-primary`,
  `--color-text-primary`, `--color-brand-*`) — not raw hex.
- Secondary surfaces (toolbars, headers, inputs) use `--color-bg-secondary`; the
  page background is `--color-bg-primary` (`--background-color`).
- Keep dark mode working: any `[data-theme="dark"]` override must have a
  matching light default, and `color-scheme` must be set alongside `data-theme`.

## 5. Settings page layout

Settings cards use `.settings-grid` (CSS multi-column, `column-count: 2`,
`break-inside: avoid`). Order cards in the markup for the desired
column-major reading order; don't rely on the browser to rebalance.
