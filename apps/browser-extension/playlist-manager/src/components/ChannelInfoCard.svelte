<script lang="ts">
  import Fa from "svelte-fa";
  import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
  import { logger } from "../services/logger";

  let { signedIn = false }: { signedIn?: boolean } = $props();

  let myChannelLoading = $state(false);
  let myChannelInfo: Record<string, any> | null = $state(null);
  let myChannelError = $state("");
  let myChannelLoaded = $state(false);

  async function loadMyChannel() {
    if (myChannelLoading || myChannelLoaded) return;
    myChannelLoading = true;
    myChannelError = "";
    try {
      const params = new URLSearchParams({
        part: "snippet,statistics,contentDetails",
        mine: "true",
      });
      const data = await (window as any).ytFetch(`/channels?${params}`);
      myChannelInfo = data.items?.[0] || null;
      myChannelLoaded = true;

      if (!myChannelInfo) {
        myChannelError = "Could not find your channel information.";
      }
    } catch (e) {
      logger.error("Failed to load channel info:", e);
      myChannelError = "Failed to load channel information.";
    } finally {
      myChannelLoading = false;
    }
  }

  async function resetAndLoad() {
    myChannelLoaded = false;
    await loadMyChannel();
  }

  $effect(() => {
    if (signedIn && !myChannelLoaded) {
      loadMyChannel();
    }
    if (!signedIn) {
      myChannelInfo = null;
      myChannelLoaded = false;
      myChannelError = "";
    }
  });
</script>

<div class="my-channel-section">
  {#if myChannelLoading}
    <div class="channel-loading">Loading channel info...</div>
  {:else if myChannelError}
    <div class="channel-error">
      <p>{myChannelError}</p>
      <button class="retry-btn" onclick={resetAndLoad}>Retry</button>
    </div>
  {:else if myChannelInfo}
    <div class="channel-info">
      <div class="channel-header">
        <img
          src={myChannelInfo.snippet.thumbnails?.medium?.url}
          alt={myChannelInfo.snippet.title}
          class="channel-avatar"
        />
        <div class="channel-meta">
          <h3>{myChannelInfo.snippet.title}</h3>
          <p class="handle">{myChannelInfo.snippet.customUrl}</p>
          <a
            href="https://youtube.com/{myChannelInfo.snippet.customUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="yt-link"
          >
            View on YouTube <Fa icon={faArrowUpRightFromSquare} size="xs" />
          </a>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .my-channel-section {
    padding: 16px;
    border-top: 1px solid var(--border-color);
  }

  .channel-loading,
  .channel-error {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
  }

  .channel-error p {
    margin-bottom: 8px;
  }

  .retry-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  .channel-info {
    background: var(--background-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .channel-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .channel-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
  }

  .channel-meta h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .channel-meta .handle {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .yt-link {
    color: #3ea6ff;
    text-decoration: none;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .yt-link:hover {
    text-decoration: underline;
  }
</style>
