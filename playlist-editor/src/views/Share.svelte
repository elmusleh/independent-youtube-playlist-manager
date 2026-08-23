<script lang="ts">
  import Fa from "svelte-fa";
  import SimpleButton from "../components/SimpleButton.svelte";
  import {
    faTwitter,
    faFacebook,
    faLinkedin,
    faReddit,
    faWhatsapp,
  } from "@fortawesome/free-brands-svg-icons";
  import {
    faShareNodes,
    faLink,
    faCheck,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import { toast } from "../stores/toast";

  const shareUrl = "https://github.com/el-musleh/independent-youtube-playlist-manager";
  const shareTitle = "Playlist Manager";
  const shareText =
    "Check out this extension! Turn open YouTube tabs and RSS feeds into organized playlists with Playlist Manager!";

  let copied = $state(false);

  function openPopup(url: string) {
    const width = 600;
    const height = 600;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    window.open(
      url,
      "Share",
      `width=${width},height=${height},top=${top},left=${left}`,
    );
  }

  function shareTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    openPopup(url);
  }

  function shareFacebook() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    openPopup(url);
  }

  function shareLinkedIn() {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    openPopup(url);
  }

  function shareReddit() {
    const url = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`;
    openPopup(url);
  }

  function shareWhatsApp() {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
    openPopup(url);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      copied = true;
      toast.show("Link copied to clipboard!", "success");
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (e) {
      console.error("Failed to copy", e);
      toast.show("Failed to copy link", "error");
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (e) {
        console.error("Share failed", e);
      }
    } else {
      copyLink();
    }
  }
</script>

<main>
  <div class="view-header">
    <div class="top-left">
      <ViewHeader icon={faShareNodes} title="Share" />
    </div>
    <div class="btn-group right-align"></div>
  </div>

  <div class="view-body">
    <div class="share-intro">
      <p>
        Love using Playlist Helper? Help others discover it by sharing
        it with your friends and network.
      </p>
    </div>

    <div class="share-grid">
      <button class="share-btn twitter" onclick={shareTwitter}>
        <Fa icon={faTwitter} size="lg" />
        <span>X (Twitter)</span>
      </button>
      <button class="share-btn facebook" onclick={shareFacebook}>
        <Fa icon={faFacebook} size="lg" />
        <span>Facebook</span>
      </button>
      <button class="share-btn linkedin" onclick={shareLinkedIn}>
        <Fa icon={faLinkedin} size="lg" />
        <span>LinkedIn</span>
      </button>
      <button class="share-btn reddit" onclick={shareReddit}>
        <Fa icon={faReddit} size="lg" />
        <span>Reddit</span>
      </button>
      <button class="share-btn whatsapp" onclick={shareWhatsApp}>
        <Fa icon={faWhatsapp} size="lg" />
        <span>WhatsApp</span>
      </button>
    </div>

    <div class="share-actions">
      {#if typeof navigator.share === "function"}
        <SimpleButton onclick={nativeShare} className="native-share-btn">
          <Fa icon={faShareNodes} fw />
          <span>Share...</span>
        </SimpleButton>
      {/if}

      <SimpleButton onclick={copyLink} secondary className="copy-btn">
        <Fa icon={copied ? faCheck : faLink} fw />
        <span>{copied ? "Copied!" : "Copy Link"}</span>
      </SimpleButton>
    </div>
  </div>
</main>

<style>

  .share-intro {
    text-align: center;
    margin-bottom: 40px;
  }

  .share-intro p {
    font-size: 16px;
    color: var(--text-muted);
    max-width: 500px;
    margin: 0 auto;
    line-height: 1.6;
  }

  .share-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .share-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
    border: none;
    border-radius: 12px;
    color: white;
    cursor: pointer;
    transition:
      transform 0.2s ease,
      filter 0.2s ease,
      box-shadow 0.2s ease;
    font-weight: 500;
    font-size: 14px;
    outline: none;
  }

  .share-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .share-btn:active {
    transform: translateY(0);
  }

  .share-btn.twitter {
    background-color: #1da1f2;
  }
  .share-btn.facebook {
    background-color: #1877f2;
  }
  .share-btn.linkedin {
    background-color: #0a66c2;
  }
  .share-btn.reddit {
    background-color: #ff4500;
  }
  .share-btn.whatsapp {
    background-color: #25d366;
  }

  .share-actions {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 40px;
    border-top: 1px solid var(--border-color);
    padding-top: 32px;
  }

  :global(.native-share-btn) {
    background-color: var(--primary-color) !important;
    color: white !important;
    border: none !important;
    padding: 0 24px !important;
    min-width: 140px;
  }

  :global(.copy-btn) {
    min-width: 140px;
    transition: all 0.2s ease;
  }

  @media (max-width: 600px) {
    .share-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .share-actions {
      flex-direction: column;
    }

    :global(.native-share-btn),
    :global(.copy-btn) {
      width: 100%;
    }
  }
</style>
