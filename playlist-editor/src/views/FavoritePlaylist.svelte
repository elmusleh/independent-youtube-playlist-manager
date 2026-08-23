<script lang="ts">
  import { faStar } from "@fortawesome/free-solid-svg-icons";
  import PlaylistLoader from "../components/PlaylistLoader.svelte";
</script>

<PlaylistLoader 
  isFavorite={true} 
  pageIcon={faStar} 
  pageTitle="Favorite Playlist" 
/>