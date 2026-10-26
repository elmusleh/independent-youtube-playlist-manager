/**
 * In-memory registry of video ids the caller explicitly wants re-fetched.
 *
 * A "force refresh" used to delete the IndexedDB rows first. That meant a failed
 * fetch *destroyed* data that was already cached — an entry that only lacked a
 * duration lost its title and channel too. Forcing is now an in-memory intent:
 * the fetch path bypasses the persistent cache for these ids, successful results
 * are written over the old rows, and a failed fetch leaves the previous entry
 * untouched.
 *
 * Scope is one page context and one refresh pass: `markForcedRefetch` before the
 * fetch, `clearForcedRefetch` in a `finally`.
 */

const forced = new Set<string>();

export function markForcedRefetch(ids: Iterable<string>): void {
  for (const id of ids) {
    if (id) forced.add(id);
  }
}

export function clearForcedRefetch(ids: Iterable<string>): void {
  for (const id of ids) {
    forced.delete(id);
  }
}

export function isForcedRefetch(id: string): boolean {
  return forced.has(id);
}

/** Number of ids currently marked — used by tests and diagnostics. */
export function forcedRefetchCount(): number {
  return forced.size;
}
