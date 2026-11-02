# Pinned favorites — planning (2026-11-01, no code)

## Request

Owner wants to replace the single `#/favorite` page ("Favorite Playlist") with
multiple favorites, pinned in the sidebar between "Manage Playlists" and
"Subscriptions" (or just after "Manage Playlists" when signed out), separated by
horizontal rules. Asked for a plan covering backward-compatible storage migration
and how to handle a large number of pinned favorites.

## Decisions (owner-confirmed)

1. **Separate concepts.** The new pinned-favorites list (`favoritePlaylistIds`) is
   distinct from the existing single `watchLaterPlaylistId`, which stays the
   quick-add "favorite" target and Watch-Later keep-alive target. Migration seeds
   the new list from the existing value; `watchLaterPlaylistId` is never deleted.
2. **Overflow.** Each pin opens that playlist directly; show the first ~6 pins, then
   an "All favorites (N)" link to a `#/favorites` page listing every favorite as a
   card grid.

## Current state (verified in code)

- `watchLaterPlaylistId` (`string | null`) lives in settings; settings are flat keys
  in `browser.storage.sync` (dev fallback `localStorage`), shallow-merged with
  `DEFAULT_SETTINGS` in `getSettings()` (storage-service.ts ~1026). `migrateSettings()`
  (~1145) is the existing migration hook; it writes migrated values back to sync.
- That single value drives three behaviors: sidebar `#/favorite` →
  `PlaylistLoader isFavorite` → editor; quick-add "favorite" target via
  `resolveDestination("favorite", …)` (shared/quick-add.js); keep-alive via
  `ensureWatchLaterPlaylist()` (storage-service.ts ~155).
- Backup JSON is `schemaVersion: 2`; `data.settings` is a whole object, and import
  merges (`{...current, ...incoming}`) or overwrites (backup-service.ts ~335). An
  additive settings key needs no schema bump.
- `_settingKeys` (storage-service.ts ~926) is the set of DEFAULT_SETTINGS keys used
  only for storage-change cache invalidation; a new default key must be added there
  so its changes invalidate the settings cache.

## Data model

- New setting `favoritePlaylistIds: string[]` (ordered; array order = pin order).
- `DEFAULT_SETTINGS.favoritePlaylistIds = []`.
- `migrateSettings()` gains an idempotent seed: if the list is empty and
  `watchLaterPlaylistId` is a non-null string, set `favoritePlaylistIds =
[watchLaterPlaylistId]` and write back to sync.
- Backup `schemaVersion` stays 2. Import already handles arbitrary settings keys.

## Sidebar layout

```
All Playlists
Watch History
Manage Playlists
<hr>
★ favorite 1 … ★ favorite N (cap ~6)
"All favorites (N)"   (only when list length > cap)
<hr>
Subscriptions / Search / Watch Later / Open by ID   (signed in only)
<hr>
```

Empty list → no pins and no dividers.

## Handling "many" favorites

1. Cap visible pins (~6) + "All favorites" overflow → `#/favorites` page.
2. `#/favorites` page = card grid (reuse PlaylistCard from Manage).
3. Sanitize on load: coerce non-array → [], dedupe, drop IDs whose playlist no
   longer exists; never render dead links.
4. Reuse cached playlist list for titles (no per-pin API calls).
5. Order = array order; reorder via Settings manager.

## Files to change

- `types/model.d.ts` — add `favoritePlaylistIds: string[]`.
- `services/storage-service.ts` — DEFAULT_SETTINGS + migrateSettings seed.
- `components/Sidebar.svelte` — favorites group (desktop + mobile drawer); remove
  single `#/favorite` link.
- `views/FavoritePlaylist.svelte` → `views/Favorites.svelte`; `App.svelte` routes.
- `stores/shortcuts.ts` — `/favorite` → `/favorites`; `components/HeaderSearchBar.svelte`
  route list.
- `components/PlaylistCard.svelte` + `components/PlaylistEditor.svelte` — star toggle.
- `components/FavoriteSettings.svelte` — replace single select with multi-select +
  reorder manager.
- Tests: migration (fresh → []; seeded from watchLaterPlaylistId; idempotent), backup
  round-trip, sidebar/route extension checks.

Untouched: `shared/quick-add.js` `resolveDestination("favorite")`, popup target,
context-menu code (all keep using `watchLaterPlaylistId`).

## Phasing

1. Data model + migration (types, defaults, migrateSettings, tests).
2. Sidebar pins + `#/favorites` page + routing (+ shortcut/route-list updates).
3. Star toggle on card + editor header.
4. Settings manager (reorder); then `npm run check && npm run build`.

## Skills used

None required for planning; code investigation only (read_file/search_files).

## State

Planning only. No application code, manifest, dependency or version changed. Tree
was already dirty (`feat/ui-polish` + owner's UI-polish work) and left as found.
