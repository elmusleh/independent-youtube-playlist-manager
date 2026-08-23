# Notes for Reviewers

Paste this into the **"Notes for Reviewers"** field on AMO (if available).

---

## Technical Overview

- **Authentication:** The extension uses `browser.identity.launchWebAuthFlow` for YouTube OAuth 2.0 authentication.
- **Data Storage:** All playlist data is stored locally in `browser.storage.local`. No data is transmitted to any third-party server except Google's YouTube Data API v3 for sync features.
- **API Calls:** The extension calls the YouTube Data API v3 (`https://www.googleapis.com/`) only when the user explicitly triggers a sync operation.
- **Source Code:** Full source code is available at https://github.com/el-musleh/independent-youtube-playlist-manager
- **Permissions:** The extension requests `identity`, `storage`, `tabs`, `activeTab`, `contextMenus`, `scripting`, `unlimitedStorage`, `alarms`, and `notifications` — all used exclusively for playlist management and YouTube sync functionality.
- **Data Collection:** No personally identifiable information is collected. See `docs/PRIVACY_POLICY.md` in the repository root.

---

## Build Instructions (for source review)

```bash
npm install
cd playlist-editor && npm install && npm run build && cd ..
npm run build-firefox
```

The built Firefox extension will be in `dist/firefox/`.

## Artifacts

- **Extension ZIP:** generated locally at `dist/independent-youtube-playlist-manager-firefox.zip`
- **Source ZIP:** generated locally and uploaded as an AMO source attachment
- **Signed XPI:** generated locally at `dist/firefox/web-ext-artifacts/*.xpi`
