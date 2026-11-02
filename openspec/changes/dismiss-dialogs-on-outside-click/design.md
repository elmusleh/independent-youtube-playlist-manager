# Design

## Context

`Modal.svelte` is the single `<dialog>` component in the SPA and uses the native
`showModal()` API. When a native modal dialog is shown, a click on its `::backdrop`
dispatches a `click` event whose target is the `<dialog>` element itself (the backdrop
is not a real element). The component already routes backdrop clicks to `close()` for
`size === "drawer"` only; all other sizes ignore them. `close()` already guards
`dismissible` and fires `onclose`, so confirmation dialogs correctly cancel on close.

## Goals / Non-Goals

**Goals:**

- Dismiss any dismissible dialog on a backdrop click/tap, for every size and pointer
  type.
- Preserve the `dismissible` guard and the cancel/close routing unchanged.
- Prevent accidental dismissal from a press that begins inside and ends on the backdrop.

**Non-Goals:**

- No change to the drawer's existing dismissal, Escape handling, focus containment or
  scroll locking.
- No new dialog variants, dependencies or API changes.

## Decisions

### D1 — Remove the size gate, dismiss any dismissible dialog

Change the `onclick` handler to treat a backdrop click as dismissal for all sizes.
`close()` is the single dismissal path, so the `dismissible` guard and `onclose` routing
stay intact.

- **Alternative:** keep per-size opt-in — rejected: inconsistent UX, and every size
  already funnels through the same component.

### D2 — Detect the backdrop via `event.target === dialog`

Native `<dialog>` delivers backdrop clicks on the dialog element, so
`event.target === dialog` is the correct, dependency-free detection and already powers
the drawer.

### D3 — Only dismiss when the interaction both starts and ends on the backdrop

Record whether `pointerdown` targeted the backdrop, and dismiss on `click` only when
both the press and the release were on the backdrop. This prevents a text-selection
drag that starts inside and ends outside from dismissing the dialog. `pointerdown`
covers mouse and touch uniformly.

- **Alternative:** bare `event.target === dialog` on click only — simpler, but
  mis-dismisses on drag-select; rejected.

## SOLID note

No new modules are introduced: dismissal semantics stay within `Modal.svelte`'s single
responsibility (the modal's open/close lifecycle), so the existing structure is
unaffected. The component remains the one seam every modal already shares.

## Risks / Trade-offs

- **Accidental dismissal** → mitigated by D3 (press must begin on the backdrop).
- **Touch specifics** → `pointerdown`/`click` sequence is consistent across mouse and
  touch; verified in the device matrix.
- **Non-dismissible dialogs (loading/progress)** → unaffected because `close()` returns
  early when `dismissible` is false.
