/**
 * Which parts of local state travel in a snapshot.
 *
 * Categories are data, not branches: adding one is a new entry plus a new key in the
 * source object, and the selector keeps its shape. Everything is opt-out except
 * thumbnails, which are the only category that can add megabytes.
 */

export const SYNC_CATEGORIES = [
  "playlists",
  "metadata",
  "thumbnails",
  "history",
  "settings",
] as const;

export type SyncCategory = (typeof SYNC_CATEGORIES)[number];

export type SyncSelection = Record<SyncCategory, boolean>;

export const DEFAULT_SYNC_SELECTION: SyncSelection = {
  playlists: true,
  metadata: true,
  thumbnails: false,
  history: true,
  settings: true,
};

/** Local data offered by the caller; only selected keys survive. */
export type SyncSource = {
  playlists?: unknown;
  metadata?: unknown;
  thumbnails?: unknown;
  history?: unknown;
  settings?: unknown;
};

export type SyncPayload = Partial<SyncSource> & {
  /** Recorded so an importer can tell an excluded category from an empty one. */
  includedCategories: SyncCategory[];
};

export function isCategoryEnabled(
  selection: Partial<SyncSelection> | undefined,
  category: SyncCategory
): boolean {
  const explicit = selection?.[category];
  return typeof explicit === "boolean" ? explicit : DEFAULT_SYNC_SELECTION[category];
}

/** Build the payload for one snapshot from the caller's data and the user's toggles. */
export function selectSyncContent(
  source: SyncSource,
  selection: Partial<SyncSelection> = DEFAULT_SYNC_SELECTION
): SyncPayload {
  const included: SyncCategory[] = [];
  const payload: SyncPayload = { includedCategories: included };

  for (const category of SYNC_CATEGORIES) {
    if (!isCategoryEnabled(selection, category)) continue;
    const value = source[category];
    if (value === undefined) continue;
    included.push(category);
    (payload as Record<string, unknown>)[category] = value;
  }

  return payload;
}

/** Categories a payload actually carries, tolerating payloads from older versions. */
export function categoriesInPayload(payload: SyncPayload | undefined): SyncCategory[] {
  if (!payload) return [];
  if (Array.isArray(payload.includedCategories)) return payload.includedCategories;
  return SYNC_CATEGORIES.filter((category) => payload[category] !== undefined);
}
