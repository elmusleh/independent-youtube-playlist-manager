<div align="center">

<a href="https://github.com/elmusleh/independent-youtube-playlist-manager"><img src="https://raw.githubusercontent.com/elmusleh/independent-youtube-playlist-manager/main/apps/web-portal/public/icon.png" alt="IYPM logo" width="96" /></a>

# Independent YouTube Playlist Manager

**IYPM** is an open-source, privacy-first **browser extension** that lets you save, organize, and sync YouTube playlists across devices — entirely client-side, with **no servers, no API quotas, and no login required**.

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

| Capability        | IYPM                                              | Native YouTube Playlists         |
| ----------------- | ------------------------------------------------- | -------------------------------- |
| Data collection   | ✅ Zero telemetry, zero tracking                  | ❌ Google collects usage data    |
| Login required    | ✅ Not required for basic use                     | ❌ Google account required       |
| Open source       | ✅ MIT license, fully auditable                   | ❌ Proprietary, closed source    |
| Permissions scope | ✅ Strictly youtube.com watch pages               | ⚠️ Broad Google account scope    |
| Platform support  | ✅ Chrome, Edge, Firefox Desktop, Firefox Android | ⚠️ Web + mobile apps only        |
| Cost              | ✅ 100% free & open source                        | ✅ Free (ad-supported ecosystem) |

---

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

### Release Workflow

See `docs/RELEASE_SPEC.md` — AI agents handle all steps up to `git push` (human only).

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

1. **NEVER `git push`** — Stage, commit, notify user
2. **ALWAYS `npm run check` before AND after edits**
3. **ALWAYS `npm run build` after edits** — verifies `dist/`
4. **No file > 350 lines** — Split using established module pattern
5. **Preserve `CHANGELOG.md`** — User-authored entries are not overwritten

---

## 📊 Current Status (2026-10-25)

- **Version**: 1.1.1 (submitted to both stores)
- **Chrome**: Pending review (auto-publish on approval)
- **Microsoft Edge**: v1.1.1 package ready; store submission pending Partner Center listing
- **Firefox Listed**: Unreviewed (ID 6620554)
- **Firefox Unlisted Test**: v1.2.0.1 (ID 6620940)
- **Source**: Commit `891b343` + `dff9c9c`, Tag `v1.1.1` (local only)
- **All checks pass**: 120 tests, zero Svelte diagnostics, clean builds
- **Phase 4 pending**: Real Android device responsive verification

---

## 🔗 Links

- [Chrome Web Store](https://chromewebstore.google.com/detail/dapjjdcnolpmfcnobilphjfpkmmokgid)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/iypm/)
- [Web Portal](https://iypm.vercel.app/)
- [GitHub Repository](https://github.com/elmusleh/independent-youtube-playlist-manager)
