# Sync Page Design Alignment Plan

## Problem analysis

1. **CSS cascade leak.** `sync.css` is imported globally (`main.ts`, line 25) _after_ `settings.css` (line 24). Its unscoped rules (`.settings-grid { display: grid; ... }` and `.sync-page { max-width: 800px; ... }`) apply to **every** view, including Settings. As a result the Settings page has been rendered with Sync's grid override instead of its own masonry (`column-count`) layout — this is the "Settings got changed" the user noticed.

2. **Width mismatch.** `.sync-page { max-width: 800px; margin: 0 auto; }` centers/narrows the Sync content, while Settings uses `.view-body` padding (`0 24px 24px 24px`) and fills the available width (edge-to-edge minus 24px gutters). That is the "narrow vs edge-to-edge" difference.

3. **Card structure.** Sync already uses `.card` (from `settings.css`) on most sections, but `SyncHero` (status banner) and `SyncCounters` sit _above_ the grid as full-width blocks, and the grid itself is a CSS grid rather than the masonry column layout Settings uses. The visual rhythm therefore differs.

## Goals

- Settings page must look exactly as it did before any Sync CSS was introduced (restore its native `settings.css` masonry layout, no global override).
- Sync page must use the same width, grid, and card styling as Settings.
- Sync page cards/sections should mirror the Settings card structure (heading with icon, `.sub-text`, `.card` padding 32px / radius 16px / shadow / hover).
- No leakage of Sync-only styles into other views.

## Proposed changes (NOT yet implemented)

### A. Scope sync.css to `.sync-page` only

Remove the global `.settings-grid` override from `sync.css`. Move Sync-specific grid rules under a `.sync-page .settings-grid` (or `.sync-page-grid`) selector so they never affect Settings.

Concretely, in `apps/browser-extension/playlist-manager/src/css/sync.css`:

- Delete the unscoped:
  ```
  .settings-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 720px) { .settings-grid { grid-template-columns: repeat(2,1fr); } }
  ```
- Replace with a scoped variant, e.g. `.sync-page .settings-grid { ... }` (or introduce `.sync-grid` and update `Sync.svelte`).

### B. Match Sync width to Settings

- Remove `.sync-page { max-width: 800px; margin: 0 auto; padding: 1rem; }`.
- Let `.sync-page` inherit `.view-body` padding (`0 24px 24px 24px`) so it is edge-to-edge like Settings.
- Keep `SyncHero` (status banner) as a full-width block above the grid, but give it the same `.card` chrome (border, radius 16px, padding, shadow, hover) instead of its bespoke `.sync-status-banner` gradient, OR keep the gradient but constrain it to the same width.

### C. Align card structure

- Ensure every Sync section uses `<section class="card">` with the same heading pattern as Settings cards (`<h3>` with FontAwesome icon, `.sub-text` description).
- `SyncHero` → convert to a `.card` with an inner status row (icon + text + progress + button), so it reads as a card, not a banner.
- `SyncCounters` → fold into `SyncHero` or make it a compact `.card`.
- `SyncActivity` → ensure it uses `.card` and its log scrolls within the card (max-height) like Settings modals.

### D. Mobile responsiveness

- Verify at 390px width: cards stack to 1 column, padding reduces to 16px (via the existing `@media (max-width: 768px)` in `view-layout.css`).
- Confirm no horizontal overflow from `.key-value` (monospace, long keys) — already has `word-break: break-all`.
- Add a visual baseline entry for `sync` in `tests/visual/views-matrix.js` (currently only settings/saved/manage/history are snapshotted) so future regressions are caught.

### E. Verification

- Run `npm run check`, `npm run build`, `npm run test:extension`.
- Update visual baselines (`npm run test:visual -- --update-snapshots`) if the layout changes.
- Confirm Settings page visual baseline still matches (or update it intentionally with a documented reason).

## Files to touch (when implementing)

- `apps/browser-extension/playlist-manager/src/css/sync.css` (scope + width)
- `apps/browser-extension/playlist-manager/src/views/Sync.svelte` (remove sync-page wrapper constraints, reuse .view-body)
- `apps/browser-extension/playlist-manager/src/components/sync/SyncHero.svelte` (card chrome)
- `tests/visual/views-matrix.js` (add sync route)

## Out of scope (not changing)

- Sync engine / adapters / protocol (already complete).
- Settings page content (only CSS cascade is fixed so it uses its own stylesheet).

## Recommendation

Implement A + B first (pure CSS, lowest risk, fixes the "Settings got changed" leak and the width mismatch), then C (card chrome) in a follow-up, then D (visual baselines). Each as a separate commit.
