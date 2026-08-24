<script lang="ts">
  import LargeButton from "./LargeButton.svelte";
  import { faGoogle } from "@fortawesome/free-brands-svg-icons";
  import Fa from "svelte-fa";
  import { push } from "svelte-spa-router";

  let { message = "Please sign in to access this feature.", onSignedIn }: {
    message?: string;
    onSignedIn?: () => void;
  } = $props();

  let loading = $state(false);

  async function handleSignIn() {
    loading = true;
    try {
      await window.signIn();
      if (onSignedIn) onSignedIn();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const code = (e as any)?.code;
      if (code === "credentials_missing") {
        if (window.info) window.info("Please fill in your API credentials first.");
        push("/api-setup");
      } else {
        console.error("[AUTH-PLACEHOLDER] Sign-in failed:", e);
        if (window.logSystemEvent) await window.logSystemEvent("ERROR", `[AUTH-PLACEHOLDER] Sign-in failed: ${errMsg}`);
        if (window.error) window.error("Sign-in failed. Please try again.");
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-placeholder">
  <div class="content">
    <div class="icon">
      <img src="../icons/icon_128.png" alt="Independent YouTube Playlist Manager" width="48" height="48" />
    </div>
    <p>{message}</p>
    <LargeButton onclick={handleSignIn} bgcolor="#4285F4" disabled={loading}>
      <div class="button-content">
        {#if !loading}
          <Fa icon={faGoogle} fw />
        {/if}
        <span>{loading ? "Signing in..." : "Sign in with Google"}</span>
      </div>
    </LargeButton>
  </div>
</div>

<style>
  .auth-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 200px);
    text-align: center;
    padding: 2rem;
    width: 100%;
  }
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    max-width: 400px;
    padding: 2rem;
    background: var(--background-color);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  }
  p {
    margin: 0;
    color: var(--text-muted, #666);
    line-height: 1.5;
    font-size: 1.1rem;
  }
  .button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    font-weight: 500;
  }
  .icon img {
    opacity: 0.8;
    filter: grayscale(0.2);
  }
</style>
