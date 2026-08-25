<script lang="ts">
  import { toast } from "../stores/toast";
  import ToastItem from "./ToastItem.svelte";
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
</script>

<div class="toast-container" aria-live="polite" aria-atomic="false">
  {#each $toast as t (t.id)}
    <div
      class="toast-slot"
      animate:flip={{ duration: 250 }}
      transition:fly={{ y: 20, opacity: 0, duration: 220 }}
    >
      <ToastItem toast={t} onDismiss={(id) => toast.dismiss(id)} />
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 10000;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    pointer-events: none;
    max-width: min(380px, calc(100vw - 32px));
  }

  .toast-slot {
    pointer-events: auto;
  }
</style>
