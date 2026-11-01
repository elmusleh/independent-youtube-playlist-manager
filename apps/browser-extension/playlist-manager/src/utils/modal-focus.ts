/**
 * Keyboard focus containment for `<dialog>` based modals.
 *
 * Native `<dialog>` traps focus for Tab in most browsers, but not for controls that are
 * hidden with `display: none` (they stay in the tab order of the dialog's subtree in
 * Firefox) and not when the dialog has no focusable content at all. Wrapping explicitly
 * keeps behaviour identical across Chrome and Firefox, and moving it here makes the rule
 * unit-testable without a browser.
 */

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  'input:not(:disabled):not([type="hidden"])',
  "textarea:not(:disabled)",
  "select:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Focusable descendants that are actually rendered. */
export type VisibilityCheck = (element: HTMLElement) => boolean;

/** Default visibility rule: laid out and not hidden. */
export function isElementVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
}

export function visibleFocusable(
  root: HTMLElement,
  isVisible: VisibilityCheck = isElementVisible
): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
}

/**
 * Apply the wrap-around rule for a Tab press inside `dialog`.
 *
 * Returns `true` when the caller must call `preventDefault()`: either the dialog has no
 * focusable content, or focus is about to leave it at either end.
 *
 * `isVisible` is injected because jsdom has no layout engine, so the default rule (which
 * reads client rects) cannot be exercised in unit tests.
 */
export function trapTabKey(
  dialog: HTMLElement,
  event: KeyboardEvent,
  isVisible: VisibilityCheck = isElementVisible
): boolean {
  if (event.key !== "Tab") return false;

  const controls = visibleFocusable(dialog, isVisible);
  const first = controls[0];
  const last = controls[controls.length - 1];

  if (!first) return true;

  const active = dialog.ownerDocument.activeElement;
  if (event.shiftKey && active === first) {
    last.focus();
    return true;
  }
  if (!event.shiftKey && active === last) {
    first.focus();
    return true;
  }
  return false;
}
