<script lang="ts">
  import Fa from "svelte-fa";
  import { faCirclePlus } from "@fortawesome/free-solid-svg-icons";
  import PlaylistEditor from "../components/PlaylistEditor.svelte";

  async function newPlaylist() {
    try {
      if (window.logSystemEvent)
        await window.logSystemEvent("INFO", "[NEW-VIEW] Creating new playlist");
      let playlist = await window.videoService.generatePlaylist();
      const now = new Date();
      const defaultTitle =
        now.toLocaleDateString() +
        " " +
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[NEW-VIEW] New playlist created with title: ${defaultTitle}`
        );
      return { ...playlist, title: defaultTitle };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[NEW-VIEW] Failed to create new playlist:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent("ERROR", `[NEW-VIEW] Failed to create new playlist: ${errMsg}`);
      throw e;
    }
  }
  const playlistAsync = newPlaylist();
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<main class="view-scroll-container">
  {#await playlistAsync then playlist}
    <PlaylistEditor
      {playlist}
      editingTitle={true}
      pageTitle="New Playlist"
      pageIcon={faCirclePlus}
    />
  {:catch error}
    <div class="error-container">
      <div class="error-icon">
        <Fa icon={faCirclePlus} />
      </div>
      <h2>Failed to create playlist</h2>
      <p>{error.message || "Unknown error"}</p>
    </div>
  {/await}
</main>

<style>
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .error-icon {
    font-size: 48px;
    color: var(--text-muted);
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .error-container h2 {
    margin: 0 0 0.5rem 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color);
  }

  .error-container p {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
