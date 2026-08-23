<script lang="ts">
  import type { Playlist } from "../types/model.js";

  let { playlist, className = "" }: { playlist: Playlist; className?: string } = $props();
</script>

<div class="playlist-count {className}">
  <span>({playlist.videos.length})</span>
</div>

<style>
  .playlist-count {
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    background-color: black;
    color: white;
  }
</style>
