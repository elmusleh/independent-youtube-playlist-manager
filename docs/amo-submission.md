## 🔒 4. Technical Details (Permissions, Storage & Background Scripts)

If asked about specific permission usage, host parameters, or background code during submission:

### Permissions and Why They Are Needed

| Permission         | Purpose                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `tabs`             | Read the active tab URL to detect YouTube videos and extract video IDs             |
| `storage`          | Persist playlists, settings, and OAuth tokens in `browser.storage.local`           |
| `unlimitedStorage` | Remove quota limits so large playlists with many videos can be stored locally      |
| `activeTab`        | Allow the popup to read the current YouTube video when the toolbar icon is clicked |
| `contextMenus`     | Add a "Add to playlist" item to the right-click menu on YouTube video links        |
| `identity`         | Launch the OAuth 2.0 consent flow for YouTube Data API v3 authentication           |
| `scripting`        | Execute helper scripts in the YouTube tab to scrape video metadata                 |
| `notifications`    | Show toast notifications when videos are added to playlists                        |
| `alarms`           | Schedule periodic background tasks for playlist sync reminders                     |

### Host Permissions

| Host                          | Purpose                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `*://www.youtube.com/watch*`  | Inject a content script to track the currently playing video                                       |
| `<all_urls>`                  | Allow context-menu actions and tab-reading on any page (needed for adding arbitrary YouTube links) |
| `https://www.googleapis.com/` | Call the YouTube Data API v3 for syncing playlists to/from YouTube                                 |
