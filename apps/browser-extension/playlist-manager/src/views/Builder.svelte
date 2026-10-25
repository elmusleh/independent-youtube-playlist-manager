<script lang="ts">
  import PlaylistEditor from "../components/PlaylistEditor.svelte";
  import ErrorState from "../components/ErrorState.svelte";
  import type { Playlist } from "../types/model";

  let playlist = $state<Playlist>();
  let error = $state("");
  async function load() {
    try {
      error = "";
      const api = window.browser || window.chrome;
      const ids = await api.runtime.sendMessage({ cmd: "get-playlist-builder" });
      playlist = await window.videoService.generatePlaylist(
        [...new Set<string>(Array.isArray(ids) ? ids : [])],
        "Playlist Builder"
      );
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  load();
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
