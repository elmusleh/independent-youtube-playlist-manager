<p align="center"><a href="https://github.com/elmusleh/independent-youtube-playlist-manager" target="_blank" rel="noreferrer noopener"><img width="128" alt="IYPM logo" src="https://raw.githubusercontent.com/elmusleh/independent-youtube-playlist-manager/main/apps/web-portal/public/icon.png"></a></p>
<p align="center">Independent YouTube Playlist Manager (IYPM) <strong>organizes</strong> and <strong>manages</strong> YouTube playlists client-side with <strong>privacy by default</strong>.</p>
<br/>
<p align="center">
  <a rel="noreferrer noopener" href="https://chromewebstore.google.com/"><img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome-141e24.svg?&style=for-the-badge&logo=google-chrome&logoColor=white"></a>
  <a rel="noreferrer noopener" href="https://addons.mozilla.org/en-US/firefox/addon/iypm/"><img alt="Firefox Add-ons" src="https://img.shields.io/badge/Firefox-141e24.svg?&style=for-the-badge&logo=firefox-browser&logoColor=white"></a>
</p>

<h2 align="center">Independent YouTube Playlist Manager (IYPM)</h2>

IYPM is an **open-source**, privacy-first **browser extension** designed to replace and enhance YouTube's native playlist management. It operates entirely **client-side**, storing your data locally and syncing on-demand to your YouTube account without any intermediate third-party servers.

---

## 📖 Project Documentation Map

For installation guides, technical setup, and compliance notices, refer directly to the dedicated documentation files:

- **User Guide & Installation**: [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) (manual browser loading, Google Cloud API setup, sync quotas)
- **Support & FAQ**: [`docs/SUPPORT.md`](docs/SUPPORT.md) (troubleshooting, frequently asked questions)
- **Firefox & Chrome Store Submissions**: [`docs/amo-submission.md`](docs/amo-submission.md) (upload checklists, reviewer notes, technical details)
- **Privacy Policy**: [`docs/PRIVACY_POLICY.md`](docs/PRIVACY_POLICY.md) (zero data collection notice)
- **Terms of Service**: [`docs/TERMS_OF_SERVICE.md`](docs/TERMS_OF_SERVICE.md) (extension terms of use)
- **Impressum / Legal Notice**: [`docs/IMPRESSUM.md`](docs/IMPRESSUM.md) (legal provider info)
- **Contributing Guidelines**: [`CONTRIBUTING.md`](CONTRIBUTING.md) (development, testing, PR guidelines)
- **Release Changelog**: [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md) (milestone feature releases)
- **AI Agent Architect Constraints**: [`AGENTS.md`](AGENTS.md) (developer constraints for AI coding agents)

---

## 🚀 Key Features

- **Offline-first:** Edit, reorder, merge, split, and search your playlists without internet connection.
- **Bulk Editing:** Drag-and-drop, pagination support, bulk-select and delete, duplicates removal, and reverse sorting.
- **Tab Harvester:** Import all open YouTube tabs from active browser windows with a single click.
- **Flexible Import/Export:** Backup database to **JSON (Schema v2)**, or export to **CSV** and **M3U** playlists.
- **Zero Data Collection:** Fully client-side. No user profiles, tracker links, or telemetry.

### Comparison: IYPM vs Native YouTube Playlists

| Capability                   | Independent YouTube Playlist Manager (IYPM)                                      | Native YouTube Playlists                                 |
| ---------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Creating playlists**       | ✅ Create **unlimited playlists** with a few clicks. Batch-add dozens of videos. | ⚠️ Add videos one by one manually (very slow).           |
| **Adding open browser tabs** | ✅ Harvester grabs open YouTube tabs from **all browser windows** automatically. | ❌ Not possible.                                         |
| **Text & HTML Scraping**     | ✅ Extract video IDs from raw HTML source, clipboard paste, or text blocks.      | ❌ Not possible.                                         |
| **Bulk Edit Tools**          | ✅ Merge, split, reverse, sort, and de-duplicate. Bulk select and delete.        | ❌ Manual per-video deletion only. No merge/split tools. |
| **Works Offline**            | ✅ Yes, data is stored in IndexedDB and local storage.                           | ❌ Requires active connection and YouTube session.       |
| **Data Portability**         | ✅ 1-click export to **JSON**, **CSV**, and **M3U** (VLC).                       | ❌ Locked into Google ecosystem.                         |
