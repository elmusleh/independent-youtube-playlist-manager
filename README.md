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

| Capability        | IYPM                                        | Native YouTube Playlists         |
| ----------------- | ------------------------------------------- | -------------------------------- |
| Data collection   | ✅ Zero telemetry, zero tracking            | ❌ Google collects usage data    |
| Login required    | ✅ Not required for basic use               | ❌ Google account required       |
| Open source       | ✅ MIT license, fully auditable             | ❌ Proprietary, closed source    |
| Permissions scope | ✅ Strictly youtube.com watch pages         | ⚠️ Broad Google account scope    |
| Platform support  | ✅ Chrome, Firefox Desktop, Firefox Android | ⚠️ Web + mobile apps only        |
| Cost              | ✅ 100% free & open source                  | ✅ Free (ad-supported ecosystem) |
