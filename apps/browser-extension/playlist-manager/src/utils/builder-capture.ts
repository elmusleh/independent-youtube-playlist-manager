/** Only newly captured IDs are merged; local removals/reordering remain untouched. */
export function builderAdditions(stored: string[], previouslySeen: Set<string>, current: string[]) {
  const present = new Set(current);
  return stored.filter((id) => !previouslySeen.has(id) && !present.has(id));
}
