<script lang="ts">
  import { faPenToSquare } from "@fortawesome/free-solid-svg-icons";
  import PlaylistLoader from "../components/PlaylistLoader.svelte";

  function getParam(name: string): string | null {
    const url = new URL(document.URL);
    // Check hash-based SPA query params first (current navigation)
    if (url.hash.includes("?")) {
      const hashSearch = url.hash.split("?")[1];
      const val = new URLSearchParams(hashSearch).get(name);
      if (val) return val;
    }
    // Fallback to actual URL search params (legacy pre-hash support)
    return url.searchParams.get(name);
  }

  let playlistId = $derived(getParam("id"));
</script>

{#if playlistId}
  <PlaylistLoader 
    id={playlistId} 
    pageIcon={faPenToSquare} 
    pageTitle="Edit Playlist" 
  />
{:else}
  <p style="text-align: center; padding: 40px; color: var(--text-muted);">
    Internal Error: No playlist ID provided.
  </p>
{/if}
