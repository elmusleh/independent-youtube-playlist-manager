# Visual Regression Matrix: Playlist Route Integration Plan

This plan details how the `/playlist` (Playlist Editor) route will be added to the visual snapshot matrix in `tests/visual/views-matrix.js`.

---

## 🎯 Motivation

`PlaylistEditor.svelte` (1,930 lines) and its sub-components (`EditorToolbar.svelte`, `PlaylistVideo.svelte`, `MultiSortModal.svelte`) represent the most complex UI surface in the extension:

- Drag-and-drop handles
- Sticky sub-headers (`.sticky-header-sub`, `.is-stuck`)
- Action button groups (`.btn-group`, `.right-align`, sort dropdowns)
- Batch selection floating bar

Currently, `tests/visual/views-matrix.js` snapshots `settings`, `sync`, `saved`, `manage`, and `history`. The `/playlist` editor route has no visual snapshot guards, making it susceptible to undetected layout drift.

---

## 📋 Required Route Entry

In `tests/visual/views-matrix.js`:

```js
{
  id: "playlist",
  hash: "/playlist?id=local-release",
  ready: ".playlist-btns",
  shot: ".view-body"
}
```

### Deterministic Seed Data

`tests/visual/views.spec.ts` already seeds `local-release` via `createDeterministicFixture()`:

- 105 mock video items
- Fixed timestamp `FIXED_NOW = 1700000000000`
- Deterministic thumbnail placeholders

### Execution Command

Once the route entry is added, run:

```bash
npm run test:visual -- --update-snapshots
```

This will generate 4 new snapshot baselines:

- `playlist-light-mobile-chromium-linux.png`
- `playlist-light-desktop-chromium-linux.png`
- `playlist-dark-mobile-chromium-linux.png`
- `playlist-dark-desktop-chromium-linux.png`

Verified by `node packages/build-tools/verify-visual-baselines.js` (expected: 24 baselines).
