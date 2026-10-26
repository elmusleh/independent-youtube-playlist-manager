# Modal/Dialog Refactoring Audit & Plan

## Current State Analysis

### Modal Components Found:

1. **Modal.svelte** - Base modal component (uses native `<dialog>`)
2. **ManageModals.svelte** - Merge, Save Offline, Progress, Export dialogs
3. **PlaylistModals.svelte** - Export, Import, Copy/Move, Info, Scrape HTML
4. **PlaybackSettings.svelte** - Info modal (inline)
5. **Manage.svelte** - Inline dialogs: Progress, Merge, Save Offline
6. **RangeSelectModal.svelte** - Range selection
7. **MultiSortModal.svelte** - Multi-sort dialog
8. **PlaylistPreview.svelte** - Overlay (not a true modal)

### Inconsistencies Identified:

| Aspect                | Modal.svelte                         | ManageModals            | PlaylistModals          | PlaybackSettings               | Manage.svelte (inline)  |
| --------------------- | ------------------------------------ | ----------------------- | ----------------------- | ------------------------------ | ----------------------- |
| **Header**            | Separate `.modal-chrome` with only ✕ | `<h3>` in body          | `<h3>` in body          | `.modal-header` with title + ✕ | `<h2>` in body          |
| **Close Button**      | In `.modal-chrome` (top-right)       | Via Modal component     | Via Modal component     | In `.modal-header` (top-right) | None (click overlay)    |
| **Title Position**    | Via `aria-label` only                | `<h3>` left             | `<h3>` center           | In `.modal-header` left        | `<h2>` left             |
| **Body**              | `.modal-body` slot                   | `.dialog` with content  | `.modal-container`      | `.modal-body-content`          | `.dialog` with content  |
| **Footer**            | Sticky via global CSS                | `.dialog-actions`       | `.modal-footer`         | `.modal-footer`                | `.dialog-actions`       |
| **Button Order**      | N/A (slot-based)                     | Secondary → Primary (✓) | Secondary → Primary (✓) | Primary only / Single          | Secondary → Primary (✓) |
| **Destructive Style** | N/A                                  | None                    | None                    | None                           | None                    |

### Key Issues:

1. **No consistent header structure** - title + close button on same row
2. **No destructive button styling** for delete/remove actions
3. **Generic button labels** ("Cancel", "Close", "OK", "Confirm")
4. **Missing item title bolding** in confirmation messages
5. **Inconsistent button hierarchy** - mostly correct (primary right) but not enforced
6. **No shared header/footer components** - each modal reimplements

---

## Refactoring Plan

### Phase 1: Core Modal Infrastructure

1. **Update Modal.svelte** - Add header slot with title + close button, enforce Header→Body→Footer structure
2. **Create DialogHeader.svelte** - Reusable header with title + close button
3. **Create DialogFooter.svelte** - Reusable footer with proper button hierarchy
4. **Add destructive button variant** to SimpleButton

### Phase 2: Standardize Button Copy

| Current          | New (Specific)                                     |
| ---------------- | -------------------------------------------------- |
| "Cancel"         | "Keep Editing", "Don't Delete", "Go Back"          |
| "Close"          | "Done", "Got It"                                   |
| "OK" / "Confirm" | "Delete", "Remove", "Discard & Leave", "Merge Now" |
| "Save Selected"  | "Save Offline"                                     |

### Phase 3: Apply to All Modals

1. **ManageModals.svelte** - Merge, Save Offline, Progress, Export
2. **PlaylistModals.svelte** - Export, Import, Copy/Move, PlayAllInfo, ScrapeHtml
3. **PlaybackSettings.svelte** - PlayAllInfo modal
4. **Manage.svelte** - Inline Progress, Merge, Save Offline dialogs
5. **RangeSelectModal.svelte**
6. **MultiSortModal.svelte**

### Phase 4: Add Dynamic Item Title Bolding

- Update confirmation messages to bold item titles: `Are you sure you want to remove "<strong>{title}</strong>"?`

---

## Implementation Order:

1. Modal.svelte (core)
2. SimpleButton.svelte (add destructive variant)
3. DialogHeader.svelte / DialogFooter.svelte (new components)
4. ManageModals.svelte
5. PlaylistModals.svelte
6. PlaybackSettings.svelte
7. Manage.svelte (inline dialogs)
8. RangeSelectModal.svelte
9. MultiSortModal.svelte
