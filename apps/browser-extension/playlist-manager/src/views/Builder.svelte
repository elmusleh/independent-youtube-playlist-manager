<script lang="ts">
  import { onDestroy } from "svelte";
  import PlaylistEditor from "../components/PlaylistEditor.svelte";
  import ErrorState from "../components/ErrorState.svelte";
  import type { Playlist } from "../types/model";

  // Mirrors playlistBuilderId in apps/browser-extension/background/utils.js. Kept as a
  // literal so the editor bundle does not import from outside its own root.
  const BUILDER_STORAGE_KEY = "yphPlaylistBuilder";

  let playlist = $state<Playlist>();
  let error = $state("");

  function toIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0)),
    ];
  }

  async function load() {
    try {
      error = "";
      const api = window.browser || window.chrome;
      const ids = await api.runtime.sendMessage({ cmd: "get-playlist-builder" });
      const generated = await window.videoService.generatePlaylist(toIds(ids), "Playlist Builder");
      // A builder playlist is not a YouTube playlist. generatePlaylist() hands out a
      // timestamp id and PlaylistEditor derives isLocal from the "local-" prefix, so
      // without this override saving would call ytUpdatePlaylist() for an id that has
      // never existed on YouTube, and the save would fail.
      playlist = { ...generated, id: `local-builder-${Date.now()}`, isLocal: true };
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  load();

  // Quick-add appends to the builder list straight from the background script. Without
  // this subscription an already-open builder never sees those videos, and saving would
  // clear the stored list, silently discarding them.
  function handleBuilderStorageChange(
    changes: Record<string, { newValue?: unknown }>,
    area: string
  ) {
    if (area !== "local" && area !== "sync") return;
    const change = changes[BUILDER_STORAGE_KEY];
    if (!change || !playlist) return;
    const stored = toIds(change.newValue);
    if (stored.length === 0) return; // cleared after a save — nothing to merge
    const known = new Set(playlist.videos);
    const added = stored.filter((id) => !known.has(id));
    if (added.length > 0) playlist.videos = [...playlist.videos, ...added];
  }

  browser.storage.onChanged.addListener(handleBuilderStorageChange);
  onDestroy(() => browser.storage.onChanged.removeListener(handleBuilderStorageChange));
</script>

<main class="view-scroll-container">
  {#if error}
    <ErrorState message={error} onRetry={load} />
  {:else if playlist}
    <PlaylistEditor {playlist} isPlaylistBuilder={true} pageTitle="Playlist Builder" />
  {:else}
    <p role="status">Loading playlist builder…</p>
  {/if}
</main>
