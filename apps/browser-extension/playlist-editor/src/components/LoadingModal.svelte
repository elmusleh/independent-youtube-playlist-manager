<script>
  import Fa from "svelte-fa";
  import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
</script>

<div class="loading-modal">
  <Fa icon={faCircleNotch} spin size="3x" />
</div>

<style>
  .loading-modal {
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 10000;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.5);
    color: #ccffff;
  }
</style>
