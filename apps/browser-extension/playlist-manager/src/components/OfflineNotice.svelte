<script lang="ts">
  import Fa from "svelte-fa";
  import { faCloud } from "@fortawesome/free-solid-svg-icons";
  import { push } from "svelte-spa-router";

  let { onSignIn = () => {} }: { onSignIn?: () => void } = $props();

  async function triggerSignIn() {
    try {
      await window.signIn();
    } catch (e) {
      const code = (e as any)?.code;
      if (code === "credentials_missing") {
        if (window.info) window.info("Please fill in your API credentials first.");
        push("/api-setup");
      } else {
        if (window.error) window.error("Sign-in failed. Please try again.");
      }
    }
  }
</script>

<div class="offline-notice">
  <div class="notice-content">
    <Fa icon={faCloud} fw />
    <p>
      Showing locally saved playlists.
      <button class="signin-link" onclick={triggerSignIn}>Sign in</button>
      to sync with your YouTube account.
    </p>
  </div>
</div>

<style>
  .offline-notice {
    margin-top: 3rem;
    padding: 16px;
    background: rgba(54, 166, 255, 0.08);
    border: 1px dashed #3ea6ff;
    border-radius: 12px;
  }

  .notice-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .signin-link {
    background: none;
    border: none;
    color: #3ea6ff;
    padding: 0;
    font-size: inherit;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .offline-notice {
      margin-top: 2rem;
      padding: 12px;
    }

    .notice-content {
      flex-direction: column;
      text-align: center;
      gap: 8px;
    }
  }
</style>
