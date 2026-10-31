# Playlist destinations and capture behavior

| Term               | Meaning                                                                                                      | Where videos are stored                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Playlist Builder   | Temporary working list assembled before creating a saved playlist.                                           | This browser profile.                                                     |
| Local playlist     | A saved playlist available without a YouTube account or network connection.                                  | This browser profile.                                                     |
| YouTube playlist   | A playlist in the signed-in YouTube account.                                                                 | YouTube; changes require review and explicit Sync.                        |
| Saved playlist     | A local or YouTube playlist shown in My Playlists. This term alone does not mean remote.                     | The chooser identifies Local or YouTube.                                  |
| Favorite playlist  | The playlist ID configured in Settings. It can be local or YouTube. A missing favorite must be chosen again. | The configured destination; never a silent replacement.                   |
| Latest playlist    | The newest playlist by timestamp in the locally cached destination list, including YouTube entries.          | The selected destination; remote entries require review.                  |
| New local playlist | A new destination created with all captured IDs in one durable write.                                        | This browser profile.                                                     |
| Capture            | Collect unique valid YouTube video IDs from an explicit source and save them to a destination.               | The selected destination. Metadata retrieval is a separate optional step. |
| Sync               | Explicitly approve adding captured videos to a YouTube destination.                                          | YouTube. Sign-in and applicable account-data consent are required.        |

Native menu destination selection changes the next action; it never adds videos itself.
The menu starts from the popup default until a destination is explicitly remembered.
The chooser displays full titles and Local/YouTube status. A missing destination opens
review instead of substituting another playlist. Remote lists are refreshed only when
the user chooses **Load YouTube playlists**, never by opening the native menu.

Tabs remain open by default for native menu captures. The popup retains its separate
close-tabs preference. Closing is limited to newly added, unchanged, unpinned source
tabs after durable success. Duplicate-only and failed operations leave tabs open.

Metadata, including duration badges, can be fetched after IDs are saved. The capture
review offers **Fetch missing titles and durations**, with bounded work and a Stop
control. Existing editor metadata settings and Metadata Manager remain available.
Thumbnail archiving is optional in Settings and needs permission for the existing
thumbnail host. It cannot recover an image that disappeared before it was archived.
