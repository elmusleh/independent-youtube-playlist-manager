<script lang="ts">
  import Fa from "svelte-fa";
  import { faLink } from "@fortawesome/free-solid-svg-icons";
</script>

<!-- API Setup Link -->
<section class="card">
  <h3><Fa icon={faLink} /> YouTube Data API</h3>
  <p class="sub-text">
    Optional. Connect a YouTube Data API key for faster, quota-backed metadata.
  </p>
  <a href="#/api-setup" class="api-link"><Fa icon={faLink} /> Open API setup</a>
</section>

<style>
  .api-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--accent, #3b82f6);
    text-decoration: none;
    font-weight: 500;
  }
  .api-link:hover {
    text-decoration: underline;
  }
</style>
