# Visual Regression Baseline Testing Procedure

This document explains how visual regression snapshots are maintained, verified, and rebaselined for the Independent YouTube Playlist Manager (IYPM) extension SPA.

---

## 🎯 Purpose & Scope

Visual regression tests guard core SPA views against subtle styling, padding, overflow, and layout regressions across:

- **Themes**: `light` and `dark`
- **Viewports**: `mobile` (390x844) and `desktop` (1440x900)
- **Routes**: Listed in `tests/visual/views-matrix.js` (Settings, Sync, Saved, Manage, History, etc.)

---

## 🛠️ How to Rebaseline Snapshots

When an intentional design change alters layout or component geometry (such as tokenizing margins, paddings, or font sizes), snapshots must be updated.

### Command

```bash
npm run test:visual -- --update-snapshots
```

### Critical Rules Before Updating

1. **Never rebaseline without naming what changed**: Document the exact CSS property or component change that caused the pixel shift (e.g., tokenizing `global.css` input padding to `--space-2`).
2. **Environment Parity**: Baselines are generated against Ubuntu/Linux with `DejaVu Sans` font pinning to ensure determinism across CI runners and local developer environments.
3. **Guard Verification**: Always run `npm run check` (or `node packages/build-tools/verify-visual-baselines.js`) afterwards to ensure every matrix route has a corresponding snapshot without orphaned files.
