# Version 1.1.0

## Improvements

- Responsive toolbar popup, page layouts, search, settings, and video rows.
- Adaptive dialogs with keyboard focus containment, accessible labels, safe
  confirmation focus, and scrolling that remains correct with nested dialogs.
- Compact pagination with ellipses and previous/next arrows.
- Video reorder buttons usable with touch and keyboard; correct ordering while filtering.
- Restored Playlist Builder navigation and correct playlist-route search behavior.
- Mobile YouTube watch-page tracking and Shorts/mobile tab collection improvements.
- Scraped tab metadata now uses the shared IndexedDB cache.
- Settings and playlist caches update when another extension context changes data.
- Firefox Android OAuth redirects match Firefox's native derivation; responses
  validate their redirect and random request state, with a timeout for abandoned flows.
- Stronger backup validation; legacy playlist imports preserve unrelated cached
  metadata and watch history.

## Release hardening

- Removed the unused Chrome bookmarks permission cited in the existing store takedown.
- Removed unnecessary public exposure of extension pages/assets to websites.
- Scoped YouTube host access supports metadata fetching and mobile tab injection.
- Clean builds generate the editor HTML and discard obsolete generated chunks.
- Runtime-only browser packages and stronger manifest/file validation.
- Patched dependency advisories and restored web portal lint/type validation.
- Unconfigured cloud synchronization returns an error rather than simulated success.

## Verification and limits

See [the readiness report](RELEASE_READINESS.md) for tested browsers, scenarios,
known limits, and the exact store submission outcomes. Store publication is subject
to each marketplace's review; submission does not mean approval.
