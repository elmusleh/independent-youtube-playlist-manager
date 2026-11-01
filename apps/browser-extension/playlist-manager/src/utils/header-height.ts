/**
 * Fixed app-header height, read once from the --app-header-height design token
 * and cached. The value only changes at the mobile/desktop breakpoint, so reset
 * the cache on `resize` (StickyHeader calls resetHeaderHeight() in its handler).
 */
let cached: number | null = null;

export function getHeaderHeight(): number {
  if (cached === null) {
    const value = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--app-header-height")
    );
    cached = Number.isFinite(value) && value > 0 ? value : 56;
  }
  return cached;
}

export function resetHeaderHeight(): void {
  cached = null;
}
