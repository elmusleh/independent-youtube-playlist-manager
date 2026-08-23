<script lang="ts">
  import { onDestroy } from "svelte";
  import Fa from "svelte-fa";
  import { faXmark, faFileLines } from "@fortawesome/free-solid-svg-icons";

  let { display = $bindable(false) }: { display?: boolean } = $props();

  function closeModal() {
    display = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (display && event.key === "Escape") {
      closeModal();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains("modal")) {
      closeModal();
    }
  }

  window.addEventListener("keydown", handleKeydown);

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
</script>

{#if display}
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="release-notes-title"
    tabindex="-1"
    onmousedown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="release-notes-title">
          <Fa icon={faFileLines} fw />
          Release Notes
        </h2>
        <button class="close-btn" onclick={closeModal} aria-label="Close">
          <Fa icon={faXmark} size="lg" />
        </button>
      </div>
      <div class="modal-body">
        <div class="release-notes">
          <h3>All notable changes to this project are documented here.</h3>
          <p>Format follows <a href="https://keepachangelog.com/en/1.0.0/" target="_blank" rel="noopener noreferrer">Keep a Changelog</a>.</p>

          <hr />

          <section>
            <h4>[Unreleased]</h4>
            <h5>Added</h5>
            <ul>
              <li>You can now mark any playlist as a Favorite and add videos to it with a single click from the popup
                <ul><li><em>Technical: Implemented <code>Favorite Playlist ⭐️</code> with automatic recreation if deleted, <code>[FAV]</code> tag in description, and visual gold highlighting in <code>Saved.svelte</code></em></li></ul>
              </li>
              <li>A new "Default Quick Add Target" setting lets you choose which playlist receives videos when using Quick Add
                <ul><li><em>Technical: Added <code>defaultQuickAddTarget</code> setting persisted in <code>browser.storage.local</code>, bound to popup dropdown in <code>Settings.svelte</code></em></li></ul>
              </li>
              <li>Settings and playlist manager now show a visual indicator when changes are auto-saved</li>
              <li>A new "Add to latest" position setting controls whether videos are added to the top or bottom of a playlist</li>
              <li>Full YouTube API integration with OAuth2 authentication — sign in with your Google account to create and manage playlists directly on YouTube
                <ul><li><em>Technical: Added <code>youtube-auth.js</code> and <code>youtube-api.js</code> services injected onto <code>window</code>, with token storage in <code>browser.storage.local</code></em></li></ul>
              </li>
              <li>A new "Max log lines" setting limits how many diagnostic entries are kept in the extension log</li>
              <li>A cloud sync icon now appears when playlists are being synchronised with YouTube</li>
              <li>Playlist creation now suggests a smart default title based on the source content</li>
              <li>Keyboard and screen reader accessibility improved across all interactive controls
                <ul><li><em>Technical: Added ARIA roles, labels, and keyboard event handlers to <code>ToggleSwitch</code>, dropdowns, and action buttons</em></li></ul>
              </li>
              <li>Dynamic context menu items now update based on your current saved playlists — no restart needed</li>
              <li>Playlist opening now falls back gracefully for signed-in users when direct navigation fails</li>
            </ul>
            <h5>Fixed</h5>
            <ul>
              <li>Creating or resetting the Favorite Playlist no longer produces duplicates if triggered more than once
                <ul><li><em>Technical: Made <code>resetOrCreate</code> idempotent by checking for existing <code>[YPH][FAV]</code>-tagged playlists before creating</em></li></ul>
              </li>
              <li>Favorite Playlist now persists correctly across browser sessions and works fully offline</li>
              <li>Favorite Playlist entry appears in the UI immediately after creation without requiring a page refresh</li>
              <li>The sort dropdown in the Saved view no longer gets clipped by the card container</li>
              <li>Confirmation dialogs now appear before destructive actions to prevent accidental data loss</li>
              <li>YouTube API error handling improved — invalid or overly long playlist titles now show a clear message</li>
            </ul>
            <h5>Changed</h5>
            <ul>
              <li>The popup has been redesigned with a consolidated Quick Add workflow — adding a video now takes fewer taps
                <ul><li><em>Technical: Merged separate "Add" and "Quick Add" paths into a single flow in <code>popup/</code></em></li></ul>
              </li>
              <li>Playlist card titles in the Saved view are now consistent in length and truncation style</li>
              <li>The Settings page layout now wraps dynamically based on screen width instead of using a fixed grid</li>
              <li>All playlists (both YPH-managed and unmanaged) are now shown in a single unified Saved view with a clear managed badge
                <ul><li><em>Technical: <code>Saved.svelte</code> unified view replaces the separate managed/all-playlists split; unmanaged playlists show a wrench badge</em></li></ul>
              </li>
              <li>Offline playlists and YouTube-synced playlists are now kept in sync via a hybrid storage model
                <ul><li><em>Technical: <code>storage-service</code> now maintains a local cache with TTL and a YouTube-side source of truth, merged on load</em></li></ul>
              </li>
              <li>The "close tabs after adding" setting has been renamed for clarity</li>
              <li>The standalone editor module has been removed in favour of the unified playlist view
                <ul><li><em>Technical: <code>editor/</code> route and module deleted; all editing now done via <code>PlaylistEditor.svelte</code> in the SPA</em></li></ul>
              </li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[2.12.2] - 2023-11-22</h4>
            <h5>Fixed</h5>
            <ul><li>Converting a playlist to a queue no longer fails intermittently</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.12.1] - 2023-09-02</h4>
            <h5>Added</h5>
            <ul><li>Dark mode support for the popup</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.12.0] - 2023-09-02</h4>
            <h5>Added</h5>
            <ul>
              <li>Full dark mode support across the extension UI</li>
              <li>Option to disable context menus from the settings page</li>
              <li>Redesigned options and settings page</li>
            </ul>
            <h5>Changed</h5>
            <ul><li>Notification design updated across the editor and settings pages</li></ul>
            <h5>Removed</h5>
            <ul><li>Recent playlists panel removed (superseded by the Saved playlists view)</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.11.2] - 2023-08-19</h4>
            <h5>Added</h5>
            <ul><li>Upgraded to Svelte 4 for improved performance and future compatibility</li></ul>
            <h5>Changed</h5>
            <ul><li>Page size options and bookmark folder name handling improved</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.11.0] - 2023-08-06</h4>
            <h5>Added</h5>
            <ul>
              <li>Sort and filter playlists in the Saved view</li>
              <li>Search playlists in the Saved view</li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[2.10.0] - 2023-07-30</h4>
            <h5>Added</h5>
            <ul><li>Right-click context menu option to add a video directly to a saved playlist</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.9.0] - 2022-10-28</h4>
            <h5>Added</h5>
            <ul>
              <li>Export, import, and delete saved playlists</li>
              <li>Remove duplicate videos from the playlist editor</li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[2.7.0] - 2022-04-03</h4>
            <h5>Added</h5>
            <ul>
              <li>Option to choose how a playlist is saved after creation</li>
              <li>Option to disable auto-opening the playlist builder after adding videos</li>
            </ul>
            <h5>Fixed</h5>
            <ul><li>Page now reloads correctly after reversing a playlist</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.6.2] - 2022-01-02</h4>
            <h5>Fixed</h5>
            <ul><li>Playlist builder context menu now works correctly on Firefox</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.6.1] - 2022-01-02</h4>
            <h5>Added</h5>
            <ul>
              <li>Support for YouTube queues (actions on the currently playing playlist)</li>
              <li>Option to open the editor after saving or creating a playlist</li>
              <li>Custom page size selector in the playlist editor</li>
              <li>Pagination support in the playlist editor</li>
            </ul>
            <h5>Fixed</h5>
            <ul><li>Drag-and-drop reordering in the playlist editor now works reliably</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.5.2] - 2021-10-24</h4>
            <h5>Fixed</h5>
            <ul><li>YouTube URL pattern matching made more resilient</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.5.1] - 2021-10-23</h4>
            <h5>Fixed</h5>
            <ul><li>Creating playlists from bookmarks now works correctly on Firefox</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.4.1] - 2021-09-12</h4>
            <h5>Changed</h5>
            <ul><li>Video metadata is now fetched via noembed for better reliability</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.4.0] - 2021-08-26</h4>
            <h5>Added</h5>
            <ul>
              <li>Scan the current browser tab for YouTube links and create a playlist from them</li>
              <li>Convert the current YouTube playlist tab into a YouTube queue</li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[2.3.0] - 2021-07-31</h4>
            <h5>Added</h5>
            <ul>
              <li>Option to choose which page the editor opens on at startup</li>
              <li>Option to disable thumbnail previews in the playlist editor and selector</li>
            </ul>
            <h5>Fixed</h5>
            <ul>
              <li>Duplicate videos no longer appear when saving a playlist from a queue</li>
              <li>Video data loading optimised using oEmbed to reduce API calls</li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[2.2.0] - 2021-06-22</h4>
            <h5>Added</h5>
            <ul><li>Reverse playlist button in the playlist editor</li></ul>
            <h5>Changed</h5>
            <ul><li>Editor animations improved</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.1.2] - 2021-06-06</h4>
            <h5>Added</h5>
            <ul><li>Confirmation prompt before deleting a playlist</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.1.1] - 2021-05-23</h4>
            <h5>Fixed</h5>
            <ul>
              <li>Playlist editor loading issue resolved</li>
              <li>Video data now loads only once per session for faster performance</li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[2.1.0] - 2021-05-16</h4>
            <h5>Added</h5>
            <ul><li>Export and import videos to/from a playlist (JSON format)</li></ul>
          </section>

          <hr />

          <section>
            <h4>[2.0.0] - 2021-05-03</h4>
            <h5>Added</h5>
            <ul>
              <li>Full playlist editor: create, edit, reorder, and delete videos</li>
              <li>Persistent playlist storage — playlists are saved across sessions</li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[1.5.0] - 2021-03-08</h4>
            <h5>Added</h5>
            <ul>
              <li>Combine all open YouTube tabs into a single playlist</li>
              <li>Option to automatically close tabs after a playlist is created</li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[1.4.0] - 2021-02-19</h4>
            <h5>Changed</h5>
            <ul><li>Playlist tabs are now excluded by default when building playlists (option to include them still available)</li></ul>
          </section>

          <hr />

          <section>
            <h4>[1.3.0] - 2020-07-19</h4>
            <h5>Added</h5>
            <ul>
              <li>Create a playlist from YouTube video thumbnails on the current page</li>
              <li>Automatically splits into multiple playlists when a playlist would exceed 50 videos</li>
            </ul>
          </section>

          <hr />

          <section>
            <h4>[1.2.1] - 2020-07-04</h4>
            <h5>Fixed</h5>
            <ul><li>YouTube URL Regex fix for edge cases</li></ul>
          </section>

          <hr />

          <section>
            <h4>[1.2.0] - 2020-06-20</h4>
            <h5>Added</h5>
            <ul><li>Create a playlist from all currently open YouTube tabs</li></ul>
          </section>

          <hr />

          <section>
            <h4>[1.1.1] - 2020-05-09</h4>
            <h5>Fixed</h5>
            <ul><li>Settings page compatibility fix for Chrome</li></ul>
          </section>

          <hr />

          <section>
            <h4>[1.1.0] - 2020-05-08</h4>
            <h5>Added</h5>
            <ul><li>Settings page to customise the extension's default opening page</li></ul>
          </section>

          <hr />

          <section>
            <h4>[1.0.2] - 2020-04-23</h4>
            <h5>Changed</h5>
            <ul><li>Bookmark folders now list parent folders before children for clearer structure</li></ul>
          </section>

          <hr />

          <section>
            <h4>[1.0.1] - 2020-04-09</h4>
            <h5>Fixed</h5>
            <ul><li>Popup menu sizing improved for Firefox</li></ul>
          </section>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.6);
  }

  .modal-content {
    background-color: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 90%;
    max-width: 700px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-color);
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease;
  }

  .close-btn:hover {
    background-color: var(--hover-color);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .release-notes {
    font-size: 14px;
    color: var(--text-color);
    line-height: 1.6;
  }

  .release-notes h3 {
    font-size: 14px;
    font-weight: 400;
    color: var(--text-muted);
    margin: 0 0 8px 0;
  }

  .release-notes p {
    margin: 0 0 8px 0;
    color: var(--text-muted);
  }

  .release-notes a {
    color: #3ea6ff;
    text-decoration: none;
  }

  .release-notes a:hover {
    text-decoration: underline;
  }

  .release-notes hr {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 20px 0;
  }

  .release-notes section {
    margin-bottom: 8px;
  }

  .release-notes h4 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 12px 0;
  }

  .release-notes h5 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
    margin: 12px 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .release-notes ul {
    margin: 0;
    padding-left: 20px;
    list-style-type: disc;
  }

  .release-notes li {
    margin-bottom: 6px;
  }

  .release-notes li ul {
    margin-top: 4px;
    list-style-type: circle;
  }

  .release-notes code {
    background-color: var(--hover-color);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
  }

  .release-notes em {
    color: var(--text-muted);
    font-style: italic;
  }

  @media (max-width: 600px) {
    .modal-content {
      width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
    }

    .release-notes {
      font-size: 13px;
    }
  }
</style>
