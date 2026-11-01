/**
 * Find the nearest scrollable ancestor (the element that actually scrolls).
 * Every view wraps its content in `.view-body` (overflow-y: auto), so this is
 * the real scroller — not the window, which never scrolls in this SPA.
 */
export function getScrollParent(el: HTMLElement | null): HTMLElement {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement) || document.documentElement;
}
