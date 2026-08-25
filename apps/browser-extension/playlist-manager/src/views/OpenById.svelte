<script lang="ts">
  import Fa from "svelte-fa";
  import { faLink, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";

  let idOrUrl = $state("");

  function extractId(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";

    // Check if it's a URL
    try {
      const url = new URL(trimmed);
      if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
        // Playlist ID
        const listId = url.searchParams.get("list");
        if (listId) return listId;

        // Video ID (not a playlist, but editor handles it)
        const vId = url.searchParams.get("v");
        if (vId) return vId;

        // short URL youtu.be/VIDEO_ID
        if (url.hostname === "youtu.be") {
          return url.pathname.slice(1);
        }
      }
    } catch (e) {
      // Not a URL, assume it's an ID
    }

    return trimmed;
  }

  function handleOpen() {
    const id = extractId(idOrUrl);
    if (!id) {
      window.error("Please enter a valid Playlist ID or YouTube URL");
      return;
    }

    const base = location.href.split("#")[0].split("?")[0];
    location.href = `${base}?id=${encodeURIComponent(id)}#/editor`;
  }
</script>

<main class="view-scroll-container">
  <div class="view-body">
    <StickyHeader>
      {#snippet children()}
        <ViewHeader icon={faLink} title="Open by ID" />
      {/snippet}
    </StickyHeader>

    <p class="sub-text">
      Enter a YouTube Playlist ID, Video ID, or URL to open it directly in the editor.
    </p>

    <div class="input-container">
      <div class="field">
        <input
          type="text"
          bind:value={idOrUrl}
          placeholder="e.g. PLxxxxx or https://www.youtube.com/playlist?list=..."
          onkeydown={(e) => e.key === "Enter" && handleOpen()}
        />
      </div>
      <button class="action-btn primary" onclick={handleOpen}>
        <Fa icon={faArrowUpRightFromSquare} fw />
        Open in Editor
      </button>
    </div>

    <div class="info-box">
      <h3>Pro Tip</h3>
      <p>
        You can also open videos! If you paste a video URL, the editor will load just that video,
        allowing you to quickly add it to a playlist.
      </p>
    </div>
  </div>
</main>

<style>
  @import "../css/view-layout.css";

  .sub-text {
    opacity: 0.7;
    margin-bottom: 32px;
  }

  .input-container {
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field input {
    width: 100%;
    height: 48px;
    padding: 0 16px;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-color);
    font-size: 16px;
  }

  .action-btn {
    height: 48px;
    padding: 0 24px;
    border-radius: 24px;
    border: none;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    background: #3ea6ff;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: background-color 0.2s;
  }

  .action-btn:hover {
    background: #2d8fe5;
  }

  .info-box {
    margin-top: 48px;
    padding: 24px;
    background: rgba(62, 166, 255, 0.05);
    border-radius: 16px;
    border-left: 4px solid #3ea6ff;
    max-width: 600px;
  }

  .info-box h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: #3ea6ff;
  }

  .info-box p {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    opacity: 0.8;
  }
</style>
