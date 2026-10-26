<script>
  import Fa from "svelte-fa";
  import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
  import Modal from "./Modal.svelte";
</script>

<Modal display={true} dismissible={false} size="small" title="Loading">
  <div class="loading-modal" role="status" aria-live="polite">
    <Fa icon={faCircleNotch} spin size="3x" />
    <span>Loading…</span>
  </div>
</Modal>

<style>
  .loading-modal {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    min-height: 100px;
    color: var(--text-color);
  }
</style>
