<script lang="ts">
  import Fa from "svelte-fa";
  import { faUsers } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../components/SimpleButton.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import SkeletonCard from "../components/SkeletonCard.svelte";
  import AuthPlaceholder from "../components/AuthPlaceholder.svelte";
  import ViewHeader from "../components/ViewHeader.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import ErrorState from "../components/ErrorState.svelte";
  import { playlistsSearch } from "../stores/playlists-filters";
  import { faYoutube } from "@fortawesome/free-brands-svg-icons";

  let signedIn = $state(false);
  let loading = $state(true);
  let errorMessage = $state("");
  const status = new StatusManager();
  let subscriptions: { channelId: string; title: string; thumbnail: string }[] = $state([]);

  async function checkAuth() {
    signedIn = await window.isSignedIn();
    if (signedIn) {
      loadData();
    } else {
      loading = false;
    }
  }

  async function loadData() {
    loading = true;
    errorMessage = "";
    try {
      subscriptions = await window.getAccountSubscriptions();
    } catch (e) {
      console.error("Failed to load Subscriptions:", e);
      errorMessage = "Failed to load subscriptions. Please try again.";
      window.error("Failed to load Subscriptions");
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    await status.refresh(async () => {
      await loadData();
    });
  }

  let displayedSubscriptions = $derived(
    subscriptions.filter(
      (s) => !$playlistsSearch || s.title.toLowerCase().includes($playlistsSearch.toLowerCase())
    )
  );

  checkAuth();
</script>

<main>
  <div class="view-header">
    <div class="top-left">
      <ViewHeader icon={faUsers} title="Subscriptions" count={subscriptions.length} />
    </div>
    <div class="btn-group right-align">
      <SaveStatus onclick={refresh} {status} title="Refresh" />
    </div>
  </div>

  <div class="view-body">
    {#if !signedIn}
      <AuthPlaceholder />
    {:else if loading}
      <div class="playlist-grid">
        {#each Array(6) as _}
          <SkeletonCard />
        {/each}
      </div>
    {:else if errorMessage}
      <ErrorState message={errorMessage} onRetry={loadData} showSettings={true} />
    {:else if displayedSubscriptions.length === 0}
      <EmptyState icon={faUsers} title="No Subscriptions" message="No subscriptions found." />
    {:else}
      <div class="playlist-grid">
        {#each displayedSubscriptions as sub (sub.channelId)}
          <div class="playlist-card channel-card">
            <div class="playlist-thumbnail circular">
              {#if sub.thumbnail}
                <img src={sub.thumbnail} alt={sub.title} class="thumbnail-img" />
              {/if}
            </div>
            <div class="playlist-details">
              <div class="playlist-title centered">{sub.title}</div>
              <div class="playlist-actions">
                <SimpleButton
                  secondary
                  onclick={() =>
                    window.open(`https://www.youtube.com/channel/${sub.channelId}`, "_blank")}
                  title="Visit Channel"
                >
                  <Fa icon={faYoutube} fw />
                  <span>Visit Channel</span>
                </SimpleButton>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  .playlist-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    padding: 20px 0;
  }

  .playlist-card {
    flex: 0 1 200px;
    max-width: 200px;
    border-radius: 12px;
    overflow: hidden;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    transition:
      box-shadow 0.2s,
      transform 0.2s;
    display: flex;
    flex-direction: column;
    padding: 16px;
  }

  .playlist-card:hover {
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
    transform: translateY(-3px);
  }

  .playlist-thumbnail.circular {
    aspect-ratio: 1/1;
    border-radius: 50%;
    width: 100px;
    margin: 0 auto 12px;
    overflow: hidden;
    background: #1a1a1a;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .playlist-title {
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 12px;
    color: var(--text-color);
  }

  .playlist-actions {
    display: flex;
  }
</style>
