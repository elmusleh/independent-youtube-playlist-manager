# AMO Technical Details

Paste this into the **"Technical Details"** or **"Technical Information"** field on AMO.

---

## Permissions and Why They Are Needed

| Permission | Purpose |
|------------|---------|
| `tabs` | Read the active tab URL to detect YouTube videos and extract video IDs |
| `storage` | Persist playlists, settings, and OAuth tokens in `browser.storage.local` |
| `unlimitedStorage` | Remove quota limits so large playlists with many videos can be stored locally |
| `activeTab` | Allow the popup to read the current YouTube video when the toolbar icon is clicked |
| `contextMenus` | Add a "Add to playlist" item to the right-click menu on YouTube video links |
| `identity` | Launch the OAuth 2.0 consent flow for YouTube Data API v3 authentication |
| `scripting` | Execute helper scripts in the YouTube tab to scrape video metadata |
| `notifications` | Show toast notifications when videos are added to playlists |
| `alarms` | Schedule periodic background tasks for playlist sync reminders |

## Host Permissions

| Host | Purpose |
|------|---------|
| `*://www.youtube.com/watch*` | Inject a content script to track the currently playing video |
| `<all_urls>` | Allow context-menu actions and tab-reading on any page (needed for adding arbitrary YouTube links) |
| `https://www.googleapis.com/` | Call the YouTube Data API v3 for syncing playlists to/from YouTube |

## Data Storage

All data is stored **locally** in `browser.storage.local`:

- Saved playlists (video IDs, titles, order)
- User settings (theme, per-page count, cache duration, etc.)
- OAuth access/refresh tokens for YouTube sync
- Cached video metadata (thumbnails, titles, channel names)

**No data is transmitted to any server** except Google's YouTube Data API v3 when the user explicitly triggers a sync.

## Remote API Usage

- **YouTube Data API v3** (`https://www.googleapis.com/youtube/v3/*`)
  - Called only when the user initiates a sync operation
  - Used to: insert videos into YouTube playlists, read existing playlists, update playlist metadata
  - All requests include the user's own OAuth token; no server-side proxying

## Content Scripts

- `watch-tracker.js` runs on `*://www.youtube.com/watch*`
  - Detects video changes and updates the internal "latest watched" video ID
  - Does not modify page content; read-only

## Background Script

- `background-worker.js` (service worker on MV3)
  - Handles context-menu clicks
  - Manages alarms for periodic sync
  - Routes messages between popup, content script, and editor

## No Remote Code Execution

The extension does not load or execute code from remote URLs. All code is bundled in the extension package.

## Data Collection

No data collection. The extension operates entirely client-side. See `docs/PRIVACY_POLICY.md` for details.
