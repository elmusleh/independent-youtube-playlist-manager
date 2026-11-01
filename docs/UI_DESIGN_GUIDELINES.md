# UI Design Consistency Guidelines

Rules for keeping the SPA editor visually consistent. Apply these on every new
view, component, and style change. All tokens live in
`apps/browser-extension/playlist-manager/src/css/design-tokens.css` — never
hardcode colors, sizes, or radii.

## 1. Scroll model (the most common source of bugs)

The app uses the **window** as its scroller. `#app` is `min-height: 100vh` and
grows with content, so `<body>` scrolls. `.view-scroll-container` and `.view-body`
are plain flow containers — they must NOT set `overflow: hidden` or
`overflow-y: auto`, or they trap `position: sticky` and break it.

- Sticky elements stick relative to the window: use `top: var(--app-header-height)`
  (they pin just below the fixed header).
- Scroll-aware code reads `window.scrollY` and calls `window.scrollTo` — not an
  inner container.

## 2. Sticky sub-bars

Selection/toolbars (`list-header`, `playlist-btns`, `chip-bar`) live in
`StickyHeader`'s `subBar` and stick while the title scrolls away. They keep the
**same width as the content column** (no negative margin) and use a plain
`background: var(--color-bg-primary)` with a `border-bottom: 1px solid
var(--color-border-primary)` separator. Elevation (a shadow) is added only once
the bar is pinned (`.is-stuck`).

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
- Secondary surfaces (inputs, dropdowns, hover states) use `--color-bg-secondary`;
  the page background and selection toolbars are `--color-bg-primary`
  (`--background-color`).
- Keep dark mode working: any `[data-theme="dark"]` override must have a
  matching light default, and `color-scheme` must be set alongside `data-theme`.

## 5. Settings page layout

Settings cards use `.settings-grid` (CSS multi-column, `column-count: 2`,
`break-inside: avoid`). Order cards in the markup for the desired
column-major reading order; don't rely on the browser to rebalance.
