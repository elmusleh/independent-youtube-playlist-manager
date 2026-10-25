# Mobile and desktop layout improvement plan

Status: proposed implementation plan. This change documents the work; it does not
change application behavior. Scope includes the toolbar popup, every active
extension route, in-app dialogs, and the current web portal landing page.

## Findings and priorities

These findings come from source inspection. Runtime page behavior still needs a
route-by-route baseline; browser resizing does not replace real mobile testing.

| Priority | Evidence                                                                                                                                                      | Proposed fix                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | `popup/popup.css` fixes the body at 360px and hides horizontal overflow. Several controls are 36px tall.                                                      | Preserve a compact desktop popup while fitting the available mobile width; reflow controls and use touch-sized targets.              |
| P0       | `Modal.svelte` uses 90% width, 32px padding, no height cap, and overlay z-index 1. Main header uses 1000.                                                     | Introduce a shared adaptive dialog with bounded width/height, controlled scrolling, and correct overlay stacking.                    |
| P0       | Shared Modal has no accessible title contract, focus containment, focus restoration, or background inertness. ConfirmationModal has its own separate overlay. | Standardize dialog semantics and behavior, preserving safe initial focus for destructive actions.                                    |
| P1       | Mobile Header is 52px tall; App reserves 56px. Sidebar uses 100vh.                                                                                            | Centralize shell dimensions, use dynamic viewport sizing with fallback, and account for safe areas.                                  |
| P1       | Dialog import/export textareas have a 350px minimum height; editor menus use a 260px minimum width.                                                           | Use available-height constraints and menus bounded by their container/viewport.                                                      |
| P1       | Settings cards have 32px padding; Manage uses 280px minimum search/grid widths.                                                                               | Reduce narrow-screen padding and allow children to shrink inside their content area.                                                 |
| P1       | Several row actions are 24–32px; shared desktop row actions depend on hover.                                                                                  | Provide 44px interactive hit areas on touch and visible keyboard/touch access to secondary actions.                                  |
| P1       | Portal root uses fixed dynamic-viewport height with overflow hidden.                                                                                          | Check short screens, landscape, zoom, and footer reachability; allow normal vertical overflow when content exceeds available height. |

## Responsive rules

- Start at 320px width. Review at 360, 390, 430, 768, 1024, 1280, and 1440px.
  Treat these as test sizes; change layout where content requires it.
- Phones: one content column, compact header, drawer navigation, wrapping controls.
  Keep primary actions visible; place secondary actions in an accessible menu.
- Tablets/narrow windows: choose drawer or sidebar according to remaining content
  width. Do not force a desktop sidebar at a breakpoint that squeezes the editor.
- Desktop: persistent sidebar when it fits, contextual multi-column content,
  bounded reading/form widths, and enough space for playlist editing.
- Share spacing, header-height, overlay-layer, control-size, and content-width
  tokens. Use logical properties and `min-width: 0` where flex/grid items shrink.
- Target 44px touch hit areas without unnecessarily enlarging icons. Keep form
  text readable; use 16px input text on phones. Preserve keyboard focus styles,
  light/dark themes, reduced motion, and useful labels.
- Use dynamic viewport height with a fallback and safe-area padding. Test the
  software keyboard explicitly; dynamic viewport units alone are not sufficient.
- Fix overflow at its source. Do not hide clipped actions with global overflow-x.

## Phase 1 — Popup and shared dialogs

1. Toolbar popup: use a preferred desktop width around 360–400px, constrained by
   the host's available viewport. Reflow header/actions on narrow screens; keep
   playlist names and labels usable. Validate actual extension popup sizing,
   because a regular tab does not reproduce browser-controlled popup dimensions.
2. Keep quick add, target selection, create playlist, channel options, progress,
   authentication, and the full-manager entry point reachable in short windows.
   Use one primary vertical scroll area; avoid nested scrolling for ordinary forms.
3. Shared dialog sizes: small confirmations around 400px, standard forms around
   560px, and content-heavy dialogs around 800px, all constrained to available width.
4. Phones: retain compact confirmation dialogs; use a near-full-screen layout for
   long import/export, copy/move, and sorting forms. Start with 12–16px outer space
   and 16px inner padding where possible. Use full available height for very short
   screens when required, rather than squeezing content into a centered box.
5. Separate dialog header, scrolling body, and action footer. Bound height to the
   visible area, allow long text to wrap, and keep close/cancel/save reachable when
   the keyboard opens. Make backdrop dismissal explicit for forms with work to lose.
6. Prefer native `dialog.showModal()` if compatibility and existing bindings allow
   it. Otherwise provide equivalent focus containment and inert background behavior.
   Add title association, initial focus, Escape handling, focus restoration, and
   safe cancellation. Only the topmost overlay should handle dismissal.
7. Migrate Modal, ConfirmationModal, LoadingModal, RangeSelectModal,
   ReleaseNotesModal, editor PlaylistModals/MultiSortModal, ManageModals, and
   settings dialogs to consistent sizing and behavior. Preserve existing callbacks,
   cancellation rules, loading state, and data validation.

## Phase 2 — Shell and shared components

1. Align App, Header, Sidebar, StickyHeader, and ViewHeader dimensions. Choose a
   clear page scrolling model so nested overflow does not break sticky content.
2. Make mobile navigation keyboard accessible, close on route selection, restore
   focus, and handle portrait/landscape resizing without leaving an invisible overlay.
3. Reflow shared toolbars, search/filter bars, action bars, dropdowns, and counters.
   Avoid multi-row sticky controls consuming most of a landscape screen.
4. Update PlaylistVideo, ListRow, cards/grids, selectors, buttons, and menus. Keep
   title/channel readable, selection available, and actions reachable without hover.
5. Position toasts and undo notifications inside safe areas without obscuring
   navigation, dialogs, or form actions. Preserve compact pagination behavior.

## Phase 3 — Active page coverage

| Pages / routes                                                                 | Required review and adaptation                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved (`/saved`, default route)                                                | Cards/list grid, search and filter wrapping, long names, empty state, card menus.                                                                                                                           |
| Playlist (`/playlist`, legacy `/editor`), Favorite (`/favorite`), New (`/new`) | Shared editor header, title editing, toolbars, selection, video rows, page-size control, pagination, import/export/copy/move/sort dialogs. Provide touch-usable reorder controls wherever drag is required. |
| Manage (`/manage`)                                                             | Search minimum width, grid/list sizing, bulk actions, merge/split/reorder forms, import/export and destructive confirmations.                                                                               |
| History (`/history`)                                                           | Thumbnail/text balance, delete targets, toolbar wrapping, search results and compact pagination.                                                                                                            |
| Search (`/search`), Subscriptions (`/subscriptions`)                           | Search/forms, channel/video results, long metadata, loading/error/empty states, available actions.                                                                                                          |
| Settings (`/settings`)                                                         | Every rendered settings section, single-column mobile cards, consistent labels, inputs and toggles; backup/restore, integration/auth, metadata, storage, playback and editor options.                       |
| Share (`/share`), Open by ID (`/open-by-id`)                                   | Full-width mobile inputs, wrapping URLs, selection controls, primary actions and validation.                                                                                                                |
| Shortcuts (`/shortcuts`), Developer setup (`/api-setup`)                       | Readable instructions and key combinations, wrapping code/URLs, responsive forms and setup columns.                                                                                                         |
| Logs (`/logs`)                                                                 | Toolbar wrapping and readable log entries; confine necessary horizontal scrolling to code/log blocks.                                                                                                       |
| Web portal (`/`, not-found)                                                    | Hero, install buttons, footer links, short-height/landscape behavior, text zoom and both themes where supported. Review only components actually rendered by these routes.                                  |

Use the route map as the inventory. `Saved-refactored.svelte` is not the active
Saved route; do not redesign inactive alternatives or invent dashboard pages.
API endpoints are outside visual layout scope.

## Phase 4 — Verification and completion criteria

- Capture before/after screenshots for every active page and each distinct dialog
  family at phone, tablet, and desktop widths. Include empty, populated, loading,
  error, long-title/URL, large-playlist and bulk-selection states where applicable.
- Assert no horizontal document overflow at test widths. Long code/log content
  may scroll inside a clearly bounded region; ordinary forms must reflow.
- Test 320×568, 390×844, 844×390, 768×1024, 1024×768, and 1440×900. Also test
  200% zoom and desktop reflow equivalent to a 320px CSS viewport.
- Browser automation: dialog open/close, Tab/Shift+Tab containment, Escape,
  focus restoration, drawer behavior, menu bounds, scrolling, and action reachability.
- Manually test Firefox Android on a real device: browser toolbar expansion,
  software keyboard, orientation changes, scrolling dialogs, and popup behavior.
  Validate desktop extension behavior in Chrome and Firefox. Check portal behavior
  on mobile Chrome/Firefox and Safari where available; portal testing does not imply
  extension support on browsers/platforms the project does not target.
- No hidden primary actions, clipped form fields, accidental background interaction,
  or overlapping header/dialog layers. Destructive dialogs initially focus Cancel.
- Run `npm run check` and `npm run build` for extension work. For portal changes,
  run its independent TypeScript check, production build, and relevant Playwright
  scenarios. Resolve the existing portal lint configuration issue before treating
  its build exit code as evidence of a clean validation run.
- Keep implementation in small reviewable phases. Add tests for interaction and
  layout regressions, not static CSS implementation details. No storage schema,
  authentication, synchronization, or unrelated feature redesigns.

## Recommended implementation order

Popup and dialog foundation → shell/navigation → shared rows/toolbars/cards →
editor/manage/settings → remaining active routes → portal → full regression pass.
Update PROGRESS and HANDOFF after each phase with exact changed files and results.

## References

- [WAI modal dialog interaction and accessibility pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WAI native dialog technique](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)
- [MDN safe-area environment variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Environment_variables/Using)
