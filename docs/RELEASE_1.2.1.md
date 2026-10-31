# Release 1.2.1

Patch release — fixes only, no new features, no breaking changes.

## What's Fixed

1. **Import from Page** works on any regular web page again. The popup no longer requires a detectable YouTube channel to scan a tab. Quantity `0` now means "all videos" (unlimited). Scrolling stops after three _consecutive_ stalled attempts. Failures are reported inline under the form instead of in an `alert()` that dismissed the popup.

2. **Mobile UX improvements** across the extension popup and SPA editor:
   - Touch targets now meet the 44px minimum on all interactive elements
   - `ConfirmationModal` migrated to the shared `Modal` component with focus restoration and Escape handling
   - Popup widths aligned to design tokens (`--popup-max-width: calc(100vw - 32px)`)
   - Sidebar drawer and header heights standardized via `--header-height-mobile`
   - Tablet (768px) horizontal overflow fixed by correcting media query overlap in `App.svelte`
   - Phase 4 real-device verification (screenshots, manual Firefox Android test) remains pending

3. **Documentation & infrastructure**:
   - Handover docs restructured (`.ai-sync/HANDOFF.md` shortened, history frozen in `.ai-sync/HISTORY.md`)
   - Git workflow formalized: `next` is integration branch, `main` holds releases only
   - CI/security workflows run on both `next` and `main`
   - Playwright version skew fixed — CI installs browsers for both trees
   - Dependabot now monitors all three npm trees (root, portal, extension)
   - Vercel deployment fixed (`rootDirectory` removed from `vercel.json`)

## Store Status

| Store            | Status                                          |
| ---------------- | ----------------------------------------------- |
| Chrome Web Store | Pending (v1.1.1 under review)                   |
| Firefox AMO      | Pending (v1.1.1 unlisted test, v1.2.0.1 listed) |
| Edge Add-ons     | Pending (v1.1.1 under review)                   |

## Verification

```bash
npm run check   # 195 tests, lint, format, typecheck, CSS bundle, budgets — all pass
npm run build   # Chrome, Firefox, Edge packages built successfully
```
