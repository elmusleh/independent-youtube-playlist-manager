<script lang="ts">
  import PlaylistEditor from "../components/PlaylistEditor.svelte";
  import ErrorState from "../components/ErrorState.svelte";
  import type { Playlist } from "../types/model";

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
      // Rendering the builder must not wait for external metadata providers.
      playlist = {
        id: `local-builder-${crypto.randomUUID()}`,
        title: "Playlist Builder",
        videos: toIds(ids),
        timestamp: Date.now(),
        isLocal: true,
      };
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
