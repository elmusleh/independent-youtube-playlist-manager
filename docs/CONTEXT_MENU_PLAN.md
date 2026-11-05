# Right-click playlist actions — implementation plan

Status: **implementation complete and merged to `next`** (`669049d`, 2026-11-01); release
still unauthorized and the version stays 1.2.1. Automated gates are green and headed
acceptance evidence is recorded, but the native-menu runs (OpenSpec 3.2/3.3) and the
remaining issue evidence (3.5) are outstanding, so this is not release-ready.

See `testing/HERMES_CONTEXT_MENU_VERIFICATION.md` for the current verification matrix
and `PLAYLIST_TERMINOLOGY.md` for destination terminology. Implementation is not verified
or release-ready until the required evidence below is collected.

## Goal and current code

Offer a native, OneTab-style Playlist Manager submenu on ordinary webpages, matching
the popup's tab scopes and playlist destinations. Capture YouTube videos; import
options and playlist search use the existing responsive extension UI.

`background/context-menus.js` already adds single videos to the builder or a saved
playlist, but its page actions only match `https://www.youtube.com/watch*`.
`popup/quick-add.js` implements six scopes, destinations, insertion and tab closing,
mixed with DOM and popup state. Extract headless logic; do not import it into the worker.
`popup/tabs.js` provides reusable tab queries and URL checks. Preserve the captured-tab
navigation/closure validation in `popup/page-import.js`.

Existing menu defects to fix within this work: missing `await` around action handlers,
suppressed builder write errors, duplicate builder entries, missing destination null
checks, legacy `#/editor` links, and full menu rebuilds that fetch remote playlists.

## Proposed menu

One branded entry across page/link/image/video/frame/selection contexts. Separate
scope from destination to avoid multiplying every scope by every playlist.

```text
Playlist Manager
  My Playlists
  ─────────────────────────────────────────────
  Add YouTube tabs to [destination]              ▶
    Only this video tab
    Selected tabs in this window
    Tabs to the left in this window
    Tabs to the right in this window
    All tabs in this window
    Other tabs in this window
    All tabs across normal windows
  Add this YouTube link to [destination]         [valid links only]
  Destination                                   ▶
    Favorite playlist
    Latest playlist
    Playlist Builder
    New local playlist
    Choose saved playlist…
  ─────────────────────────────────────────────
  Save this YouTube playlist…                    [YouTube playlist context]
  Import YouTube links from this page…           [ordinary HTTP(S) page]
  Settings
```

Shorten labels to fit the browser; show full destination titles and local/YouTube
status in the chooser. Clicking an article can collect YouTube tabs elsewhere in its
window. Import from Page scans links inside the article and remains a separate action.

### Destination and preference rules

- Start from the popup's configured favorite/latest/new default. Remember an explicitly
  chosen custom destination by ID. Destination selection changes the next action;
  it never immediately adds videos.
- Use a searchable chooser instead of listing every saved playlist. Favorite/latest
  labels use cached local state; right-clicking must not trigger sign-in or network access.
- Missing favorite/latest/custom: show the chooser and explain why. Do not silently
  switch targets. New creates a local playlist with its videos in one write.
- Preserve top/bottom insertion preference and stable order. Keep builder/saved-menu
  disable settings effective, independently hiding those destinations/actions. Add a
  master menu switch.
- Before a new menu action changes a YouTube playlist, show review with destination,
  count, sign-in/consent requirements and explicit Sync. Cancel makes no remote changes.
  Never silently convert a remote target to an offline copy.

### Scope, privacy and closing rules

- Anchor to the click event's tab ID, window, index, URL and private status. Never
  query the active tab after opening extension UI; inactive-tab clicks must work.
- Left/right excludes the anchor and follows tab-strip order. Other tabs excludes it;
  all tabs includes it. Selected means highlighted tabs in that window, or only the
  anchor when it is not highlighted. Add this seventh scope to the popup too.
- All windows: anchor window first, remaining window IDs ascending, then tab index.
  Deduplicate IDs in first-seen order, including against existing destination videos.
- Validate schemes, actual YouTube hostnames and IDs. Support existing watch/mobile/
  shorts/embed/youtu.be forms; reject lookalike domains.
- First release excludes private tabs from capture and explains this on private-window
  invocation. Never aggregate private tabs into normal destinations.
- Leave tabs open by default for the new menu. The popup's existing `closeAddedTabs`
  defaults to true: do not inherit that unexpectedly. Add a separate explicit menu setting.
- If enabled, close only tabs durably added by this operation, with unchanged ID/URL/
  window and not pinned. Leave duplicates-only, failed, changed or moved tabs alone.
  No closing on partial remote sync; closing occurs after storage, never before it.

## Implementation structure

| Area                                   | Responsibility                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| New `shared/tab-selection.js`          | Pure scopes, URL validation, ordered unique IDs and explicit anchor.                     |
| New `shared/quick-add.js`              | DOM-free destination/insertion rules; validated plain JSON input/output.                 |
| New `background/capture-controller.js` | Background authority for captures, job state, saving, feedback and optional closing.     |
| New `background/context-menu-model.js` | Stable IDs, bounded menu tree, labels, enable/visibility rules.                          |
| `background/context-menus.js`          | Top-level registration and awaited dispatch only.                                        |
| `background/background.js`             | Lifecycle wiring and narrowly validated controller messages.                             |
| Popup modules                          | UI adapters to the shared controller; preserve existing behavior/settings.               |
| SPA chooser/import view                | Search, quantity/order, remote review, progress and Retry using existing Modal patterns. |

1. Register listeners synchronously at worker load. Create the base menu on install/
   update and reconcile on startup. Serialize reconciliation, observe create failures,
   and update changed entries instead of removing everything on every worker wake.
2. Refresh local labels on playlist/settings/auth changes. Feature-detect Firefox
   `contextMenus.onShown`/`refresh`, guarding stale asynchronous refreshes. Chrome
   uses URL patterns and tab/storage events; always validate again at click time.
   No dependency on accurate live counts in menu labels.
3. Collect valid video IDs first. Metadata enrichment is best effort with bounded
   concurrency and cancellation; metadata failure must not prevent saving valid IDs.
4. Serialize mutations of the entire local playlist storage key, not only each
   destination: it stores an array, so different-playlist writes can collide too.
   Route every write to that key through the background authority, including editor
   saves, deletes and imports. Check expected revisions inside the same queue so a
   stale editor cannot overwrite a capture. A check in a separate page is not atomic.
   Serialize builder writes separately, including its keyboard shortcut. Limit the
   refactor to write dispatch and visible conflicts, not a storage migration.
5. Return structured added/duplicate/skipped/failed counts and destination/result ID.
   Report success and update badges only after durable storage. Persist remote job
   progress; uncertain in-flight requests after worker restart require reconciliation
   before retry, preventing duplicate additions.
6. Chooser/import UI uses an opaque expiring job ID bound to source snapshot and
   allowlisted operation. Accept commands only from the extension's own permitted UI
   routes; content scripts sharing the extension ID do not qualify. Validate payloads
   and limits again in the controller. Do not expose URLs/titles/raw HTML/credentials
   in route parameters or logs. Store only necessary short-lived capture state.
7. For Import from Page, scan only after an explicit menu click, using the existing
   injector and captured tab. Recheck URL before execution; top frame only, no silent
   cross-origin iframe expansion. Preserve quantity/order validation, zero = all,
   progress, cancellation and protected-page errors.
8. Do not depend on `action.openPopup()`: opening a normal extension page does not
   grant `activeTab`. On permission loss/navigation/closure show a retryable error;
   do not widen permissions automatically.
9. Notify open playlist views via existing invalidation messages. Preserve dirty
   editor changes; never reload an editor to display an external addition.

## Browser and permission contract

Keep existing `contextMenus`, `tabs`, `storage`, `activeTab`, `scripting`,
`notifications` and existing hosts. No bookmarks/history/tab-groups/all-sites
permission, or content script on every site. Manifest diffs should remain empty.

Use the `browser.contextMenus` alias for current Firefox/Chromium compatibility.
Firefox desktop is primary, then Chrome/Edge. Native menus follow browser appearance
and keyboard behavior. Firefox Android has no supported native menus API: keep its
guard and popup/extension-page equivalents; no long-press parity claim. Desktop tab-strip
menus are a possible later addition, outside this page-menu scope.

Restricted pages can block scanning while navigation/tab collection still works.
Explain that difference; never promise the extension can read literally every page.

## Delivery and acceptance

1. **Shared capture foundation:** parity tests for popup scopes/targets, awaited errors,
   plain writes, duplicates and concurrent changes.
2. **Menu and chooser:** bounded branded menu, seven scopes, target selection, existing
   preferences, offline feedback and default keep-open behavior.
3. **Import and playlist-save parity:** shared extractors/source checks, options UI,
   restricted-page errors and remote review without depending on the toolbar popup.
4. **Browser verification/docs:** README/User Guide permission-use explanations,
   Android fallback and release notes after implementation.

Required tests:

- All scopes; inactive anchor; multiple windows; stable ordering; URL variants/spoofing;
  private/pinned tabs; missing/deleted targets; insertion at top/bottom; metadata failure.
- Popup + menu + dirty editor; simultaneous different destinations; worker restart;
  uncertain remote writes; quota/storage/API errors; retry without losing saved data.
- Closure/navigation/window movement during capture; duplicates-only; partial sync;
  no unrelated tab closure or success before persistence.
- Actual native Firefox and Chromium menu opening/clicking in disposable profiles,
  including the real `activeTab` grant on a non-YouTube fixture. Calling handlers directly
  is unit coverage, not proof of the native gesture/permission flow.
- Page/link/video/frame contexts; settings; rename/delete refresh; browser restart;
  keyboard traversal; light/dark/high contrast; chooser focus and cancellation.
- 14,000-video destinations and large synthetic tab batches; bounded metadata work,
  no menu growth proportional to playlist count; visible progress and retry.
- Chooser at 320/390 px with reachable actions; existing popup/routes remain working.
- `npm run check`, `npm run build`, `npm run test:extension`, real Firefox tests and
  Firefox manifest lint. Report real-device/store checks separately.

This adds a feature: use a minor release under `RELEASING.md` when it lands. Do not
automatically fold it into the proposed 1.2.1 patch, bump versions, publish or change
existing store reviews as part of this planning task.

## Three later ideas — outside this implementation

- **CM-F1 — Localized labels:** move menu text into `_locales` catalogs and test long
  translations, making the feature understandable beyond English.
- **CM-F2 — Excluded-site rules:** user-managed domains where page import is disabled,
  enforced by the controller, to prevent accidental capture on sensitive work sites.
- **CM-F3 — Menu performance budget:** measure cold-worker menu availability and capture
  time on fixed fixtures; set a CI threshold after collecting a stable baseline, catching
  slowdowns that correctness tests miss.

## Sources checked

- [OneTab](https://www.one-tab.com/) and its
  [Firefox listing](https://addons.mozilla.org/en-US/firefox/addon/onetab/): interaction
  reference; use this project's own labels/icon and YouTube-specific behavior.
- [MDN menus](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus):
  alias, native submenu and lifecycle behavior.
- [MDN onShown](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/onShown):
  refresh and stale async updates.
- [Chrome contextMenus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus):
  contexts, patterns and permissions; this reference has no `onShown` API.
- [MDN activeTab](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/activeTab_permission):
  explicit menu selection grants access; navigation can revoke it.
- [MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/menus.json):
  Firefox Android menus unsupported.
