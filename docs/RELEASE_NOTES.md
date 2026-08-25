# Release Notes

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] - 2026-08-24

This is the initial stable release of the **Independent YouTube Playlist Manager** (IYPM). It consolidates the client-side WebExtension and the Next.js web portal into a unified, monorepo structure.

### Features Included in v1.0.0:

#### 1. Extension options UI & SPA Dashboard

- **Modern Svelte 5 Frontend**: Built with Svelte 5 + TypeScript + Rollup. Renders custom views for active playlist editing, saved playlists list, settings, watch history, and shortcuts.
- **Quick-Add Popup Toolbar**: Simple click-to-queue panel to add active tab videos to Favorite, Latest, or custom playlists in one click.
- **Playlist Builder Context Menus**: Desktop-only right-click menu integration to queue links directly from YouTube search pages.

#### 2. Next.js 15 Web Portal & SaaS Dashboard

- **Responsive Marketing Site**: Built with Next.js 15 App Router + Tailwind CSS + shadcn/ui.
- **Interactive Simulator**: Simulated zero-quota metadata fetch latency tool to preview offline vs online performance.
- **Supabase Cloud Hub**: Authenticated backend dashboard allowing users to view global catalogs, manage API sync tokens, and view cloud-backed playlists.

#### 3. 5-Tier Zero-Quota Metadata Pipeline

- **Zero-Quota First Resolution**: Resolves video title, channels, and statuses without using YouTube Data API quota:
  1.  _Local IndexedDB Cache_: Instant lookup hits.
  2.  _Innertube Client Engine_: Modern `MWEB`/`WEB` player queries that bypass bot blocks.
  3.  _Embed Page Headless Scraper_: Extracts JSON player state from embedded page HTML.
  4.  _Official YouTube oEmbed_: Zero-quota title and channel details.
  5.  _Piped & Invidious Instance Fallbacks_: Distributed fallback endpoints.
- **YouTube Data API v3 integration**: Batch queries `/videos` in 50-item chunks when OAuth sync is activated.

#### 4. Resilient Local & Cloud Storage Architecture

- **Multi-Gigabyte IndexedDB Layer**: Zero-library transactional db wrapper (`yph_metadata_db_v2`) utilizing the extension's `unlimitedStorage` permission to cache massive video tables without browser quota restrictions.
- **Supabase Delta Cloud Sync**: Real-time delta synchronization mapping playlist states with soft-deletes and last-write-wins conflict resolution.
- **Global Deduplicated Catalog**: Shared PostgreSQL schema database that resolves metadata globally, caching thumbnails and descriptions to drastically reduce API quota loads.
- **JSON/CSV/M3U Backup Pipeline**: Complete configuration export/import (playlists, watch history, metadata cache, and settings) with merged schema resolution.

#### 5. Verification & Validation Safety

- **Mozilla Store Safe DOM Insertion**: Replaced all raw `.innerHTML` setters with DOM-safe text node appenders, achieving 0 warning validation status on Firefox AMO.
- **Headed Screenshot Automation**: centrally configured Playwright test capture tool [`packages/build-tools/capture.js`](file:///home/steve/dev/independent-youtube-playlist-manager/packages/build-tools/capture.js) to compile and capture all storefront screenshots and promotional templates.
