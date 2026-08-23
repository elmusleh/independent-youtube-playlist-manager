import re

with open("playlist-editor/src/views/Settings.svelte", "r") as f:
    content = f.read()

# 1. Remove savedTimeout declaration
content = re.sub(r'let savedTimeout: ReturnType<typeof setTimeout> \| null = null;\n', '', content)

# 2. Add new state variables
new_vars = """
  let selectedFavoriteId: string | null = null;
  let showNamePrompt = false;
  let newPlaylistName = "";

  window.getSettings().then((s) => {
    settings = s;
    lastSaved = Date.now();
  });

  $: if (settings && !loadingPlaylists && selectedFavoriteId === null && settings.watchLaterPlaylistId !== undefined) {
    selectedFavoriteId = settings.watchLaterPlaylistId;
  }

"""
content = re.sub(r'window\.getSettings\(\)\.then\(\(s\) => \(settings = s\)\);\n', new_vars, content)

# 3. Replace Derived state for Favorite Playlist
derived_state_pattern = r'  // Derived state for the Favorite Playlist section.*?(?=  function handleRuntimeMessage)'
new_methods = """  async function handleFavoriteAction() {
    if (selectedFavoriteId === settings?.watchLaterPlaylistId) return;

    if (selectedFavoriteId === CREATE_NEW) {
      newPlaylistName = "";
      showNamePrompt = true;
    } else {
      await save("watchLaterPlaylistId", selectedFavoriteId, () => {
        window.invalidateCacheAndNotify();
        window.success("Favorite target updated");
        if (settings) settings.watchLaterPlaylistId = selectedFavoriteId;
      });
    }
  }

  async function confirmCreatePlaylist() {
    const title = newPlaylistName.trim();
    if (!title) return;
    
    saving = true;
    showNamePrompt = false;
    try {
      const newId = await window.savePlaylist({
        id: "",
        title: title,
        videos: [],
        timestamp: Date.now(),
        isLocal: true,
        saved: true
      }, { syncToYoutube: false });

      if (settings) settings.watchLaterPlaylistId = newId;
      selectedFavoriteId = newId;
      
      await save("watchLaterPlaylistId", newId, () => {
        window.invalidateCacheAndNotify();
      });
      await loadPlaylists();
      window.success(`Created and set favorite: ${title}`);
    } catch (e) {
      console.error(e);
      window.error("Failed to create favorite playlist");
    } finally {
      saving = false;
    }
  }

"""
content = re.sub(derived_state_pattern, new_methods, content, flags=re.DOTALL)

# 4. Remove onDestroy logic about savedTimeout (Wait, the original code doesn't have savedTimeout in onDestroy, it only removes runtime message listener)

# 5. Fix save function
save_fn_pattern = r'  async function save\(key: keyof Settings, value: any, onDone\?: \(\) => void\) \{[\s\S]*?    \} finally \{\s*saving = false;\s*\}\s*\}'
new_save_fn = """  async function save(key: keyof Settings, value: any, onDone?: () => void) {
    saving = true;
    try {
      await window.storeObject(key as string, value);
      if (onDone) onDone();
      lastSaved = Date.now();
    } catch (e) {
      console.error("Failed to save setting:", e);
    } finally {
      saving = false;
    }
  }"""
content = re.sub(save_fn_pattern, new_save_fn, content)

# 6. Remove ensureWL and requestRestoreFavorite
content = re.sub(r'  async function ensureWL\(force = false\) \{[\s\S]*?  function requestRestoreFavorite\(\) \{[\s\S]*?    \}\);\s*\}', '', content)

# 7. Update select in HTML
select_pattern = r'<select\s+id="watchLaterPlaylist"\s+bind:value=\{settings\.watchLaterPlaylistId\}\s+disabled=\{saving\}\s+on:change=\{[\s\S]*?\}\s*>\s*<option value=\{CREATE_NEW\}>✚ Create new managed playlist\.\.\.</option>\s*<option value=\{null\}>YouTube Native \(Watch Later\)</option>\s*\{#each playlists as playlist\}\s*<option value=\{playlist\.id\}>\{playlist\.title\}</option>\s*\{/each\}\s*</select>\s*\{#if settings\.watchLaterPlaylistId === null\}[\s\S]*?\{/if\}'

new_select = """<select
              id="watchLaterPlaylist"
              bind:value={selectedFavoriteId}
              disabled={saving}
            >
              <option value={CREATE_NEW}>✚ Create new managed playlist...</option>
              <option value={null}>YouTube Native (Watch Later)</option>
              {#each playlists as playlist}
                <option value={playlist.id}>{playlist.title}</option>
              {/each}
            </select>

            {#if selectedFavoriteId !== settings.watchLaterPlaylistId}
              <div class="favorite-action-container">
                <SimpleButton
                  on:click={handleFavoriteAction}
                  disabled={saving}
                  title="Apply new favorite playlist target"
                >
                  {selectedFavoriteId === CREATE_NEW ? "Create New Playlist" : (selectedFavoriteId === null ? "Use YouTube Native" : "Set as Favorite")}
                </SimpleButton>
              </div>
            {/if}"""
content = re.sub(select_pattern, new_select, content)

# 8. Add Modal UI at the bottom of <main>
modal_ui = """
  {#if showNamePrompt}
    <div class="modal-overlay" on:mousedown|self={() => showNamePrompt = false} role="presentation">
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title">Enter Playlist Name</h3>
        <div class="field" style="margin: 20px 0;">
          <input type="text" bind:value={newPlaylistName} placeholder="e.g. My Favorites" autofocus />
        </div>
        <div class="actions">
          <SimpleButton secondary on:click={() => showNamePrompt = false}>Cancel</SimpleButton>
          <SimpleButton on:click={confirmCreatePlaylist} disabled={!newPlaylistName.trim()}>Confirm</SimpleButton>
        </div>
      </div>
    </div>
  {/if}
</main>"""
content = content.replace("</main>", modal_ui)

# 9. Add modal styles
styles = """
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  .modal-content {
    background: var(--background-color);
    padding: 24px;
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-color);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }
  .favorite-action-container {
    margin-top: 8px;
  }
</style>"""
content = content.replace("</style>", styles)

with open("playlist-editor/src/views/Settings.svelte", "w") as f:
    f.write(content)

