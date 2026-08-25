<script lang="ts">
  import { push } from "svelte-spa-router";
  import SimpleButton from "./SimpleButton.svelte";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import type { Settings } from "../types/model.js";
  import { requestConfirm } from "../stores/confirmation.js";
  import Fa from "svelte-fa";
  import { faStar, faInfoCircle, faCircleCheck } from "@fortawesome/free-solid-svg-icons";
  import { StatusManager } from "../services/status-manager.svelte";
  import { logger } from "../services/logger";

  const {
    settings,
    save,
    status,
    signedIn,
  }: {
    settings: Settings | null;
    save: (key: string, value: unknown, onDone?: () => void) => Promise<void>;
    status: StatusManager;
    signedIn: boolean;
  } = $props();

  const CREATE_NEW = "__create_new__";

  let playlists: YtPlaylistInfoExtended[] = $state([]);
  let loadingPlaylists = $state(false);
  let selectedFavoriteId: string | null = $state(null);
  let showNamePrompt = $state(false);
  let showYtNativeInfo = $state(false);
  let newPlaylistName = $state("");
  let initialized = $state(false);

  $effect(() => {
    if (
      settings &&
      !loadingPlaylists &&
      !initialized &&
      settings?.watchLaterPlaylistId !== undefined
    ) {
      selectedFavoriteId = settings?.watchLaterPlaylistId ?? null;
      initialized = true;
    }
  });

  async function loadPlaylists() {
    loadingPlaylists = true;
    if (window.logSystemEvent)
      await window.logSystemEvent("INFO", "[SETTINGS] Loading playlists for favorite selection");
    try {
      playlists = await window.getAccountPlaylists();
      if (window.logSystemEvent)
        await window.logSystemEvent("INFO", `[SETTINGS] Loaded ${playlists.length} playlists`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error("Failed to load playlists:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[SETTINGS] Failed to load playlists: ${errMsg}`);
    } finally {
      loadingPlaylists = false;
    }
  }

  loadPlaylists();

  function onFavoriteSelectChange() {
    if (selectedFavoriteId === null && !signedIn) {
      showYtNativeInfo = true;
    }
  }

  async function handleFavoriteAction() {
    if (selectedFavoriteId === settings?.watchLaterPlaylistId) return;

    if (selectedFavoriteId === CREATE_NEW) {
      newPlaylistName = "";
      showNamePrompt = true;
    } else if (selectedFavoriteId === null) {
      if (!signedIn) {
        showYtNativeInfo = true;
      } else {
        await saveFavorite(null);
      }
    } else {
      await saveFavorite(selectedFavoriteId);
    }
  }

  async function saveFavorite(id: string | null) {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        `[SETTINGS] Saving favorite playlist: ${id ?? "YouTube Native"}`
      );
    await save("watchLaterPlaylistId", id, () => {
      window.invalidateCacheAndNotify();
      window.success("Favorite target updated");
      if (settings) settings!.watchLaterPlaylistId = id;
    });
  }

  async function confirmCreatePlaylist() {
    const title = newPlaylistName.trim();
    if (!title) return;

    showNamePrompt = false;
    await status.save(async () => {
      const newId = await window.savePlaylist(
        {
          id: "",
          title: title,
          videos: [],
          timestamp: Date.now(),
          isLocal: true,
          saved: true,
        },
        { syncToYoutube: false }
      );

      if (settings) settings!.watchLaterPlaylistId = newId;
      selectedFavoriteId = newId;

      await window.storeObject("watchLaterPlaylistId", newId);
      window.invalidateCacheAndNotify();
      await loadPlaylists();
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[SETTINGS] Created and set favorite: "${title}" (${newId})`
        );
      window.success(`Created and set favorite: ${title}`);
    });
  }

  async function checkSignIn() {
    try {
      // This is handled by the parent via the signedIn prop
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error("[SETTINGS] checkSignIn failed:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[SETTINGS] checkSignIn failed: ${errMsg}`);
    }
  }

  function focusEl(node: HTMLElement) {
    node.focus();
  }
</script>

<!-- Favorite Playlist -->
<section class="card">
  <h3><Fa icon={faStar} /> Favorite Playlist</h3>
  <div class="field">
    <label for="watchLaterPlaylist">Target Playlist</label>
    <p class="sub-text">
      Pick a managed playlist to be your favorite. It will always be kept alive (recreated if
      deleted) and is used for quick-add shortcuts.
    </p>
    {#if settings!.watchLaterPlaylistId === null && !signedIn}
      <div class="status-warning">
        <Fa icon={faInfoCircle} />
        <span>Sign-in required for YouTube Native</span>
      </div>
    {/if}
    {#if loadingPlaylists}
      <p class="loading">Loading playlists...</p>
    {:else}
      <select
        id="watchLaterPlaylist"
        bind:value={selectedFavoriteId}
        disabled={status.saving}
        onchange={onFavoriteSelectChange}
      >
        <option value={CREATE_NEW}>✚ Create new managed playlist...</option>
        <option value={null}>YouTube Native (Watch Later)</option>
        {#each playlists as playlist}
          <option value={playlist.id}>{playlist.title}</option>
        {/each}
      </select>

      <div class="favorite-action-container">
        <SimpleButton
          className="btn-full-width"
          primary={selectedFavoriteId !== settings?.watchLaterPlaylistId}
          secondary={selectedFavoriteId === settings?.watchLaterPlaylistId}
          onclick={handleFavoriteAction}
          disabled={status.saving || selectedFavoriteId === settings?.watchLaterPlaylistId}
          title="Apply favorite playlist target"
        >
          {#if selectedFavoriteId === settings?.watchLaterPlaylistId}
            <Fa icon={faCircleCheck} /> Current Favorite
          {:else if selectedFavoriteId === CREATE_NEW}
            Create New Playlist
          {:else if selectedFavoriteId === null}
            Use YouTube Native
          {:else}
            Set as Favorite
          {/if}
        </SimpleButton>
      </div>
    {/if}
  </div>
</section>

{#if showNamePrompt}
  <div
    class="modal-overlay"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) showNamePrompt = false;
    }}
    role="presentation"
  >
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h3 id="modal-title">Enter Playlist Name</h3>
      <div class="field" style="margin: 20px 0;">
        <input
          aria-label="New playlist name"
          type="text"
          bind:value={newPlaylistName}
          placeholder="e.g. My Favorites"
          use:focusEl
        />
      </div>
      <div class="actions">
        <SimpleButton secondary onclick={() => (showNamePrompt = false)}>Cancel</SimpleButton>
        <SimpleButton primary onclick={confirmCreatePlaylist} disabled={!newPlaylistName.trim()}
          >Confirm</SimpleButton
        >
      </div>
    </div>
  </div>
{/if}

{#if showYtNativeInfo}
  <div
    class="modal-overlay"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) showYtNativeInfo = false;
    }}
    role="presentation"
  >
    <div
      class="modal-content info-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yt-native-title"
    >
      <h3 id="yt-native-title">
        <Fa icon={faInfoCircle} /> YouTube Native Info
      </h3>
      <p class="modal-body">
        "YouTube Native" uses your account's official <strong>Watch Later</strong> playlist directly.
        This requires you to be signed in and cannot be managed by the extension.
      </p>
      <div class="actions">
        <SimpleButton
          secondary
          onclick={() => {
            showYtNativeInfo = false;
            selectedFavoriteId = settings?.watchLaterPlaylistId ?? null;
          }}>Cancel</SimpleButton
        >
        <SimpleButton
          primary
          onclick={async () => {
            showYtNativeInfo = false;
            try {
              await window.signIn();
              await checkSignIn();
              if (await window.isSignedIn()) {
                await saveFavorite(null);
              }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              const code = (e as any)?.code;
              if (code === "credentials_missing") {
                if (window.info) window.info("Please fill in your API credentials first.");
                push("/api-setup");
              } else {
                logger.error("Sign in failed", e);
                if (window.logSystemEvent)
                  await window.logSystemEvent(
                    "ERROR",
                    `[SETTINGS] Modal sign-in failed: ${errMsg}`
                  );
                if (window.error) window.error("Sign-in failed. Please try again.");
              }
            }
          }}>Sign In</SimpleButton
        >
      </div>
    </div>
  </div>
{/if}
