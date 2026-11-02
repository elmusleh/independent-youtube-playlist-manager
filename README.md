<div align="center">

<a href="https://github.com/elmusleh/independent-youtube-playlist-manager"><img src="https://raw.githubusercontent.com/elmusleh/independent-youtube-playlist-manager/main/apps/web-portal/public/icon.png" alt="IYPM logo" width="96" /></a>

# Independent YouTube Playlist Manager

**IYPM** is an open-source, local-first **browser extension** for saving and organizing YouTube playlists without signing in. Metadata lookups contact external services; optional Google sign-in and configured cloud sync support account features and cross-device use.

<a href="https://chromewebstore.google.com/detail/dapjjdcnolpmfcnobilphjfpkmmokgid"><img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome-141e24.svg?&style=for-the-badge&logo=google-chrome&logoColor=white" /></a>
<a href="https://addons.mozilla.org/en-US/firefox/addon/iypm/"><img alt="Firefox Add-ons" src="https://img.shields.io/badge/Firefox-141e24.svg?&style=for-the-badge&logo=firefox-browser&logoColor=white" /></a>

</div>

---

## ⚖️ IYPM vs Native YouTube Playlists

A comprehensive, side-by-side comparison of every capability — the single source of truth for what IYPM offers over YouTube's built-in playlists.

> **Legend:** ✅ Supported · ⚠️ Limited / optional · ❌ Not available

### Playlist Creation & Organization

| Capability                               | IYPM                                        | Native YouTube Playlists     |
| ---------------------------------------- | ------------------------------------------- | ---------------------------- |
| Create unlimited playlists               | ✅ Unlimited, no account required           | ⚠️ Requires a Google account |
| Batch-add multiple videos                | ✅ Add dozens in one click                  | ❌ One video at a time       |
| Tab Harvester (open tabs)                | ✅ Grab YouTube tabs from all windows       | ❌ Not possible              |
| Extract IDs from text / HTML / clipboard | ✅ Paste links, HTML source, or text blocks | ❌ Not possible              |
| Quick-add toolbar popup                  | ✅ One-click queue from the toolbar         | ❌ Not available             |
| Right-click context menus                | ✅ Add links from YouTube search pages      | ❌ Not available             |

### Editing & Bulk Operations

| Capability                 | IYPM                                      | Native YouTube Playlists      |
| -------------------------- | ----------------------------------------- | ----------------------------- |
| Drag-and-drop reordering   | ✅ Reorder playlists freely               | ⚠️ Limited manual reordering  |
| Bulk select & delete       | ✅ Multi-select and batch delete          | ❌ Delete one video at a time |
| Merge playlists            | ✅ Combine two playlists into one         | ❌ Not possible               |
| Split playlists            | ✅ Split one playlist into several        | ❌ Not possible               |
| Duplicate removal          | ✅ Automatic de-duplication               | ❌ Manual only                |
| Smart sorting              | ✅ Sort by title, channel, date, and more | ⚠️ Default order only         |
| Reverse order              | ✅ One-click reverse                      | ❌ Not possible               |
| Search within playlists    | ✅ Instant local search                   | ⚠️ Basic search only          |
| Pagination for large lists | ✅ Handles thousands of videos smoothly   | ⚠️ Lazy-loading only          |

### Import, Export & Portability

| Capability              | IYPM                                | Native YouTube Playlists            |
| ----------------------- | ----------------------------------- | ----------------------------------- |
| JSON backup             | ✅ Full database backup (Schema v2) | ❌ Not possible                     |
| CSV export              | ✅ Spreadsheet-ready export         | ❌ Not possible                     |
| M3U export              | ✅ Playable in VLC & media players  | ❌ Not possible                     |
| Restore / import backup | ✅ Merge or overwrite restore modes | ❌ Not possible                     |
| Data ownership          | ✅ Your data lives on your machine  | ❌ Locked into the Google ecosystem |

### Metadata & Offline

| Capability                                | IYPM                                        | Native YouTube Playlists            |
| ----------------------------------------- | ------------------------------------------- | ----------------------------------- |
| Works offline                             | ✅ IndexedDB + local storage                | ❌ Requires connection & session    |
| Video metadata (title, channel, duration) | ✅ Zero-quota multi-tier fetch engine       | ⚠️ Automatic, but Google-controlled |
| Local metadata cache                      | ✅ Multi-gigabyte IndexedDB cache           | ❌ No local control                 |
| Custom metadata engines                   | ✅ Configurable Invidious / Piped instances | ❌ Not applicable                   |
| Thumbnails & descriptions                 | ✅ Cached locally for instant access        | ⚠️ Streamed from YouTube            |

### Sync & Cross-Device

| Capability                 | IYPM                                            | Native YouTube Playlists       |
| -------------------------- | ----------------------------------------------- | ------------------------------ |
| Cross-device sync          | ⚠️ Optional: encrypted Supabase + YouTube OAuth | ✅ Built-in via Google account |
| Account independence       | ✅ Data not tied to any single account          | ❌ Tied to one Google account  |
| No API quota for local use | ✅ Zero-quota scraping pipeline                 | ⚠️ No control (N/A)            |
| Sync resume on quota limit | ✅ Auto-resume over days, no duplicates         | ❌ N/A                         |

### Privacy, Openness & Platform

| Capability        | IYPM                                                  | Native YouTube Playlists         |
| ----------------- | ----------------------------------------------------- | -------------------------------- |
| Data collection   | ✅ Zero telemetry, zero tracking                      | ❌ Google collects usage data    |
| Login required    | ✅ Not required for basic use                         | ❌ Google account required       |
| Open source       | ✅ MIT license, fully auditable                       | ❌ Proprietary, closed source    |
| Permissions scope | ✅ YouTube host access and user-invoked page scanning | ⚠️ Broad Google account scope    |
| Platform support  | ✅ Chrome, Edge, Firefox Desktop, Firefox Android     | ⚠️ Web + mobile apps only        |
| Cost              | ✅ 100% free & open source                            | ✅ Free (ad-supported ecosystem) |

---

## Permissions and privacy

The Chrome and Firefox editions declare the permissions below. They support
existing features in both signed-out/local use and optional account use; signing
in is not required for local playlist creation or watch-progress storage.

| Permission                                    | Why it is used                                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                                   | Temporary access to the selected webpage after you invoke the extension. **Import from Page** uses it with `scripting` to extract YouTube links from an ordinary blog, article or other supported page, without permanent access to every website. It is not needed for continuous YouTube playback tracking. |
| `tabs`                                        | Read tab URLs/titles to collect YouTube videos across windows, including `youtu.be` links, find existing editor/builder tabs, and observe the tab-based authentication redirect used on Firefox Android. This is separate from the browser's history API.                                                     |
| `scripting`                                   | Run packaged link/channel/video extractors in the selected page or permitted YouTube tabs. No remotely downloaded scripts are executed.                                                                                                                                                                       |
| `storage`                                     | Store playlists, settings, account tokens and local watch-progress records in extension storage.                                                                                                                                                                                                              |
| `unlimitedStorage`                            | Support large local IndexedDB metadata/image archives beyond normal extension storage limits. Browser-data deletion and uninstalling can still remove data.                                                                                                                                                   |
| `notifications`                               | Display local import, error, sync and retry notifications.                                                                                                                                                                                                                                                    |
| `contextMenus`                                | Add right-click playlist actions where supported.                                                                                                                                                                                                                                                             |
| `identity`                                    | Run optional Google/Supabase OAuth flows on supported desktop browsers. Local features do not require an account; Firefox Android uses its supported tab/email alternatives.                                                                                                                                  |
| `alarms`                                      | Schedule sync retries and background housekeeping.                                                                                                                                                                                                                                                            |
| Host access: `https://*.youtube.com/*`        | Fetch metadata and run extractors on YouTube pages. The watch-tracking content script matches every YouTube watch page (`*.youtube.com/watch*` and bare `youtube.com/watch*`), including `www.` and `m.` subdomains.                                                                                          |
| Optional host access: `https://i.ytimg.com/*` | Only requested when you enable saving thumbnail image bytes on this device. The current source includes this unreleased feature; the pending 1.1.1 store packages do not include it.                                                                                                                          |

**Playback timestamps:** the YouTube watch-page content script reads playback
position/duration and sends records to local extension storage. This does not
require the browser's `history` permission or Google sign-in, and does not rely
on `activeTab`. The extension does not request `bookmarks` or `history` access.

**Import from Page:** open the extension using its toolbar button on the source
page, choose **Import from Page**, then select a limit and order. `0` imports all
videos found by the scan. YouTube channel scanning is bounded and can only find
videos the page makes available. Protected browser/store pages may block scanning.
Opening `popup.html` as a normal tab or programmatically does not itself grant
temporary access. Reopen the toolbar popup if the source page navigates.

Local watch history and page scans are not sent to analytics. Metadata requests,
optional account features and cloud sync have their own network behavior and data
handling, described in the [privacy policy](docs/PRIVACY_POLICY.md). Firefox also
shows data-transmission declarations and separate optional account/search consent.
Marketplace packages can lag behind this source branch; store submission is not
proof of approval or publication.

Browser references: [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab),
[Chrome tabs permissions](https://developer.chrome.com/docs/extensions/reference/api/tabs#permissions),
and [Firefox activeTab](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/activeTab_permission).

## 🛠️ Development Quickstart

### Prerequisites

- Node.js 22+
- `npm ci` to install all dependencies (root + extension + portal)

### Essential Commands

```bash
# ALWAYS RUN FIRST - verify clean baseline
npm run check          # lint → format:check → test → svelte-check

# Full production build (Chrome + Firefox + Edge extension packages)
npm run build

# Extension verification (90 real-extension route/viewport checks)
npm run test:extension

# Web portal dev server (localhost:3000)
npm run web

# Web portal production build
npm run web:build

# Format all code
npm run format

# Lint + auto-fix
npm run lint:fix
```

### Architecture Overview

| Layer                     | Tech                              | Location                                   |
| ------------------------- | --------------------------------- | ------------------------------------------ |
| **Extension Shell (MV3)** | Plain JS                          | `apps/browser-extension/`                  |
| **Extension UI (SPA)**    | Svelte 5 + TypeScript + Rollup    | `apps/browser-extension/playlist-manager/` |
| **Web Portal**            | Next.js 15 + Tailwind + shadcn/ui | `apps/web-portal/`                         |
| **Build Tools**           | Node.js scripts                   | `packages/build-tools/`                    |

### Design System

- **Single source of truth**: `apps/browser-extension/playlist-manager/src/css/design-tokens.css`
- Imported first in `main.ts` before `view-layout.css` and `responsive.css`
- 14 token categories: colors, typography, spacing, breakpoints, layout, touch targets, z-index, transitions, viewport, component-specific, responsive contracts, utilities, print
- Backward compatible via legacy aliases (`--app-bg`, `--yt-blue`, `--primary-color`)

### Documentation map

Every document, and who each one is for: [`docs/INDEX.md`](docs/INDEX.md).

### Release Workflow

See `docs/RELEASING.md` — the single release runbook: semver decision, version sync,
changelog, release PR `next` → `main`, tag, store uploads.

Day-to-day: `next` is the integration branch, `main` holds releases only. Agents may push
branches, open PRs and squash-merge into `next`; a release PR into `main` is merged when the
owner asks for that release.

### 🛠️ Developer & Control CLI

Use `./iypm.sh` at repository root for quick overview and operations:

```bash
./iypm.sh             # Displays command menu and available actions
./iypm.sh status      # Current versions, AMO & store status, test release state
./iypm.sh features    # Complete feature catalog and capabilities
./iypm.sh changes     # Recent version changes and release notes
./iypm.sh check       # Run all linters, unit tests, and bundle verification
./iypm.sh build       # Production builds for Chrome, Firefox, and Edge
```

### AI Agent Rules (from AGENTS.md)

1. **Branch from `next`, PR into `next`** — squash-merged, branch deleted on merge. `main` only takes release PRs from `next`; never push to either directly
2. **ALWAYS `npm run check` before AND after edits**
3. **ALWAYS `npm run build` after edits** — verifies `dist/`
4. **No file > 350 lines** — Split using established module pattern
5. **Preserve `CHANGELOG.md`** — User-authored entries are not overwritten

---

## 📊 Current Status

> Live state (branches, SHAs, pending work) is in [`.ai-sync/HANDOFF.md`](.ai-sync/HANDOFF.md).
> The block below records store submission status as of the 1.2.1 release.

- **Version**: 1.2.1 — patch release prepared on `next`, awaiting owner to ship
- **Chrome**: 1.1.1 in review (auto-publish on approval); 1.2.1 package ready
- **Microsoft Edge**: 1.1.1 draft in Partner Center (never submitted); 1.2.1 package ready to upload
- **Firefox Listed**: 1.1.1 (ID 6620554); 1.2.1 package ready
- **Firefox Unlisted Test**: v1.2.0.1 (ID 6620940)
- **All checks pass**: 195 tests, zero Svelte errors, clean builds, 90 E2E route checks
- **Enforced on `main`**: quality, extension diagnostics and E2E must pass before merge
- **Cutting a release**: see [docs/RELEASING.md](docs/RELEASING.md)

---

## 🔗 Links

- [Chrome Web Store](https://chromewebstore.google.com/detail/dapjjdcnolpmfcnobilphjfpkmmokgid)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/iypm/)
- [Web Portal](https://iypm.vercel.app/)
- [GitHub Repository](https://github.com/elmusleh/independent-youtube-playlist-manager)

### Desktop right-click capture (under development)

The native Playlist Manager menu collects YouTube videos from seven tab scopes, with
local destinations and an explicit review before YouTube Sync. Choose a destination
without adding videos; Import from Page scans links only after a menu click. Protected
pages may block scanning. Private tabs are excluded. Native captures keep tabs open by
default; optional closing only affects newly saved, unchanged, unpinned video tabs.
Firefox Android uses popup/extension-page equivalents rather than native page menus.

This feature uses the existing tabs, context-menu, storage, activeTab, scripting and
notification permissions. It adds no all-sites access. Destination search and remote
review run in the extension's own page. Capture jobs expire after 30 minutes. Titles,
source URLs, raw page contents and credentials are not placed in capture links.

The implementation is awaiting the [Hermes verification matrix](docs/testing/HERMES_CONTEXT_MENU_VERIFICATION.md),
including actual Firefox and Chromium native menu gestures. It is not release-ready.
See [destination terminology](docs/PLAYLIST_TERMINOLOGY.md) for behavior details.
