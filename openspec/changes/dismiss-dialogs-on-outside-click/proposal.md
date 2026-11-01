# Proposal

## Why

Every modal dialog is rendered through one `Modal.svelte` component, but clicking the
backdrop (outside the dialog) only dismisses it when the size is `drawer`. For the
common `small`/`standard`/`wide` sizes the user must press the `X` or `Cancel`, which is
unexpected and inconsistent across the app. Users expect a click-away to discard a
dialog on every screen size and device.

## What Changes

- Allow a click/tap on the dialog backdrop to dismiss any **dismissible** modal,
  regardless of size, by removing the `size === "drawer"` gate in `Modal.svelte`.
- Keep the existing `dismissible` guard so loading/progress dialogs still cannot be
  dismissed by accident.
- Ensure backdrop dismissal routes through the cancel/close path (`onclose`), never
  confirm.
- Avoid accidental dismissal when a press begins inside the dialog and ends on the
  backdrop (e.g. selecting text then dragging out).

No new dependencies, no manifest/permission changes, no release authorization.

## Capabilities

### New Capabilities

- `modal-dismissal`: dismissible dialogs close on outside (backdrop) click across all
  sizes and pointer types, while non-dismissible dialogs remain unaffected.

### Modified Capabilities

None — `openspec/specs/` holds no existing modal specification.

## Impact

- `apps/browser-extension/playlist-manager/src/components/Modal.svelte` only; this is
  the single dialog component, so the fix covers every modal in the SPA (small/standard/
  wide/drawer). The popup and web portal have no `<dialog>` of their own.
- Behavior change is additive and user-visible (click-away now dismisses); no storage,
  data or API impact.
